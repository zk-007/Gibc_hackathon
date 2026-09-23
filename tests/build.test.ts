import { describe, expect, it, beforeEach } from "vitest";
import { generateFromBrief } from "@/agent/generate";
import { GOLDEN_LEAD_BRIEF } from "@/agent/golden";
import { listRunBoard, resetRunStore } from "@/runs/memoryStore";
import { resetActiveBrief } from "@/session/activeBrief";

describe("build generateFromBrief", () => {
  beforeEach(() => {
    resetActiveBrief();
    resetRunStore();
  });

  it("the golden sentence yields counted nodes and sandbox numbers", async () => {
    const result = await generateFromBrief(GOLDEN_LEAD_BRIEF);

    expect(result.workflow.nodes.map((node) => node.kind)).toEqual([
      "check",
      "policy",
      "gate",
      "action",
      "action",
    ]);
    expect(result.sandbox.passed).toBe(13);
    expect(result.sandbox.blocked).toBe(5);
    expect(result.sandbox.emailsSent).toBe(0);
    expect(result.notes.some((note) => note.includes("Guardian"))).toBe(true);

    const board = listRunBoard();
    expect(board.pending).toHaveLength(2);
    expect(board.blocked).toBe(1);
  });

  it("an empty brief throws", async () => {
    await expect(generateFromBrief("   ")).rejects.toThrow(/empty/i);
  });
});
