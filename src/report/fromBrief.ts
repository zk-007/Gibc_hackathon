import { compileBriefSmart } from "@/agent/compile";
import { getActiveWorkflow, setActiveWorkflow } from "@/session/activeBrief";
import { generateLeads } from "@/simulate/generateLeads";
import { simulateWorkflow } from "@/simulate/runSandbox";
import { buildSafetyReport, type SafetyReport } from "./buildSafetyReport";
import type { CompileResult } from "@/agent/compileBrief";

export type BriefSafety = CompileResult & {
  report: SafetyReport;
};

export async function reportFromBrief(brief: string): Promise<BriefSafety> {
  const compiled = await compileBriefSmart(brief);
  const cached = getActiveWorkflow();
  const workflow = cached ?? compiled.workflow;
  if (!cached) setActiveWorkflow(workflow);
  const sandbox = await simulateWorkflow(workflow, generateLeads());
  return {
    workflow,
    notes: compiled.notes,
    report: buildSafetyReport(workflow, sandbox),
  };
}
