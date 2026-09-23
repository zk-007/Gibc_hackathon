import type { Workflow } from "@/workflow/schema";
import { parseWorkflow } from "@/workflow/schema";

export type CompileResult = {
  workflow: Workflow;
  notes: string[];
};

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

/**
 * Deterministic fallback compiler: read the sentence, emit a workflow recipe.
 * Fast and fully testable, and it keeps the demo alive when the LLM is absent.
 */
export function compileBrief(brief: string): CompileResult {
  const text = brief.trim().toLowerCase();
  const notes: string[] = [];

  if (!text) {
    throw new Error("The brief is empty — describe the routine for the agent");
  }

  const sheetMatch = brief.match(/(\w+)\s+sheet/i);
  const sheet = sheetMatch?.[1] ?? "Leads";
  notes.push(`Trigger: a new row in the ${sheet} sheet`);

  const wantsEmail = includesAny(text, ["email", "mail", "welcome"]);
  const wantsTask = includesAny(text, ["task", "follow-up", "follow up", "followup"]);
  const askedForGate = includesAny(text, [
    "ask me",
    "before sending",
    "approve",
    "approval",
  ]);

  if (!wantsEmail && !wantsTask) {
    throw new Error("The agent needs at least one action: an email or a task");
  }

  const nodes: Workflow["nodes"] = [
    {
      id: "normalize",
      kind: "check",
      op: "require_fields",
      fields: ["email", "name"],
    },
    {
      id: "guards",
      kind: "policy",
      rules: [
        "email.valid",
        "consent.marketing",
        "dedupe.email",
        "discount.limit",
      ],
    },
  ];
  notes.push(
    "Guardian added the checks itself: empty fields, malformed email, consent, duplicates, and the discount limit",
  );

  if (wantsEmail) {
    nodes.push({
      id: "human-approval",
      kind: "gate",
      when: "external_message",
      preview: "email",
    });
    nodes.push({ id: "welcome-email", kind: "action", op: "gmail.send" });
    notes.push(
      askedForGate
        ? "Human gate before the email — you asked for it"
        : "Human gate before the email — Guardian default, because it reaches a customer",
    );
  }

  if (wantsTask) {
    const delay = includesAny(text, ["3 day", "3 days", "three day"]) ? "P3D" : "P1D";
    nodes.push({
      id: "follow-up-task",
      kind: "action",
      op: "tasks.create",
      delay,
    });
    notes.push(`Follow-up task ${delay} after the welcome`);
  }

  const workflow = parseWorkflow({
    name: wantsEmail ? "Lead welcome sequence" : "Lead follow-up",
    trigger: { type: "sheets.row_added", sheet },
    nodes,
  });

  return { workflow, notes };
}
