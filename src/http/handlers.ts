import { z } from "zod";
import { compileBriefSmart } from "@/agent/compile";
import { listAudit } from "@/audit/log";
import { llmStatus } from "@/agent/llm";
import { reportFromBrief } from "@/report/fromBrief";
import {
  approveRun,
  editPreview,
  executeRun,
  getRunConnectors,
  ingestLead,
  listRunBoard,
  postponeRun,
  recordApproval,
  resumeRun,
  skipRun,
} from "@/runs/memoryStore";
import {
  getActiveBrief,
  setActiveBrief,
  setActiveWorkflow,
} from "@/session/activeBrief";
import {
  gmailDeliveryMode,
  gmailRedirectTo,
  isGmailLive,
} from "@/connectors/gmail";
import { simulateBrief } from "@/simulate/fromBrief";
import { listFollowUps, processDueFollowUps } from "@/jobs/followups";
import {
  configuredSheetUrl,
  describeLeadSource,
  loadLeadsCsvText,
} from "@/triggers/loadLeadsCsv";
import { parseLeadsCsv } from "@/triggers/parseLeadsCsv";
import { syncLeadRows } from "@/triggers/syncLeadRows";
import { LeadSchema } from "@/workflow/schema";
import { errorResponse, jsonOk, readJson, routeId } from "@/http/respond";

const BriefBody = z.object({
  brief: z.string().optional(),
});

const CompileBody = z.object({
  brief: z.string(),
});

const IngestBody = z.object({
  lead: LeadSchema,
  sheet: z.string().optional(),
});

const PreviewBody = z.object({
  subject: z.string(),
  body: z.string(),
});

const ApprovalBody = z.object({
  decision: z.enum(["approve", "reject", "postpone", "resume"]),
  minutes: z.number().positive().optional(),
  execute: z.boolean().optional(),
});

const SyncBody = z.object({
  csv: z.string().optional(),
  url: z.string().optional(),
  sheet: z.string().optional(),
});

function briefFrom(body: unknown, required: boolean): string {
  if (required) {
    return CompileBody.parse(body).brief;
  }
  const parsed = BriefBody.parse(body ?? {});
  return parsed.brief?.trim() ? parsed.brief : getActiveBrief();
}

export async function handleCompile(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const brief = briefFrom(body, true);
    setActiveBrief(brief);
    const compiled = await compileBriefSmart(brief);
    setActiveWorkflow(compiled.workflow);
    return jsonOk(compiled);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleSimulate(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const brief = briefFrom(body ?? {}, false);
    const sandbox = await simulateBrief(brief);
    return jsonOk(sandbox);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleReport(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const brief = briefFrom(body ?? {}, false);
    const result = await reportFromBrief(brief);
    return jsonOk(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleIngest(request: Request): Promise<Response> {
  try {
    const body = IngestBody.parse(await readJson(request));
    const result = await ingestLead(body.lead, body.sheet);
    return jsonOk(result, result.duplicate ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleSheetSync(request: Request): Promise<Response> {
  try {
    const body = SyncBody.parse((await readJson(request)) ?? {});
    const loaded = await loadLeadsCsvText({ csv: body.csv, url: body.url });
    const leads = parseLeadsCsv(loaded.text);
    const sync = await syncLeadRows(leads, body.sheet);
    return jsonOk({ origin: loaded.origin, ...sync });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleListRuns(): Promise<Response> {
  return jsonOk(listRunBoard());
}

export async function handleApprove(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const run = await approveRun(await routeId(context));
    return jsonOk(run);
  } catch (error) {
    return errorResponse(error);
  }
}

/** Spec endpoint: POST /api/approvals/:id with approve | reject | postpone. */
export async function handleApproval(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const body = ApprovalBody.parse((await readJson(request)) ?? {});
    const id = await routeId(context);
    if (body.decision === "reject") return jsonOk(await skipRun(id));
    if (body.decision === "postpone") {
      return jsonOk(await postponeRun(id, body.minutes ?? 60));
    }
    if (body.decision === "resume") return jsonOk(resumeRun(id));
    const approved = await recordApproval(id);
    if (body.execute === false) return jsonOk(approved);
    return jsonOk(await executeRun(id));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Spec endpoint: POST /api/execute/:id — runs the actions of an approved run. */
export async function handleExecute(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    return jsonOk(await executeRun(await routeId(context)));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleSkip(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const run = await skipRun(await routeId(context));
    return jsonOk(run);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handlePreview(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const body = PreviewBody.parse(await readJson(request));
    const run = editPreview(await routeId(context), body);
    return jsonOk(run);
  } catch (error) {
    return errorResponse(error);
  }
}

export function handleHealth(): Response {
  return jsonOk({ ok: true, service: "flowforge-guardian" });
}

export function handleGmailStatus(): Response {
  return jsonOk({
    live: isGmailLive(),
    deliver: gmailDeliveryMode(),
    redirectTo: gmailRedirectTo(),
  });
}

export function handleTriggerStatus(): Response {
  return jsonOk({
    source: describeLeadSource(),
    sheetUrl: configuredSheetUrl(),
  });
}

export async function handleFollowupTick(): Promise<Response> {
  try {
    const due = await processDueFollowUps((email) => getRunConnectors().gmail.send(email));
    return jsonOk({ processed: due.length, jobs: listFollowUps() });
  } catch (error) {
    return errorResponse(error);
  }
}

export function handleFollowupList(): Response {
  return jsonOk({ jobs: listFollowUps() });
}

export function handleAudit(): Response {
  return jsonOk({ events: listAudit() });
}

export function handleLlmStatus(): Response {
  return jsonOk(llmStatus());
}
