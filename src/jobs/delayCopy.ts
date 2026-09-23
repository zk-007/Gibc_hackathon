/** Human labels for ISO-8601 delays like P3D. Recipe vs demo clock. */
export function isoDelayLabel(delay: string): string {
  const match = delay.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!match) return delay;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  if (days) return `${days} day${days === 1 ? "" : "s"}`;
  if (hours) return `${hours} hour${hours === 1 ? "" : "s"}`;
  if (minutes) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return delay;
}

export function demoWaitLabel(waitMs: number): string {
  if (waitMs >= 24 * 60 * 60 * 1000) {
    const days = Math.round(waitMs / (24 * 60 * 60 * 1000));
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (waitMs >= 60 * 60 * 1000) {
    const hours = Math.round(waitMs / (60 * 60 * 1000));
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (waitMs >= 60_000) {
    const minutes = Math.round(waitMs / 60_000);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return `${Math.max(0, Math.round(waitMs / 1000))} seconds`;
}

export function followUpExplain(job: {
  requestedDelay: string;
  waitMs: number;
}): string {
  const recipe = isoDelayLabel(job.requestedDelay);
  const clock = demoWaitLabel(job.waitMs);
  const compressed = job.waitMs < 12 * 60 * 60 * 1000;
  if (compressed) {
    return `Reminder in ${recipe} (demo: ${clock}).`;
  }
  return `Reminder in ${recipe}.`;
}
