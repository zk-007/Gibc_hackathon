import { maxDiscountPercent } from "@/policy/evaluate";
import type { SandboxReport } from "@/simulate/runSandbox";
import type { Workflow } from "@/workflow/schema";

export type FindingTone = "pass" | "watch" | "fail";

export type Finding = {
  tone: FindingTone;
  title: string;
  detail: string;
  fix?: string;
};

export type RiskLevel = "low" | "medium" | "high";

export type Violation = {
  code: string;
  severity: "high" | "medium";
};

export type SafetyReport = {
  safeToEnablePercent: number;
  confidencePercent: number;
  passRatePercent: number;
  risk: RiskLevel;
  riskScore: number;
  violations: Violation[];
  activationAllowed: boolean;
  humanGates: number;
  findings: Finding[];
  recommendation: string;
  prototypeNotice: string;
  sandbox: SandboxReport;
};

export const PROTOTYPE_NOTICE =
  "Prototype heuristic on synthetic data — not a certified safety or compliance score.";

function hasRule(
  workflow: Workflow,
  rule: "email.valid" | "consent.marketing" | "dedupe.email" | "discount.limit",
): boolean {
  return workflow.nodes.some(
    (node) => node.kind === "policy" && node.rules.includes(rule),
  );
}

function nodeIndex(workflow: Workflow, test: (node: Workflow["nodes"][number]) => boolean): number {
  return workflow.nodes.findIndex(test);
}

