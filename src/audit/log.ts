import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type AuditActor = "system" | "human" | "policy" | "gmail";

export type AuditEvent = {
  id: string;
  at: string;
  actor: AuditActor;
  runId: string;
  lead: string;
  event: string;
  detail: string;
};

const MAX_EVENTS = 500;

let events: AuditEvent[] = [];
let seq = 0;
let loaded = false;

function persistPath(): string {
  return path.join(process.cwd(), "data", "audit.json");
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
    const parsed = JSON.parse(readFileSync(file, "utf8")) as AuditEvent[];
    if (Array.isArray(parsed)) {
      events = parsed;
      seq = parsed.length;
    }
  } catch {
    events = [];
  }
}

function save(): void {
  if (!shouldPersist()) return;
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(persistPath(), JSON.stringify(events, null, 2), "utf8");
}

export function recordAudit(
  input: Omit<AuditEvent, "id" | "at"> & { at?: string },
): AuditEvent {
  loadIfNeeded();
  const event: AuditEvent = {
    id: `ae-${Date.now()}-${seq}`,
    at: input.at ?? new Date().toISOString(),
    actor: input.actor,
    runId: input.runId,
    lead: input.lead,
    event: input.event,
    detail: input.detail,
  };
  seq += 1;
  events.push(event);
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  save();
  return event;
}

/** Newest first — the timeline UI renders them in this order. */
export function listAudit(limit = 100): AuditEvent[] {
  loadIfNeeded();
  return [...events].reverse().slice(0, limit);
}

export function resetAudit(): void {
  events = [];
  seq = 0;
  loaded = true;
  save();
}
