import { describe, expect, it } from "vitest";
import { createMockConnectors } from "@/connectors/mock";
import {
  executeApproved,
  resolveGate,
  startRun,
  wakeIfDue,
} from "@/engine/execute";
import { ali, jo, maya } from "@/fixtures/leads";
import { leadWelcomeWorkflow } from "@/workflow/leadWelcome";
import { parseWorkflow } from "@/workflow/schema";

describe("workflow schema", () => {
  it("accepts the lead welcome recipe", () => {
    expect(parseWorkflow(leadWelcomeWorkflow).name).toBe("Lead welcome sequence");
  });

  it("rejects a workflow with no trigger", () => {
    expect(() =>
      parseWorkflow({
        name: "Broken",
        nodes: leadWelcomeWorkflow.nodes,
      }),
    ).toThrow();
  });
});

describe("run engine", () => {
  it("happy_ali pauses for approval and does not send yet", async () => {
    const connectors = createMockConnectors();
    const run = await startRun(leadWelcomeWorkflow, ali, {
      connectors,
      seenEmails: new Set(),
    });

    expect(run.status).toBe("NEEDS_APPROVAL");
    expect(run.preview?.to).toBe("ali@northstar.co");
    expect(connectors.outbox.emails).toHaveLength(0);
    expect(connectors.outbox.tasks).toHaveLength(0);
  });

  it("no_consent_maya is blocked and never reaches Gmail", async () => {
    const connectors = createMockConnectors();
    const run = await startRun(leadWelcomeWorkflow, maya, {
      connectors,
      seenEmails: new Set(),
    });

    expect(run.status).toBe("BLOCKED");
    expect(run.steps.some((step) => step.detail.includes("consent"))).toBe(true);
    expect(connectors.outbox.emails).toHaveLength(0);
  });

  it("missing_email is blocked at the check node", async () => {
    const connectors = createMockConnectors();
    const run = await startRun(
      leadWelcomeWorkflow,
      { ...ali, email: "" },
      { connectors, seenEmails: new Set() },
    );

    expect(run.status).toBe("BLOCKED");
    expect(run.steps[0]?.nodeId).toBe("normalize");
    expect(run.steps[0]?.detail).toContain("email");
    expect(connectors.outbox.emails).toHaveLength(0);
  });

  it("duplicate_jo is held for review and does not send", async () => {
    const connectors = createMockConnectors();
    const run = await startRun(leadWelcomeWorkflow, jo, {
      connectors,
      seenEmails: new Set(["jo@atelierform.co"]),
    });

    expect(run.status).toBe("REVIEW");
    expect(run.steps.some((step) => step.detail.includes("Duplicate"))).toBe(true);
    expect(connectors.outbox.emails).toHaveLength(0);
  });

  it("skip_then_no_send leaves the outbox empty", async () => {
    const connectors = createMockConnectors();
    const ctx = { connectors, seenEmails: new Set<string>() };
    const paused = await startRun(leadWelcomeWorkflow, ali, ctx);
    const skipped = await resolveGate(paused, "skip", ctx);

    expect(skipped.status).toBe("SKIPPED");
    expect(connectors.outbox.emails).toHaveLength(0);
    expect(connectors.outbox.tasks).toHaveLength(0);
  });

  it("approve records the decision before anything is sent", async () => {
    const connectors = createMockConnectors();
    const ctx = { connectors, seenEmails: new Set<string>() };
    const paused = await startRun(leadWelcomeWorkflow, ali, ctx);
    const approved = await resolveGate(paused, "approve", ctx);

    expect(approved.status).toBe("APPROVED");
    expect(connectors.outbox.emails).toHaveLength(0);
  });

  it("postpone holds the send and wakes up when the snooze ends", async () => {
    const connectors = createMockConnectors();
    const ctx = { connectors, seenEmails: new Set<string>() };
    const paused = await startRun(leadWelcomeWorkflow, ali, ctx);
    const snoozed = await resolveGate(paused, "postpone", ctx, { snoozeMs: 1000 });

    expect(snoozed.status).toBe("POSTPONED");
    expect(connectors.outbox.emails).toHaveLength(0);
    expect(wakeIfDue(snoozed, Date.now())).toBe(false);
    expect(wakeIfDue(snoozed, Date.now() + 2000)).toBe(true);
    expect(snoozed.status).toBe("NEEDS_APPROVAL");
  });

  it("approve_then_send writes one email and one follow-up task", async () => {
    const connectors = createMockConnectors();
    const ctx = { connectors, seenEmails: new Set<string>() };
    const paused = await startRun(leadWelcomeWorkflow, ali, ctx);
    const approved = await resolveGate(paused, "approve", ctx);
    const done = await executeApproved(approved, ctx);

    expect(done.status).toBe("SUCCESS");
    expect(connectors.outbox.emails).toHaveLength(1);
    expect(connectors.outbox.emails[0]?.to).toBe("ali@northstar.co");
    expect(connectors.outbox.tasks).toHaveLength(1);
    expect(connectors.outbox.tasks[0]?.delay).toBe("P3D");
  });
});
