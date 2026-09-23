import { describe, expect, it } from "vitest";
import {
  loopIntervalMs,
  shouldRunGuardianLoop,
} from "@/jobs/loop";

describe("guardian loop", () => {
  it("the auto loop stays off during tests", () => {
    expect(shouldRunGuardianLoop()).toBe(false);
  });

  it("the interval is at least 5 seconds", () => {
    const previous = process.env.FLOWFORGE_LOOP_MS;
    process.env.FLOWFORGE_LOOP_MS = "100";
    expect(loopIntervalMs()).toBe(5000);
    if (previous === undefined) delete process.env.FLOWFORGE_LOOP_MS;
    else process.env.FLOWFORGE_LOOP_MS = previous;
  });
});
