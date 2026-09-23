import { describe, expect, it } from "vitest";
import { compileBrief } from "@/agent/compileBrief";
import { GOLDEN_LEAD_BRIEF } from "@/agent/golden";
import { generateLeads } from "@/simulate/generateLeads";
import { simulateBrief } from "@/simulate/fromBrief";
import { simulateWorkflow } from "@/simulate/runSandbox";
import { trafficByNode } from "@/simulate/traffic";

/** Each test runs only its own scenario; the default mix is switched off. */
const EMPTY_MIX = {
  consented: 0,
  vip: 0,
  missingConsent: 0,
  incomplete: 0,
  invalidEmail: 0,
  excessiveDiscount: 0,
  duplicates: 0,
} as const;

describe("sandbox lead generator", () => {
  it("the default mix is 20 leads across seven edge cases", () => {
    const leads = generateLeads();
    const scenarios = new Set(leads.map((lead) => lead.scenario));

    expect(leads).toHaveLength(20);
    expect(scenarios.size).toBe(7);
    expect(leads.filter((lead) => lead.scenario === "missing_consent")).toHaveLength(2);
    expect(leads.filter((lead) => lead.scenario === "invalid_email")).toHaveLength(1);
    expect(leads.filter((lead) => lead.scenario === "incomplete")).toHaveLength(1);
    expect(leads.filter((lead) => lead.scenario === "excessive_discount")).toHaveLength(1);
    expect(leads.filter((lead) => lead.scenario === "duplicate")).toHaveLength(2);
  });
});

describe("sandbox simulator", () => {
  it("golden brief: 13 pass, 5 blocked, 2 review — all counted", async () => {
    const report = await simulateBrief(GOLDEN_LEAD_BRIEF);

    expect(report.tested).toBe(20);
    expect(report.passed).toBe(13);
    expect(report.blocked).toBe(5);
    expect(report.review).toBe(2);
    expect(report.hardFails).toBe(0);
    expect(report.emailsSent).toBe(0);
    expect(report.passRate).toBe(0.65);

    const passedIds = report.cases.filter((item) => item.status === "NEEDS_APPROVAL");
    const blockedIds = report.cases.filter((item) => item.status === "BLOCKED");
    expect(passedIds).toHaveLength(report.passed);
    expect(blockedIds).toHaveLength(report.blocked);
    expect(passedIds.every((item) => item.nodeId === "human-approval")).toBe(true);

    const { workflow } = compileBrief(GOLDEN_LEAD_BRIEF);
    const traffic = trafficByNode(workflow, report);
    expect(traffic.find((item) => item.nodeId === "normalize")?.blocked).toBe(1);
    expect(traffic.find((item) => item.nodeId === "guards")?.blocked).toBe(4);
    expect(traffic.find((item) => item.nodeId === "human-approval")?.paused).toBe(13);
  });

  it("a duplicate lead goes to review and is never sent", async () => {
    const { workflow } = compileBrief(GOLDEN_LEAD_BRIEF);
    const leads = generateLeads({
      ...EMPTY_MIX,
      consented: 1,
      duplicates: 1,
    });
    const report = await simulateWorkflow(workflow, leads);

    expect(report.tested).toBe(2);
    expect(report.passed).toBe(1);
    expect(report.review).toBe(1);
    expect(report.emailsSent).toBe(0);
  });

  it("an empty email is blocked at the check node", async () => {
    const { workflow } = compileBrief(GOLDEN_LEAD_BRIEF);
    const leads = generateLeads({ ...EMPTY_MIX, incomplete: 1 });
    const report = await simulateWorkflow(workflow, leads);

    expect(report.blocked).toBe(1);
    expect(report.cases[0]?.nodeId).toBe("normalize");
    expect(report.emailsSent).toBe(0);
  });

  it("a malformed email is blocked by policy", async () => {
    const { workflow } = compileBrief(GOLDEN_LEAD_BRIEF);
    const leads = generateLeads({ ...EMPTY_MIX, invalidEmail: 1 });
    const report = await simulateWorkflow(workflow, leads);

    expect(report.blocked).toBe(1);
    expect(report.cases[0]?.nodeId).toBe("guards");
    expect(report.cases[0]?.detail).toMatch(/valid address/i);
  });

  it("a discount over the limit is blocked by policy", async () => {
    const { workflow } = compileBrief(GOLDEN_LEAD_BRIEF);
    const leads = generateLeads({ ...EMPTY_MIX, excessiveDiscount: 1 });
    const report = await simulateWorkflow(workflow, leads);

    expect(report.blocked).toBe(1);
    expect(report.cases[0]?.nodeId).toBe("guards");
    expect(report.cases[0]?.detail).toMatch(/discount/i);
    expect(report.emailsSent).toBe(0);
  });
});
