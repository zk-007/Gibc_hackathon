import { GOLDEN_LEAD_BRIEF } from "@/agent/golden";
import type { Workflow } from "@/workflow/schema";

let activeBrief = GOLDEN_LEAD_BRIEF;
let activeWorkflow: Workflow | null = null;
let sweep = 1;

export function getActiveBrief(): string {
  return activeBrief;
}

export function setActiveBrief(brief: string): void {
  const text = brief.trim();
  if (!text) {
    throw new Error("The brief is empty — describe the routine for the agent");
  }
  if (text !== activeBrief) activeWorkflow = null;
  activeBrief = text;
}

/** The workflow produced by compile; Simulate, Report, and Runs all reuse it. */
export function setActiveWorkflow(workflow: Workflow): void {
  activeWorkflow = workflow;
}

export function getActiveWorkflow(): Workflow | null {
  return activeWorkflow;
}

export function resetActiveBrief(): void {
  activeBrief = GOLDEN_LEAD_BRIEF;
  activeWorkflow = null;
  sweep = 1;
}

export function getSweep(): number {
  return sweep;
}

export function bumpSweep(): number {
  sweep += 1;
  return sweep;
}
