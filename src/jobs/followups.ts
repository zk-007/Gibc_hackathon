import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { draftFollowUpEmail } from "@/agent/draftEmail";
import { recordAudit } from "@/audit/log";
import type { EmailDraft, FollowUpTask } from "@/connectors/types";

export type FollowUpJob = {
  id: string;
  title: string;
  leadId: string;
  email: string;
  name: string;
  requestedDelay: string;
  waitMs: number;
  dueAt: number;
  status: "scheduled" | "sent" | "failed";
  error?: string;
};

let jobs: FollowUpJob[] = [];
let seq = 0;
let loaded = false;

function persistPath(): string {
  return path.join(process.cwd(), "data", "followups.json");
}

function shouldPersist(): boolean {
  return process.env.VITEST !== "true" && process.env.NODE_ENV !== "test";
}

function loadIfNeeded(): void {
  if (loaded) return;
  loaded = true;
  if (!shouldPersist()) return;
  try {
    const file = persistPath();
    if (!existsSync(file)) return;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as FollowUpJob[];
    if (Array.isArray(parsed)) {
      jobs = parsed;
      seq = parsed.length;
    }
  } catch {
    jobs = [];
  }
}

function save(): void {
  if (!shouldPersist()) return;
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(persistPath(), JSON.stringify(jobs, null, 2), "utf8");
}

export function resetFollowUps(): void {
  jobs = [];
  seq = 0;
  loaded = true;
  save();
}

export function delayToMs(delay: string): number {
  const override = process.env.FLOWFORGE_FOLLOWUP_MS;
  if (override !== undefined && override !== "" && Number.isFinite(Number(override))) {
    return Math.max(0, Number(override));
  }
  const match = delay.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!match) return 3 * 24 * 60 * 60 * 1000;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return (((days * 24 + hours) * 60 + minutes) * 60 * 1000) || 0;
}

export function scheduleFollowUp(task: FollowUpTask): FollowUpJob {
  loadIfNeeded();
  const waitMs = delayToMs(task.delay);
  const job: FollowUpJob = {
    id: `fu-${Date.now()}-${seq}`,
    title: task.title,
    leadId: task.leadId,
    email: task.email ?? "",
    name: task.name ?? "",
    requestedDelay: task.delay,
    waitMs,
    dueAt: Date.now() + waitMs,
    status: "scheduled",
  };
  seq += 1;
  jobs.push(job);
  recordAudit({
    actor: "system",
    runId: `leads:${task.leadId}`,
    lead: task.email ?? task.leadId,
    event: "follow-up scheduled",
    detail: `${task.title} · waits ${task.delay}`,
  });
  save();
  return job;
}

export function listFollowUps(): FollowUpJob[] {
  loadIfNeeded();
  return [...jobs];
}

export async function processDueFollowUps(
  send: (email: EmailDraft) => Promise<void>,
  now = Date.now(),
): Promise<FollowUpJob[]> {
  loadIfNeeded();
  const due = jobs.filter((job) => job.status === "scheduled" && job.dueAt <= now);
  for (const job of due) {
    try {
      const to = job.email || "unknown@local";
      const drafted = await draftFollowUpEmail({
        name: job.name,
        email: to,
        title: job.title,
      });
      await send(drafted.email);
      job.status = "sent";
      recordAudit({
        actor: "gmail",
        runId: `leads:${job.leadId}`,
        lead: to,
        event: "follow-up sent",
        detail: `${job.title} · ${drafted.source} draft`,
      });
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Follow-up failed";
      recordAudit({
        actor: "gmail",
        runId: `leads:${job.leadId}`,
        lead: job.email || job.leadId,
        event: "follow-up failed",
        detail: job.error,
      });
    }
  }
  if (due.length > 0) save();
  return due;
}
