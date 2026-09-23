import type { SheetSyncResult } from "@/triggers/syncLeadRows";
import type { FollowUpJob } from "@/jobs/followups";

export function shouldRunGuardianLoop(): boolean {
  return (
    process.env.VITEST !== "true" &&
    process.env.NODE_ENV !== "test" &&
    process.env.FLOWFORGE_LOOP !== "off"
  );
}

export function loopIntervalMs(): number {
  const raw = process.env.FLOWFORGE_LOOP_MS;
  const parsed = raw !== undefined && raw !== "" ? Number(raw) : 15_000;
  if (!Number.isFinite(parsed)) return 15_000;
  return Math.max(5_000, parsed);
}

export type GuardianTickResult = {
  followups: FollowUpJob[];
  sync: SheetSyncResult | null;
};

export async function runGuardianTick(): Promise<GuardianTickResult> {
  const { getRunConnectors } = await import("@/runs/memoryStore");
  const { processDueFollowUps } = await import("@/jobs/followups");
  const followups = await processDueFollowUps((email) =>
    getRunConnectors().gmail.send(email),
  );

  if (!process.env.SHEETS_CSV_URL?.trim()) {
    return { followups, sync: null };
  }

  const { loadLeadsCsvText } = await import("@/triggers/loadLeadsCsv");
  const { parseLeadsCsv } = await import("@/triggers/parseLeadsCsv");
  const { syncLeadRows } = await import("@/triggers/syncLeadRows");
  const loaded = await loadLeadsCsvText({});
  const sync = await syncLeadRows(parseLeadsCsv(loaded.text));
  return { followups, sync };
}

let timer: ReturnType<typeof setInterval> | undefined;

export function startGuardianLoop(): void {
  if (!shouldRunGuardianLoop() || timer) return;
  const ms = loopIntervalMs();
  const tick = () => {
    void runGuardianTick().catch(() => {
      // Keep the loop alive if one sheet/Gmail tick fails.
    });
  };
  tick();
  timer = setInterval(tick, ms);
  timer.unref?.();
}
