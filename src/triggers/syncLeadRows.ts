import { ingestLead, type RunSnapshot } from "@/runs/memoryStore";
import type { Lead } from "@/workflow/schema";

export type SheetSyncResult = {
  rowsSeen: number;
  newRows: number;
  alreadySeen: number;
  pending: number;
  blocked: number;
  runs: RunSnapshot[];
};

/** Ingest every sheet/CSV row. The same id is skipped the second time. */
export async function syncLeadRows(
  leads: Lead[],
  sheet?: string,
): Promise<SheetSyncResult> {
  const runs: RunSnapshot[] = [];
  let newRows = 0;
  let alreadySeen = 0;

  for (const lead of leads) {
    const result = await ingestLead(lead, sheet);
    runs.push(result.run);
    if (result.duplicate) alreadySeen += 1;
    else newRows += 1;
  }

  return {
    rowsSeen: leads.length,
    newRows,
    alreadySeen,
    pending: runs.filter((run) => run.status === "NEEDS_APPROVAL").length,
    blocked: runs.filter((run) => run.status === "BLOCKED").length,
    runs,
  };
}
