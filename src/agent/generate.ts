import { compileBrief } from "@/agent/compileBrief";
import { resetAndSeedDemoRuns } from "@/runs/memoryStore";
import { setActiveBrief } from "@/session/activeBrief";
import { generateLeads } from "@/simulate/generateLeads";
import { simulateWorkflow } from "@/simulate/runSandbox";
import type { CompileResult } from "@/agent/compileBrief";

export type GenerateResult = CompileResult & {
  sandbox: {
    tested: number;
    passed: number;
    blocked: number;
    emailsSent: number;
  };
};

export async function generateFromBrief(brief: string): Promise<GenerateResult> {
  const compiled = compileBrief(brief);
  setActiveBrief(brief);
  const sandbox = await simulateWorkflow(compiled.workflow, generateLeads());
  await resetAndSeedDemoRuns();
  return {
    ...compiled,
    sandbox: {
      tested: sandbox.tested,
      passed: sandbox.passed,
      blocked: sandbox.blocked,
      emailsSent: sandbox.emailsSent,
    },
  };
}
