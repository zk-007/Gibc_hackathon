import { describe, expect, it, beforeEach } from "vitest";
import { listAudit, resetAudit } from "@/audit/log";
import { ali, maya } from "@/fixtures/leads";
import {
  approveRun,
  ingestLead,
  postponeRun,
  resetRunStore,
  resumeRun,
  skipRun,
} from "@/runs/memoryStore";
import { resetActiveBrief } from "@/session/activeBrief";

describe("audit trail", () => {
  beforeEach(() => {
    resetActiveBrief();
    resetRunStore();
    resetAudit();
  });

  it("writes down the decision for a blocked lead", async () => {
    await ingestLead(maya);
    const events = listAudit();

    expect(events.some((event) => event.actor === "policy")).toBe(true);
    expect(events[0]?.detail).toMatch(/consent/i);
    expect(events[0]?.lead).toBe("maya@orbitgoods.com");
  });

  it("approve records both the human and the gmail event", async () => {
    const { run } = await ingestLead(ali);
    await approveRun(run.id);
    const events = listAudit();

    expect(events.some((event) => event.event === "approved" && event.actor === "human")).toBe(
      true,
    );
    expect(events.some((event) => event.event === "executed")).toBe(true);
    expect(events.some((event) => event.event === "follow-up scheduled")).toBe(true);
  });

  it("a rejection is recorded too", async () => {
    const { run } = await ingestLead(ali);
    await skipRun(run.id);

    expect(listAudit().some((event) => event.event === "rejected")).toBe(true);
  });

  it("postpone and resume both reach the audit log", async () => {
    const { run } = await ingestLead(ali);
    await postponeRun(run.id, 30);
    resumeRun(run.id);
    const events = listAudit();

    expect(events.some((event) => event.event === "postponed")).toBe(true);
    expect(events.some((event) => event.event === "resumed")).toBe(true);
  });
});
