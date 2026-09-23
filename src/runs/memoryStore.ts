import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compileBrief } from "@/agent/compileBrief";
import { draftWelcomeEmail } from "@/agent/draftEmail";
import { createAppConnectors, type OutboxConnectors } from "@/connectors/gmail";
import type { EmailDraft, FollowUpTask } from "@/connectors/types";
import { recordAudit, resetAudit } from "@/audit/log";
import { listFollowUps, resetFollowUps } from "@/jobs/followups";
import { startGuardianLoop } from "@/jobs/loop";
import { executeApproved, resolveGate, startRun, wakeIfDue } from "@/engine/execute";
import type { WorkflowRun } from "@/engine/types";
import { ali, jo, maya } from "@/fixtures/leads";
import { getActiveBrief, getActiveWorkflow } from "@/session/activeBrief";
import type { Lead } from "@/workflow/schema";

export type RunSnapshot = {
  id: string;
  status: WorkflowRun["status"];
  leadName: string;
  email: string;
  company: string;
  subject: string;
  body: string;
  lastDetail: string;
  snoozeUntil?: number;
  previewSource?: "llm" | "template";
};

type MemoryState = {
  connectors: OutboxConnectors;
  seenEmails: Set<string>;
  runs: Map<string, WorkflowRun>;
};

type DiskState = {
  runs: WorkflowRun[];
  seenEmails: string[];
  emails: EmailDraft[];
  tasks: FollowUpTask[];
};

let memory: MemoryState | null = null;

function persistPath(): string {
  return path.join(process.cwd(), "data", "runs.json");
}

function shouldPersist(): boolean {
  return process.env.VITEST !== "true" && process.env.NODE_ENV !== "test";
}

function save(): void {
  if (!shouldPersist()) return;
  const state = memory;
  if (!state) return;
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const payload: DiskState = {
    runs: [...state.runs.values()],
    seenEmails: [...state.seenEmails],
    emails: state.connectors.outbox.emails,
    tasks: state.connectors.outbox.tasks,
  };
  writeFileSync(persistPath(), JSON.stringify(payload, null, 2), "utf8");
}

function hydrate(state: MemoryState): void {
  if (!shouldPersist()) return;
  try {
    const file = persistPath();
    if (!existsSync(file)) return;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as DiskState;
    if (!parsed || !Array.isArray(parsed.runs)) return;
    for (const run of parsed.runs) {
      if (run?.id) state.runs.set(run.id, run);
    }
    for (const email of parsed.seenEmails ?? []) {
      state.seenEmails.add(email);
    }
    state.connectors.outbox.emails.push(...(parsed.emails ?? []));
    state.connectors.outbox.tasks.push(...(parsed.tasks ?? []));
  } catch {
    // Keep an empty in-memory board if the file is corrupt.
  }
}

function createMemory(): MemoryState {
  return {
    connectors: createAppConnectors(),
    seenEmails: new Set(),
    runs: new Map(),
  };
}

export function resetRunStore(options?: { keepFollowUps?: boolean }): void {
  memory = createMemory();
  save();
  if (!options?.keepFollowUps) {
    resetFollowUps();
    resetAudit();
  }
}

function store(): MemoryState {
  if (!memory) {
    memory = createMemory();
    hydrate(memory);
    if (reconcileWithFollowUps(memory)) save();
    startGuardianLoop();
  }
  return memory;
}

function ctx() {
  const state = store();
  return { connectors: state.connectors, seenEmails: state.seenEmails };
}

function snapshot(run: WorkflowRun): RunSnapshot {
  return {
    id: run.id,
    status: run.status,
    leadName: run.lead.name ?? "",
    email: run.lead.email ?? "",
    company: run.lead.company ?? "",
    subject: run.preview?.subject ?? "",
    body: run.preview?.body ?? "",
    lastDetail: run.steps[run.steps.length - 1]?.detail ?? run.status,
    snoozeUntil: run.snoozeUntil,
    previewSource: run.previewSource,
  };
}

function followUpAlreadyStarted(leadId: string): boolean {
  return listFollowUps().some(
    (job) => job.leadId === leadId && job.status !== "failed",
  );
}

