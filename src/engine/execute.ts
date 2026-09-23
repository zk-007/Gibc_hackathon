import type { Connectors, EmailDraft } from "@/connectors/types";
import { templateWelcomeEmail } from "@/agent/draftEmail";
import { evaluateRule, missingRequiredFields } from "@/policy/evaluate";
import type { Lead, Workflow, WorkflowNode } from "@/workflow/schema";
import type { GateDecision, StepLog, WorkflowRun } from "./types";

export type RunContext = {
  connectors: Connectors;
  seenEmails: Set<string>;
};

function fallbackWelcome(lead: Lead): EmailDraft {
  return templateWelcomeEmail(lead);
}

function log(
  run: WorkflowRun,
  node: WorkflowNode,
  result: StepLog["result"],
  detail: string,
) {
  run.steps.push({ nodeId: node.id, kind: node.kind, result, detail });
}

async function runActionsFrom(
  run: WorkflowRun,
  ctx: RunContext,
  fromIndex: number,
): Promise<void> {
  const { workflow, lead } = run;
  for (let i = fromIndex; i < workflow.nodes.length; i += 1) {
    const node = workflow.nodes[i];
    run.cursor = i + 1;
    if (node.kind !== "action") {
      log(run, node, "done", "Skipped unexpected node after approval");
      continue;
    }
    if (node.op === "gmail.send") {
      const email = run.preview ?? fallbackWelcome(lead);
      await ctx.connectors.gmail.send(email);
      log(run, node, "done", `Sent email to ${email.to}`);
      continue;
    }
    const delay = node.delay ?? "P0D";
    await ctx.connectors.tasks.create({
      title: `Follow up with ${lead.name ?? lead.email ?? "lead"}`,
      leadId: lead.id,
      delay,
      email: lead.email,
      name: lead.name,
    });
    log(run, node, "done", `Created follow-up task in ${delay}`);
  }
  run.status = "SUCCESS";
}

export async function startRun(
  workflow: Workflow,
  lead: Lead,
  ctx: RunContext,
): Promise<WorkflowRun> {
  const run: WorkflowRun = {
    id: `${lead.id}-${Date.now()}`,
    workflow,
    lead,
    status: "NEEDS_APPROVAL",
    steps: [],
    cursor: 0,
  };

  for (let i = 0; i < workflow.nodes.length; i += 1) {
    const node = workflow.nodes[i];
    run.cursor = i;

    if (node.kind === "check") {
      const missing = missingRequiredFields(lead, node.fields);
      if (missing.length > 0) {
        run.status = "BLOCKED";
        log(run, node, "blocked", `Missing fields: ${missing.join(", ")}`);
        return run;
      }
      log(run, node, "pass", "Required fields present");
      continue;
    }

    if (node.kind === "policy") {
      for (const rule of node.rules) {
        const verdict = evaluateRule(rule, lead, ctx.seenEmails);
        if (!verdict.ok) {
          run.status = verdict.status;
          log(
            run,
            node,
            verdict.status === "REVIEW" ? "review" : "blocked",
            verdict.reason,
          );
          return run;
        }
      }
      log(run, node, "pass", "Policy checks passed");
      continue;
    }

    if (node.kind === "gate") {
      run.preview = fallbackWelcome(lead);
      run.previewSource = "template";
      run.status = "NEEDS_APPROVAL";
      run.cursor = i + 1;
      log(
        run,
        node,
        "paused",
        `Ask before sending to ${run.preview.to}`,
      );
      return run;
    }

    // Action before a gate should not run in this golden path.
    log(run, node, "paused", "Reached an action without a gate; refusing to send");
    run.status = "NEEDS_APPROVAL";
    return run;
  }

  run.status = "SUCCESS";
  return run;
}

export async function resolveGate(
  run: WorkflowRun,
  decision: GateDecision,
  ctx: RunContext,
  options: { snoozeMs?: number } = {},
): Promise<WorkflowRun> {
  if (run.status !== "NEEDS_APPROVAL") {
    throw new Error(`Cannot resolve a run in status ${run.status}`);
  }

  if (decision === "skip") {
    run.status = "SKIPPED";
    run.steps.push({
      nodeId: "human-approval",
      kind: "gate",
      result: "skipped",
      detail: "Operator rejected this send",
    });
    return run;
  }

  if (decision === "postpone") {
    const snoozeMs = options.snoozeMs ?? 60 * 60 * 1000;
    run.status = "POSTPONED";
    run.snoozeUntil = Date.now() + snoozeMs;
    run.steps.push({
      nodeId: "human-approval",
      kind: "gate",
      result: "paused",
      detail: `Operator postponed this send by ${Math.round(snoozeMs / 60000)} min`,
    });
    return run;
  }

  run.status = "APPROVED";
  run.steps.push({
    nodeId: "human-approval",
    kind: "gate",
    result: "done",
    detail: "Operator approved the send",
  });
  return run;
}

/** Actually run an approved workflow — the spec's separate "execute" stage. */
export async function executeApproved(
  run: WorkflowRun,
  ctx: RunContext,
): Promise<WorkflowRun> {
  if (run.status !== "APPROVED") {
    throw new Error(`Cannot execute a run in status ${run.status}`);
  }
  await runActionsFrom(run, ctx, run.cursor);
  return run;
}

/** Once the snooze expires, put the run back in the approval queue. */
export function wakeIfDue(run: WorkflowRun, now = Date.now()): boolean {
  if (run.status !== "POSTPONED") return false;
  if ((run.snoozeUntil ?? 0) > now) return false;
  run.status = "NEEDS_APPROVAL";
  run.snoozeUntil = undefined;
  run.steps.push({
    nodeId: "human-approval",
    kind: "gate",
    result: "paused",
    detail: "Postpone finished — waiting for you again",
  });
  return true;
}
