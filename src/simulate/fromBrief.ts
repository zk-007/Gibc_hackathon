import { compileBriefSmart } from "@/agent/compile";
import { getActiveWorkflow, setActiveWorkflow } from "@/session/activeBrief";
import { generateLeads } from "./generateLeads";
import { simulateWorkflow, type SandboxReport } from "./runSandbox";

export async function simulateBrief(brief: string): Promise<SandboxReport> {
  const cached = getActiveWorkflow();
  const workflow = cached ?? (await compileBriefSmart(brief)).workflow;
  if (!cached) setActiveWorkflow(workflow);
  return simulateWorkflow(workflow, generateLeads());
}
