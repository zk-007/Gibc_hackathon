import type { SandboxCase } from "./runSandbox";
import type { LeadScenario } from "./generateLeads";

const SCENARIOS: Record<LeadScenario, string> = {
  complete_consented: "Ready",
  vip: "VIP",
  missing_consent: "No consent",
  incomplete: "Missing email",
  invalid_email: "Bad email",
  excessive_discount: "Discount too high",
  duplicate: "Duplicate",
};

const STATUSES: Record<SandboxCase["status"], string> = {
  NEEDS_APPROVAL: "Waiting",
  BLOCKED: "Stopped",
  REVIEW: "Duplicate",
  POSTPONED: "Later",
  APPROVED: "Approved",
  SUCCESS: "Sent",
  SKIPPED: "Rejected",
  HARD_FAIL: "Error",
};

export function scenarioLabel(scenario: LeadScenario): string {
  return SCENARIOS[scenario] ?? scenario;
}

export function statusLabel(status: SandboxCase["status"]): string {
  return STATUSES[status] ?? status;
}

export function runStatusLabel(status: string): string {
  return STATUSES[status as SandboxCase["status"]] ?? status;
}
