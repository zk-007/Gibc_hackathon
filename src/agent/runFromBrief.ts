import { compileBrief } from "@/agent/compileBrief";
import type { CompileResult } from "@/agent/compileBrief";
import { startRun, type RunContext } from "@/engine/execute";
import type { WorkflowRun } from "@/engine/types";
import type { Lead } from "@/workflow/schema";

export type BriefRun = CompileResult & {
  run: WorkflowRun;
};

/** User ki sentence se recipe banao, phir usi recipe ko lead pe chalao. */
export async function startRunFromBrief(
  brief: string,
  lead: Lead,
  ctx: RunContext,
): Promise<BriefRun> {
  const compiled = compileBrief(brief);
  const run = await startRun(compiled.workflow, lead, ctx);
  return { ...compiled, run };
}
