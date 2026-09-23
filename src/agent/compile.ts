import { compileBrief, type CompileResult } from "./compileBrief";
import { enforceGuards } from "./guard";
import { callLlm, extractJson, llmModel, shouldUseLlm, type LlmComplete } from "./llm";
import { WorkflowSchema } from "@/workflow/schema";

export type SmartCompileResult = CompileResult & {
  source: "llm" | "rules";
};

/**
 * Ask the LLM for a workflow first (when a key is set). Its reply goes through
 * the schema and the guards are re-applied. If anything is wrong, the
 * deterministic recipe takes over, so the demo never breaks.
 */
export async function compileBriefSmart(
  brief: string,
  complete: LlmComplete | null = shouldUseLlm() ? callLlm : null,
): Promise<SmartCompileResult> {
  const fallback = (): SmartCompileResult => ({
    ...compileBrief(brief),
    source: "rules",
  });

  if (!brief.trim()) return fallback();
  if (!complete) {
    const rules = fallback();
    return {
      ...rules,
      notes: [...rules.notes, "Rule compiler (no LLM key set)"],
    };
  }

  try {
    const parsed = WorkflowSchema.parse(extractJson(await complete(brief)));
    const { workflow, injected } = enforceGuards(parsed);
    const notes = [
      `Model ${llmModel()} wrote the workflow; Guardian verified it`,
      ...injected.map((item) => `Guardian re-injected: ${item}`),
    ];
    return { workflow, notes, source: "llm" };
  } catch (error) {
    const rules = fallback();
    const why = error instanceof Error ? error.message : "unknown error";
    return {
      ...rules,
      notes: [...rules.notes, `LLM output rejected (${why}) — safe recipe used`],
    };
  }
}