function markWelcomeAlreadySent(run: WorkflowRun): void {
  if (run.status !== "NEEDS_APPROVAL") return;
  run.status = "SUCCESS";
  run.steps.push({
    nodeId: "human-approval",
    kind: "gate",
    result: "done",
    detail: "Welcome already sent — follow-up exists",
  });
}

function completedFromFollowUp(
  key: string,
  workflow: WorkflowRun["workflow"],
  lead: Lead,
): WorkflowRun {
  return {
    id: key,
    workflow,
    lead,
    status: "SUCCESS",
    cursor: workflow.nodes.length,
    steps: [
      {
        nodeId: "follow-up-task",
        kind: "action",
        result: "done",
        detail: "Welcome already sent — follow-up exists",
      },
    ],
  };
}

function reconcileWithFollowUps(state: MemoryState): boolean {
  let changed = false;
  for (const run of state.runs.values()) {
    if (run.status !== "NEEDS_APPROVAL") continue;
    if (!followUpAlreadyStarted(run.lead.id)) continue;
    markWelcomeAlreadySent(run);
    changed = true;
  }
  return changed;
}

export function ingestKey(sheet: string, rowId: string): string {
  return `${sheet.trim().toLowerCase()}:${rowId.trim()}`;
}

function leadFingerprint(lead: Lead): string {
  return JSON.stringify({
    name: lead.name ?? "",
    email: lead.email ?? "",
    company: lead.company ?? "",
    consentMarketing: lead.consentMarketing ?? null,
    discountPercent: lead.discountPercent ?? null,
  });
}

function canRetryStopped(status: WorkflowRun["status"]): boolean {
  return status === "BLOCKED" || status === "REVIEW";
}

export async function ingestLead(
  lead: Lead,
  sheet?: string,
): Promise<{ run: RunSnapshot; duplicate: boolean; ingestKey: string }> {
  const workflow = getActiveWorkflow() ?? compileBrief(getActiveBrief()).workflow;
  const key = ingestKey(sheet ?? workflow.trigger.sheet, lead.id);
  const state = store();
  const existing = state.runs.get(key);
  if (existing) {
    if (
      existing.status === "NEEDS_APPROVAL" &&
      followUpAlreadyStarted(lead.id)
    ) {
      markWelcomeAlreadySent(existing);
      save();
    }
    const retry =
      canRetryStopped(existing.status) &&
      leadFingerprint(existing.lead) !== leadFingerprint(lead);
    if (!retry) {
      return { run: snapshot(existing), duplicate: true, ingestKey: key };
    }
  }

  if (followUpAlreadyStarted(lead.id)) {
    const run = completedFromFollowUp(key, workflow, lead);
    state.runs.set(key, run);
    save();
    return { run: snapshot(run), duplicate: true, ingestKey: key };
  }

  const run = await startRun(workflow, lead, ctx());
  run.id = key;
  if (run.status === "NEEDS_APPROVAL") {
    const drafted = await draftWelcomeEmail(lead);
    run.preview = drafted.email;
    run.previewSource = drafted.source;
  }
  state.runs.set(key, run);
  if (run.status === "NEEDS_APPROVAL" && lead.email) {
    state.seenEmails.add(lead.email.trim().toLowerCase());
  }
  for (const step of run.steps) {
    recordAudit({
      actor: step.kind === "policy" || step.kind === "check" ? "policy" : "system",
      runId: key,
      lead: lead.email ?? lead.id,
      event: `${step.kind}:${step.result}`,
      detail: step.detail,
    });
  }
  if (run.previewSource === "llm") {
    recordAudit({
      actor: "system",
      runId: key,
      lead: lead.email ?? lead.id,
      event: "drafted",
      detail: `Welcome email drafted by the model: ${run.preview?.subject ?? ""}`,
    });
  }
  save();
  return { run: snapshot(run), duplicate: false, ingestKey: key };
}

export async function resetAndSeedDemoRuns(): Promise<void> {
  resetRunStore();
  await seedDemoRuns();
}

export async function seedDemoRuns(): Promise<void> {
  const state = store();
  if (state.runs.size > 0) {
    if (reconcileWithFollowUps(state)) save();
    return;
  }

  for (const lead of [ali, jo, maya] satisfies Lead[]) {
    await ingestLead(lead);
  }
}

