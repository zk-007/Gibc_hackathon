import type { EmailDraft } from "@/connectors/types";
import type { Lead, Workflow } from "@/workflow/schema";

export type RunStatus =
  | "BLOCKED"
  | "REVIEW"
  | "NEEDS_APPROVAL"
  | "POSTPONED"
  | "APPROVED"
  | "SUCCESS"
  | "SKIPPED";

export type StepLog = {
  nodeId: string;
  kind: string;
  result: "pass" | "blocked" | "review" | "paused" | "done" | "skipped";
  detail: string;
};

export type WorkflowRun = {
  id: string;
  workflow: Workflow;
  lead: Lead;
  status: RunStatus;
  steps: StepLog[];
  /** Next node index to run. Gate pauses here; approve continues from this index. */
  cursor: number;
  preview?: EmailDraft;
  previewSource?: "llm" | "template";
  /** After a postpone, the run stays out of the queue until this moment. */
  snoozeUntil?: number;
};

export type GateDecision = "approve" | "skip" | "postpone";
