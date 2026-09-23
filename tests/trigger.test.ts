import { describe, expect, it, beforeEach } from "vitest";
import { handleSheetSync } from "@/http/handlers";
import { outboxEmails, resetRunStore } from "@/runs/memoryStore";
import { resetActiveBrief } from "@/session/activeBrief";
import { parseLeadsCsv } from "@/triggers/parseLeadsCsv";
import { syncLeadRows } from "@/triggers/syncLeadRows";
import { toSheetCsvUrl } from "@/triggers/loadLeadsCsv";

const SAMPLE = `id,name,email,company,consentMarketing
ali,Ali,ali@northstar.co,Northstar Studio,true
jo,Jo,jo@atelierform.co,Atelier Form,true
maya,Maya,maya@orbitgoods.com,Orbit Goods,false
`;

describe("leads CSV parse", () => {
  it("reads 3 leads from a header row and parses consent as boolean", () => {
    const leads = parseLeadsCsv(SAMPLE);
    expect(leads).toHaveLength(3);
    expect(leads[0]).toMatchObject({ id: "ali", consentMarketing: true });
    expect(leads[2]).toMatchObject({ id: "maya", consentMarketing: false });
  });

  it("a data row without a header still becomes a lead", () => {
    const leads = parseLeadsCsv(
      "zoha,Zoha,zoha@example.com,FlowForge,TRUE",
    );
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      id: "zoha",
      name: "Zoha",
      email: "zoha@example.com",
      consentMarketing: true,
    });
  });
});

describe("sheet sync trigger", () => {
  beforeEach(() => {
    resetActiveBrief();
    resetRunStore();
  });

  it("first sync: new rows ingested, Maya blocked, zero Gmail", async () => {
    const result = await syncLeadRows(parseLeadsCsv(SAMPLE));
    expect(result.rowsSeen).toBe(3);
    expect(result.newRows).toBe(3);
    expect(result.alreadySeen).toBe(0);
    expect(result.pending).toBe(2);
    expect(result.blocked).toBe(1);
    expect(outboxEmails()).toHaveLength(0);
  });

  it("second sync: no new runs — re-reading the sheet is safe", async () => {
    await syncLeadRows(parseLeadsCsv(SAMPLE));
    const second = await syncLeadRows(parseLeadsCsv(SAMPLE));
    expect(second.newRows).toBe(0);
    expect(second.alreadySeen).toBe(3);
    expect(outboxEmails()).toHaveLength(0);
  });

  it("adding a row to the sheet ingests only that row", async () => {
    await syncLeadRows(parseLeadsCsv(SAMPLE));
    const withSam = `${SAMPLE}sam,Sam,sam@fieldnote.io,Fieldnote,true\n`;
    const result = await syncLeadRows(parseLeadsCsv(withSam));
    expect(result.newRows).toBe(1);
    expect(result.alreadySeen).toBe(3);
    expect(result.runs.some((run) => run.email === "sam@fieldnote.io")).toBe(true);
  });

  it("POST /api/triggers/sync works from a CSV body", async () => {
    const response = await handleSheetSync(
      new Request("http://local/api/triggers/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv: SAMPLE }),
      }),
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.origin).toBe("body");
    expect(data.newRows).toBe(3);
    expect(data.pending).toBe(2);
  });
});

describe("Google Sheet URL", () => {
  it("turns an edit link into a CSV export URL", () => {
    expect(
      toSheetCsvUrl(
        "https://docs.google.com/spreadsheets/d/abc123XYZ/edit?usp=sharing#gid=0",
      ),
    ).toBe(
      "https://docs.google.com/spreadsheets/d/abc123XYZ/export?format=csv&gid=0",
    );
  });

  it("leaves an already published CSV URL untouched", () => {
    const pub =
      "https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?output=csv";
    expect(toSheetCsvUrl(pub)).toBe(pub);
  });
});