function mustGet(id: string): WorkflowRun {
  const run = store().runs.get(id);
  if (!run) throw new Error(`Run not found: ${id}`);
  return run;
}

/** Stage 8: record the decision only; nothing is sent yet. */
export async function recordApproval(id: string): Promise<RunSnapshot> {
  const run = mustGet(id);
  await resolveGate(run, "approve", ctx());
  recordAudit({
    actor: "human",
    runId: id,
    lead: run.lead.email ?? run.lead.id,
    event: "approved",
    detail: `Operator approved: ${run.preview?.subject ?? "email"}`,
  });
  save();
  return snapshot(run);
}

/** Stage 9: run the actions of an approved run. */
export async function executeRun(id: string): Promise<RunSnapshot> {
  const run = mustGet(id);
  await executeApproved(run, ctx());
  recordAudit({
    actor: "gmail",
    runId: id,
    lead: run.lead.email ?? run.lead.id,
    event: "executed",
    detail: run.steps[run.steps.length - 1]?.detail ?? "Actions finished",
  });
  save();
  return snapshot(run);
}

export async function approveRun(id: string): Promise<RunSnapshot> {
  await recordApproval(id);
  return executeRun(id);
}

export async function skipRun(id: string): Promise<RunSnapshot> {
  const run = mustGet(id);
  await resolveGate(run, "skip", ctx());
  recordAudit({
    actor: "human",
    runId: id,
    lead: run.lead.email ?? run.lead.id,
    event: "rejected",
    detail: "Operator rejected this send",
  });
  save();
  return snapshot(run);
}

export async function postponeRun(
  id: string,
  minutes = 60,
): Promise<RunSnapshot> {
  const run = mustGet(id);
  await resolveGate(run, "postpone", ctx(), { snoozeMs: minutes * 60 * 1000 });
  recordAudit({
    actor: "human",
    runId: id,
    lead: run.lead.email ?? run.lead.id,
    event: "postponed",
    detail: `Back in the queue in ${minutes} min`,
  });
  save();
  return snapshot(run);
}

export function resumeRun(id: string): RunSnapshot {
  const run = mustGet(id);
  if (run.status !== "POSTPONED") {
    throw new Error("Only a postponed run can resume");
  }
  run.status = "NEEDS_APPROVAL";
  run.snoozeUntil = undefined;
  run.steps.push({
    nodeId: "human-approval",
    kind: "gate",
    result: "paused",
    detail: "Operator resumed this send",
  });
  recordAudit({
    actor: "human",
    runId: id,
    lead: run.lead.email ?? run.lead.id,
    event: "resumed",
    detail: "Back in the approval queue",
  });
  save();
  return snapshot(run);
}

export function editPreview(
  id: string,
  patch: { subject: string; body: string },
): RunSnapshot {
  const run = store().runs.get(id);
  if (!run) throw new Error(`Run not found: ${id}`);
  if (run.status !== "NEEDS_APPROVAL") {
    throw new Error("Can only edit a paused send");
  }
  if (!run.preview) {
    throw new Error("No email preview to edit");
  }
  run.preview = {
    ...run.preview,
    subject: patch.subject,
    body: patch.body,
  };
  recordAudit({
    actor: "human",
    runId: id,
    lead: run.lead.email ?? run.lead.id,
    event: "edited",
    detail: `Preview edited: ${patch.subject}`,
  });
  save();
  return snapshot(run);
}

export function listRunBoard(): {
  pending: RunSnapshot[];
  postponed: RunSnapshot[];
  recent: RunSnapshot[];
  emailsSent: number;
  blocked: number;
} {
  const state = store();
  let changed = reconcileWithFollowUps(state);
  for (const run of state.runs.values()) {
    if (wakeIfDue(run)) changed = true;
  }
  if (changed) save();
  const recent = [...state.runs.values()].map(snapshot);
  return {
    pending: recent.filter((item) => item.status === "NEEDS_APPROVAL"),
    postponed: recent.filter((item) => item.status === "POSTPONED"),
    recent,
    emailsSent: state.connectors.outbox.emails.length,
    blocked: recent.filter((item) => item.status === "BLOCKED").length,
  };
}

export function outboxEmails() {
  return [...store().connectors.outbox.emails];
}

export function getRunConnectors() {
  return store().connectors;
}
