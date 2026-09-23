import { describe, expect, it, beforeEach } from "vitest";
import { GOLDEN_LEAD_BRIEF } from "@/agent/golden";
import { ali } from "@/fixtures/leads";
import {
  handleApproval,
  handleApprove,
  handleCompile,
  handleExecute,
  handleHealth,
  handleIngest,
  handleListRuns,
  handleReport,
  handleSimulate,
  handleSkip,
} from "@/http/handlers";
import { ingestLead, outboxEmails, resetRunStore } from "@/runs/memoryStore";
import { resetActiveBrief } from "@/session/activeBrief";

function post(url: string, body?: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("ingest idempotency", () => {
  beforeEach(() => {
    resetActiveBrief();
    resetRunStore();
  });

  it("the same sheet row twice does not create a second email", async () => {
    const first = await ingestLead(ali);
    const second = await ingestLead(ali);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.ingestKey).toBe("leads:ali");
    expect(second.run.id).toBe(first.run.id);
    expect(outboxEmails()).toHaveLength(0);
  });

  it("re-ingesting an approved row does not send again", async () => {
    const { run } = await ingestLead(ali);
    const approve = await handleApprove(post("http://local/approve"), {
      params: { id: run.id },
    });
    expect(approve.status).toBe(200);
    expect(outboxEmails()).toHaveLength(1);

    const again = await ingestLead(ali);
    expect(again.duplicate).toBe(true);
    expect(outboxEmails()).toHaveLength(1);
  });

  it("retries a blocked row after name and email are filled in", async () => {
    const first = await ingestLead({ id: "ansa", consentMarketing: true });
    expect(first.run.status).toBe("BLOCKED");

    const second = await ingestLead({
      id: "ansa",
      name: "Ansa",
      email: "ansa@studio.test",
      company: "FlowForge",
      consentMarketing: true,
    });

    expect(second.duplicate).toBe(false);
    expect(second.run.status).toBe("NEEDS_APPROVAL");
    expect(second.run.email).toBe("ansa@studio.test");
    expect(outboxEmails()).toHaveLength(0);
  });
});

describe("HTTP API", () => {
  beforeEach(() => {
    resetActiveBrief();
    resetRunStore();
  });

  it("GET health", async () => {
    const response = handleHealth();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it("POST compile returns the golden recipe", async () => {
    const response = await handleCompile(
      post("http://local/api/compile", { brief: GOLDEN_LEAD_BRIEF }),
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.workflow.nodes.map((node: { kind: string }) => node.kind)).toEqual([
      "check",
      "policy",
      "gate",
      "action",
      "action",
    ]);
  });

  it("POST compile rejects an empty brief with 400", async () => {
    const response = await handleCompile(post("http://local/api/compile", { brief: "  " }));
    expect(response.status).toBe(400);
  });

  it("POST simulate counts 13 passed and 5 blocked", async () => {
    const response = await handleSimulate(
      post("http://local/api/simulate", { brief: GOLDEN_LEAD_BRIEF }),
    );
    const data = await response.json();
    expect(data.passed).toBe(13);
    expect(data.blocked).toBe(5);
    expect(data.emailsSent).toBe(0);
  });

  it("POST approvals with a reject decision sends nothing", async () => {
    const { run } = await ingestLead(ali);
    const response = await handleApproval(
      post("http://local/api/approvals", { decision: "reject" }),
      { params: { id: run.id } },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("SKIPPED");
    expect(outboxEmails()).toHaveLength(0);
  });

  it("POST approvals postpones a run, then resumes it", async () => {
    const { run } = await ingestLead(ali);
    const snoozed = await handleApproval(
      post("http://local/api/approvals", { decision: "postpone", minutes: 30 }),
      { params: { id: run.id } },
    );
    expect((await snoozed.json()).status).toBe("POSTPONED");
    expect(outboxEmails()).toHaveLength(0);

    const resumed = await handleApproval(
      post("http://local/api/approvals", { decision: "resume" }),
      { params: { id: run.id } },
    );
    expect((await resumed.json()).status).toBe("NEEDS_APPROVAL");
  });

  it("approve alone holds the send; execute delivers it", async () => {
    const { run } = await ingestLead(ali);
    const approved = await handleApproval(
      post("http://local/api/approvals", { decision: "approve", execute: false }),
      { params: { id: run.id } },
    );
    expect((await approved.json()).status).toBe("APPROVED");
    expect(outboxEmails()).toHaveLength(0);

    const executed = await handleExecute(post("http://local/api/execute"), {
      params: { id: run.id },
    });
    expect((await executed.json()).status).toBe("SUCCESS");
    expect(outboxEmails()).toHaveLength(1);
  });

  it("POST report returns 92 percent", async () => {
    const response = await handleReport(
      post("http://local/api/report", { brief: GOLDEN_LEAD_BRIEF }),
    );
    const data = await response.json();
    expect(data.report.safeToEnablePercent).toBe(92);
    expect(data.report.risk).toBe("medium");
  });

  it("ingest → list → approve works over JSON", async () => {
    const created = await handleIngest(post("http://local/api/ingest", { lead: ali }));
    expect(created.status).toBe(201);
    const createdBody = await created.json();

    const listed = await handleListRuns();
    const board = await listed.json();
    expect(board.pending).toHaveLength(1);

    const approved = await handleApprove(post("http://local/approve"), {
      params: { id: createdBody.run.id },
    });
    expect(approved.status).toBe(200);
    expect(outboxEmails()).toHaveLength(1);

    const skippedMissing = await handleSkip(post("http://local/skip"), {
      params: { id: "leads:missing" },
    });
    expect(skippedMissing.status).toBe(404);
  });
});
