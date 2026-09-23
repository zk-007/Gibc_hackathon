import { describe, expect, it } from "vitest";
import { compileBrief } from "@/agent/compileBrief";
import { GOLDEN_LEAD_BRIEF } from "@/agent/golden";
import { buildSafetyReport } from "@/report/buildSafetyReport";
import { reportFromBrief } from "@/report/fromBrief";
import { generateLeads } from "@/simulate/generateLeads";
import { simulateWorkflow } from "@/simulate/runSandbox";

const CLEAN_MIX = {
  consented: 20,
  vip: 0,
  missingConsent: 0,
  incomplete: 0,
  invalidEmail: 0,
  excessiveDiscount: 0,
  duplicates: 0,
};

describe("safety report", () => {
  it("92% is computed from the golden sandbox, not hardcoded", async () => {
    const { workflow, report } = await reportFromBrief(GOLDEN_LEAD_BRIEF);

    expect(report.sandbox.passed).toBe(13);
    expect(report.sandbox.blocked).toBe(5);
    expect(report.passRatePercent).toBe(65);
    expect(report.confidencePercent).toBe(80);
    expect(report.safeToEnablePercent).toBe(92);
    expect(report.risk).toBe("medium");
    expect(report.riskScore).toBe(1);
    expect(report.activationAllowed).toBe(true);
    expect(report.humanGates).toBe(1);
    expect(report.sandbox.emailsSent).toBe(0);
    expect(report.prototypeNotice).toMatch(/not a certified/i);

    const consentWatch = report.findings.find((item) => item.title === "Some leads have no consent");
    expect(consentWatch?.tone).toBe("watch");
    expect(consentWatch?.detail).toContain("2");
    expect(consentWatch?.fix).toMatch(/consent column/i);

    expect(
      report.findings.some((item) => item.tone === "pass" && item.title.includes("You approve")),
    ).toBe(true);
    expect(report.recommendation).toMatch(/approval required/i);
    expect(workflow.nodes.some((node) => node.kind === "gate")).toBe(true);
  });

  it("clean data drops the risk to low", async () => {
    const { workflow } = compileBrief(GOLDEN_LEAD_BRIEF);
    const sandbox = await simulateWorkflow(workflow, generateLeads(CLEAN_MIX));
    const report = buildSafetyReport(workflow, sandbox);

    expect(report.sandbox.blocked).toBe(0);
    expect(report.findings.some((item) => item.tone === "watch")).toBe(false);
    expect(report.risk).toBe("low");
    expect(report.riskScore).toBe(0);
    expect(report.safeToEnablePercent).toBe(99);
  });

  it("an email with no gate is high risk and blocks activation", async () => {
    const { workflow } = compileBrief(GOLDEN_LEAD_BRIEF);
    const stripped = {
      ...workflow,
      nodes: workflow.nodes.filter((node) => node.kind !== "gate"),
    };
    const sandbox = await simulateWorkflow(
      stripped,
      generateLeads({ ...CLEAN_MIX, consented: 1 }),
    );
    const report = buildSafetyReport(stripped, sandbox);

    expect(report.humanGates).toBe(0);
    expect(report.risk).toBe("high");
    expect(report.activationAllowed).toBe(false);
    expect(report.violations.some((item) => item.code === "NO_HUMAN_GATE")).toBe(true);
    expect(report.findings.some((item) => item.tone === "fail")).toBe(true);
    expect(report.recommendation).toMatch(/Do not enable/i);
  });
});
