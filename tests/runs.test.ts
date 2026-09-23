import { describe, expect, it, beforeEach } from "vitest";
import { ali } from "@/fixtures/leads";
import { resetActiveBrief } from "@/session/activeBrief";
import {
  approveRun,
  editPreview,
  ingestLead,
  listRunBoard,
  outboxEmails,
  resetRunStore,
  seedDemoRuns,
  skipRun,
} from "@/runs/memoryStore";

describe("runs board", () => {
  beforeEach(() => {
    resetActiveBrief();
    resetRunStore();
  });

  it("demo seed: Ali and Jo pause, Maya is blocked, zero Gmail", async () => {
    await seedDemoRuns();
    const board = listRunBoard();

    expect(board.pending.map((item) => item.id).sort()).toEqual([
      "leads:ali",
      "leads:jo",
    ]);
    expect(board.blocked).toBe(1);
    expect(board.recent.find((item) => item.id === "leads:maya")?.status).toBe("BLOCKED");
    expect(board.emailsSent).toBe(0);
  });

  it("approving Ali sends one email; rejecting Jo sends none", async () => {
    await seedDemoRuns();
    await approveRun("leads:ali");
    await skipRun("leads:jo");
    const board = listRunBoard();

    expect(board.pending).toHaveLength(0);
    expect(board.emailsSent).toBe(1);
    expect(outboxEmails()[0]?.to).toBe("ali@northstar.co");
    expect(board.recent.find((item) => item.id === "leads:jo")?.status).toBe("SKIPPED");
  });

  it("approve after an edit sends the new subject", async () => {
    await seedDemoRuns();
    editPreview("leads:ali", {
      subject: "Welcome to Moss & Pine",
      body: "Hi Ali — edited by an operator.",
    });
    await approveRun("leads:ali");

    expect(outboxEmails()[0]?.subject).toBe("Welcome to Moss & Pine");
  });

  it("a blocked Maya cannot be approved", async () => {
    await seedDemoRuns();
    await expect(approveRun("leads:maya")).rejects.toThrow(/BLOCKED/);
    expect(outboxEmails()).toHaveLength(0);
  });

  it("after a follow-up, a memory reset does not make Ali pending again", async () => {
    await ingestLead(ali);
    await approveRun("leads:ali");
    resetRunStore({ keepFollowUps: true });
    await seedDemoRuns();
    const board = listRunBoard();

    expect(board.pending.map((item) => item.id)).toEqual(["leads:jo"]);
    expect(board.recent.find((item) => item.id === "leads:ali")?.status).toBe(
      "SUCCESS",
    );
  });
});