export function buildSafetyReport(
  workflow: Workflow,
  sandbox: SandboxReport,
): SafetyReport {
  const findings: Finding[] = [];
  const violations: Violation[] = [];
  const humanGates = workflow.nodes.filter((node) => node.kind === "gate").length;
  const hasEmail = workflow.nodes.some(
    (node) => node.kind === "action" && node.op === "gmail.send",
  );
  const hasTask = workflow.nodes.some(
    (node) => node.kind === "action" && node.op === "tasks.create",
  );
  const hasCheck = workflow.nodes.some((node) => node.kind === "check");
  const hasConsent = hasRule(workflow, "consent.marketing");
  const hasDedupe = hasRule(workflow, "dedupe.email");
  const hasEmailShape = hasRule(workflow, "email.valid");
  const hasDiscountLimit = hasRule(workflow, "discount.limit");
  const gateIdx = nodeIndex(workflow, (node) => node.kind === "gate");
  const emailIdx = nodeIndex(
    workflow,
    (node) => node.kind === "action" && node.op === "gmail.send",
  );
  const gateBeforeEmail =
    !hasEmail || (gateIdx >= 0 && (emailIdx < 0 || gateIdx < emailIdx));

  const consentBlocks = sandbox.cases.filter(
    (item) =>
      item.status === "BLOCKED" &&
      (item.scenario === "missing_consent" || item.detail.toLowerCase().includes("consent")),
  ).length;
  const dirtyData = sandbox.cases.filter(
    (item) =>
      item.status === "BLOCKED" &&
      (item.scenario === "invalid_email" || item.scenario === "incomplete"),
  ).length;

  if (hasEmail && gateBeforeEmail && humanGates > 0) {
    findings.push({
      tone: "pass",
      title: "You approve before any email",
      detail: "No external message can leave without a sign-off.",
    });
  } else if (hasEmail) {
    violations.push({ code: "NO_HUMAN_GATE", severity: "high" });
    findings.push({
      tone: "fail",
      title: "Email could send without your yes",
      detail: "A welcome email could send without an operator seeing it.",
      fix: "Add a gate before gmail.send",
    });
  }

  if (hasEmail && !hasConsent) {
    violations.push({ code: "NO_CONSENT_RULE", severity: "high" });
    findings.push({
      tone: "fail",
      title: "Consent is required",
      detail: "The workflow would email people who never opted in.",
      fix: "Add the consent.marketing policy rule",
    });
  }

  if (hasCheck) {
    findings.push({
      tone: "pass",
      title: "Missing details are stopped",
      detail: "Incomplete records stop before any customer-facing step.",
    });
  } else {
    violations.push({ code: "NO_FIELD_CHECK", severity: "medium" });
    findings.push({
      tone: "watch",
      title: "No required-field check",
      detail: "Records with no email or name can reach later steps.",
      fix: "Add a require_fields check first",
    });
  }

  if (hasEmailShape) {
    findings.push({
      tone: "pass",
      title: "Bad email addresses are stopped",
      detail: "Anything that is not a real address is blocked before sending.",
    });
  }

  if (hasTask) {
    findings.push({
      tone: "pass",
      title: "Reminders can be cancelled",
      detail: "The task can be edited or removed after creation.",
    });
  }

  if (hasDedupe) {
    findings.push({
      tone: "pass",
      title: "Duplicates wait for a look",
      detail: "The same address cannot silently send twice.",
    });
  } else if (hasEmail) {
    violations.push({ code: "DUPLICATE_RISK", severity: "medium" });
    findings.push({
      tone: "watch",
      title: "Duplicate handling is implicit",
      detail: "A lead with the same email could trigger twice.",
      fix: "Add a duplicate check before the welcome sequence.",
    });
  }

  const discountBlocks = sandbox.cases.filter(
    (item) => item.status === "BLOCKED" && item.scenario === "excessive_discount",
  ).length;

  if (hasDiscountLimit) {
    findings.push({
      tone: "pass",
      title: `Discount stays under ${maxDiscountPercent()}%`,
      detail:
        discountBlocks > 0
          ? `${discountBlocks} synthetic row offered more than the limit and was blocked.`
          : "Any row offering more than the limit is blocked before sending.",
    });
  } else if (hasEmail) {
    violations.push({ code: "NO_DISCOUNT_LIMIT", severity: "medium" });
    findings.push({
      tone: "watch",
      title: "No discount ceiling",
      detail: "A row could promise any discount in a customer email.",
      fix: "Add the discount.limit policy rule",
    });
  }

  if (consentBlocks > 0 || dirtyData > 0) {
    violations.push({ code: "DIRTY_SOURCE_DATA", severity: "medium" });
  }

  if (consentBlocks > 0) {
    findings.push({
      tone: "watch",
      title: "Some leads have no consent",
      detail: `${consentBlocks} synthetic leads were blocked from marketing outreach.`,
      fix: "Add a consent column to your Leads sheet.",
    });
  }

  if (dirtyData > 0) {
    findings.push({
      tone: "watch",
      title: "Some sheet rows are incomplete",
      detail: `${dirtyData} synthetic rows had a missing or malformed email.`,
      fix: "Clean the email column in the sheet.",
    });
  }

  if (sandbox.hardFails > 0) {
    violations.push({ code: "HARD_FAILURE", severity: "high" });
    findings.push({
      tone: "fail",
      title: "A test run crashed",
      detail: `${sandbox.hardFails} runs crashed instead of failing safely.`,
    });
  }

  const high = violations.filter((item) => item.severity === "high").length;
  const medium = violations.filter((item) => item.severity === "medium").length;
  const riskScore = high * 3 + medium;
  const risk: RiskLevel = riskScore >= 3 ? "high" : riskScore >= 1 ? "medium" : "low";
  const activationAllowed = high === 0;

  const safeToEnablePercent = Math.max(
    0,
    Math.min(99, 100 - high * 25 - medium * 8),
  );

  const scenarios = new Set(sandbox.cases.map((item) => item.scenario));
  const coveragePoints = Math.min(30, scenarios.size * 5);
  const confidencePercent = Math.max(
    0,
    Math.min(100, 60 + coveragePoints - (high + medium) * 10),
  );

  let recommendation =
    "Safe to enable; keep approval on for customer emails.";
  if (!activationAllowed) {
    recommendation = "Do not enable until the high-severity items are fixed.";
  } else if (risk === "medium") {
    recommendation =
      consentBlocks > 0 || dirtyData > 0
        ? "Enable with approval required. Cleaning the sheet will lower the risk."
        : "Enable with approval required. Clear the watch items first.";
  }

  return {
    safeToEnablePercent,
    confidencePercent,
    passRatePercent: Math.round(sandbox.passRate * 100),
    risk,
    riskScore,
    violations,
    activationAllowed,
    humanGates,
    findings,
    recommendation,
    prototypeNotice: PROTOTYPE_NOTICE,
    sandbox,
  };
}
