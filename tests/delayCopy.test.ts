import { describe, expect, it } from "vitest";
import { followUpExplain, isoDelayLabel } from "@/jobs/delayCopy";

describe("delay copy", () => {
  it("renders P3D as 3 days", () => {
    expect(isoDelayLabel("P3D")).toBe("3 days");
  });

  it("keeps the demo clock separate from the recipe delay", () => {
    expect(
      followUpExplain({ requestedDelay: "P3D", waitMs: 60_000 }),
    ).toContain("1 minute");
    expect(
      followUpExplain({ requestedDelay: "P3D", waitMs: 60_000 }),
    ).toContain("3 days");
  });
});
