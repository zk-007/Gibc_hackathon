import { describe, expect, it } from "vitest";
import { GOLDEN_LEAD_BRIEF } from "@/agent/golden";
import { compileBrief } from "@/agent/compileBrief";
import { startRunFromBrief } from "@/agent/runFromBrief";
import { createMockConnectors } from "@/connectors/mock";
import { executeApproved, resolveGate } from "@/engine/execute";
import { ali, maya } from "@/fixtures/leads";

describe("agent compileBrief", () => {
  it("builds a recipe from the golden sentence: trigger, guards, gate, email, task", () => {
    const { workflow, notes } = compileBrief(GOLDEN_LEAD_BRIEF);

    expect(workflow.trigger).toEqual({ type: "sheets.row_added", sheet: "Leads" });
    expect(workflow.nodes.map((node) => node.kind)).toEqual([
      "check",
      "policy",
      "gate",
      "action",
      "action",
    ]);
    expect(workflow.nodes.some((node) => node.kind === "action" && node.op === "gmail.send")).toBe(
      true,
    );
    expect(
      workflow.nodes.some(
        (node) => node.kind === "action" && node.op === "tasks.create" && node.delay === "P3D",
      ),
    ).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
  });

  it("adds a gate before the email even if nobody asked — Guardian default", () => {
    const { workflow, notes } = compileBrief(
      "When a new lead is added to my Leads sheet, send them a welcome email.",
    );

    expect(workflow.nodes.some((node) => node.kind === "gate")).toBe(true);
    expect(notes.some((note) => note.includes("Guardian default"))).toBe(true);
  });

  it("rejects an empty brief", () => {
    expect(() => compileBrief("   ")).toThrow(/empty/i);
  });
});

describe("agent recipe → engine", () => {
  it("pauses Ali on the golden sentence and sends nothing yet", async () => {
    const connectors = createMockConnectors();
    const { run, workflow } = await startRunFromBrief(GOLDEN_LEAD_BRIEF, ali, {
      connectors,
      seenEmails: new Set(),
    });

    expect(workflow.name).toBe("Lead welcome sequence");
    expect(run.status).toBe("NEEDS_APPROVAL");
    expect(run.preview?.to).toBe("ali@northstar.co");
    expect(connectors.outbox.emails).toHaveLength(0);
  });

  it("Maya is blocked without consent — zero Gmail calls", async () => {
    const connectors = createMockConnectors();
    const { run } = await startRunFromBrief(GOLDEN_LEAD_BRIEF, maya, {
      connectors,
      seenEmails: new Set(),
    });

    expect(run.status).toBe("BLOCKED");
    expect(connectors.outbox.emails).toHaveLength(0);
  });

  it("after approve: one email and a 3-day follow-up task", async () => {
    const connectors = createMockConnectors();
    const ctx = { connectors, seenEmails: new Set<string>() };
    const { run } = await startRunFromBrief(GOLDEN_LEAD_BRIEF, ali, ctx);
    const approved = await resolveGate(run, "approve", ctx);
    const done = await executeApproved(approved, ctx);

    expect(done.status).toBe("SUCCESS");
    expect(connectors.outbox.emails).toHaveLength(1);
    expect(connectors.outbox.tasks[0]?.delay).toBe("P3D");
  });
});
