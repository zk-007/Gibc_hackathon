import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { ali } from "@/fixtures/leads";
import {
  processDueFollowUps,
  listFollowUps,
  delayToMs,
} from "@/jobs/followups";
import { approveRun, ingestLead, resetRunStore } from "@/runs/memoryStore";
import { resetActiveBrief } from "@/session/activeBrief";

describe("follow-up delay", () => {
  const previous = process.env.FLOWFORGE_FOLLOWUP_MS;

  beforeEach(() => {
    resetActiveBrief();
    resetRunStore();
    process.env.FLOWFORGE_FOLLOWUP_MS = "0";
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.FLOWFORGE_FOLLOWUP_MS;
    else process.env.FLOWFORGE_FOLLOWUP_MS = previous;
  });

  it("P3D stays 3 days when there is no override", () => {
    delete process.env.FLOWFORGE_FOLLOWUP_MS;
    expect(delayToMs("P3D")).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("approve schedules the follow-up; the tick puts one mail in the outbox", async () => {
    const { run } = await ingestLead(ali);
    await approveRun(run.id);
    const scheduled = listFollowUps().filter((job) => job.status === "scheduled");
    expect(scheduled.length).toBeGreaterThan(0);

    const sent: string[] = [];
    await processDueFollowUps(async (email) => {
      sent.push(email.to);
    });
    expect(sent).toContain("ali@northstar.co");
    expect(listFollowUps().every((job) => job.status === "sent")).toBe(true);

    const again = await processDueFollowUps(async () => {
      sent.push("dup");
    });
    expect(again).toHaveLength(0);
  });
});
