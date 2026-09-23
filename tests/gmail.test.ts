import { describe, expect, it } from "vitest";
import { createOutboxConnectors } from "@/connectors/gmail";
import { ali } from "@/fixtures/leads";
import { ingestLead, resetRunStore, approveRun } from "@/runs/memoryStore";
import { resetActiveBrief } from "@/session/activeBrief";

describe("gmail live send (injected)", () => {
  it("outbox keeps the original recipient; the real send goes to the redirect", async () => {
    const delivered: Array<{ to: string; subject: string; text: string }> = [];
    const connectors = createOutboxConnectors(async (message) => {
      delivered.push(message);
    });

    await connectors.gmail.send({
      to: "ali@northstar.co",
      subject: "Welcome, Ali",
      body: "Hi Ali",
    });

    expect(connectors.outbox.emails[0]?.to).toBe("ali@northstar.co");
    expect(delivered[0]?.to).not.toBe("ali@northstar.co");
    expect(delivered[0]?.subject).toContain("ali@northstar.co");
    expect(delivered[0]?.text).toContain("Hi Ali");
  });

  it("with GMAIL_DELIVER=live the SMTP recipient is the lead", async () => {
    const delivered: Array<{ to: string; subject: string }> = [];
    const connectors = createOutboxConnectors(async (message) => {
      delivered.push(message);
    }, "live");

    await connectors.gmail.send({
      to: "ali@northstar.co",
      subject: "Welcome, Ali",
      body: "Hi Ali",
    });

    expect(delivered[0]?.to).toBe("ali@northstar.co");
    expect(delivered[0]?.subject).toBe("Welcome, Ali");
  });
});

describe("approve still mock without env", () => {
  it("without Gmail env vars, approve only fills the mock outbox", async () => {
    resetActiveBrief();
    resetRunStore();
    const { run } = await ingestLead(ali);
    const done = await approveRun(run.id);
    expect(done.status).toBe("SUCCESS");
  });
});
