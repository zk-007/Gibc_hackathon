import { createMockConnectors } from "@/connectors/mock";
import { startRun } from "@/engine/execute";
import type { RunStatus, WorkflowRun } from "@/engine/types";
import type { Workflow } from "@/workflow/schema";
import type { LeadScenario, SyntheticLead } from "./generateLeads";

export type SandboxCase = {
  leadId: string;
  scenario: LeadScenario;
  status: RunStatus | "HARD_FAIL";
  detail: string;
  nodeId?: string;
};

export type SandboxReport = {
  tested: number;
  passed: number;
  blocked: number;
  review: number;
  hardFails: number;
  emailsSent: number;
  passRate: number;
  cases: SandboxCase[];
};

function lastDetail(run: WorkflowRun): string {
  return run.steps[run.steps.length - 1]?.detail ?? run.status;
}

export async function simulateWorkflow(
  workflow: Workflow,
  leads: SyntheticLead[],
): Promise<SandboxReport> {
  const connectors = createMockConnectors();
  const seenEmails = new Set<string>();
  const cases: SandboxCase[] = [];
  let hardFails = 0;

  for (const lead of leads) {
    try {
      const run = await startRun(workflow, lead, { connectors, seenEmails });
      if (run.status === "NEEDS_APPROVAL" && lead.email) {
        seenEmails.add(lead.email.trim().toLowerCase());
      }
      cases.push({
        leadId: lead.id,
        scenario: lead.scenario,
        status: run.status,
        detail: lastDetail(run),
        nodeId: run.steps[run.steps.length - 1]?.nodeId,
      });
    } catch (error) {
      hardFails += 1;
      cases.push({
        leadId: lead.id,
        scenario: lead.scenario,
        status: "HARD_FAIL",
        detail: error instanceof Error ? error.message : "Unknown failure",
      });
    }
  }

  const passed = cases.filter((item) => item.status === "NEEDS_APPROVAL").length;
  const blocked = cases.filter((item) => item.status === "BLOCKED").length;
  const review = cases.filter((item) => item.status === "REVIEW").length;
  const tested = leads.length;

  return {
    tested,
    passed,
    blocked,
    review,
    hardFails,
    emailsSent: connectors.outbox.emails.length,
    passRate: tested === 0 ? 0 : passed / tested,
    cases,
  };
}
