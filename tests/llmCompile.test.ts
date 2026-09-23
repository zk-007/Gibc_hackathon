import { describe, expect, it, beforeEach } from "vitest";
import { compileBriefSmart } from "@/agent/compile";
import { enforceGuards } from "@/agent/guard";
import { extractJson } from "@/agent/llm";
import { resetActiveBrief } from "@/session/activeBrief";
import { parseWorkflow } from "@/workflow/schema";

const UNGUARDED = {
  name: "Lead welcome",
  trigger: { type: "sheets.row_added", sheet: "Leads" },
  nodes: [{ id: "send", kind: "action", op: "gmail.send" }],
};

describe("guard injection", () => {
  it("if the LLM drops the gate, Guardian puts it back", () => {
    const { workflow, injected } = enforceGuards(parseWorkflow(UNGUARDED));
    const kinds = workflow.nodes.map((node) => node.kind);

    expect(kinds).toEqual(["check", "policy", "gate", "action"]);
    expect(injected).toHaveLength(3);
  });

  it("completes a partial set of policy rules", () => {
    const { workflow } = enforceGuards(
      parseWorkflow({
        ...UNGUARDED,
        nodes: [
          { id: "p", kind: "policy", rules: ["consent.marketing"] },
          { id: "send", kind: "action", op: "gmail.send" },
        ],
      }),
    );
    const policy = workflow.nodes.find((node) => node.kind === "policy");

    expect(policy?.kind === "policy" && policy.rules).toContain("dedupe.email");
  });
});

describe("smart compile", () => {
  beforeEach(() => {
    resetActiveBrief();
  });

  it("takes the LLM workflow but applies the guards", async () => {
    const result = await compileBriefSmart("welcome new leads", async () =>
      JSON.stringify(UNGUARDED),
    );

    expect(result.source).toBe("llm");
    expect(result.workflow.nodes.some((node) => node.kind === "gate")).toBe(true);
  });

  it("garbage from the LLM falls back to the rules recipe", async () => {
    const result = await compileBriefSmart(
      "When a new lead is added to my Leads sheet, send them a welcome email (ask me before sending), and create a follow-up task in 3 days.",
      async () => "sorry, I cannot do that",
    );

    expect(result.source).toBe("rules");
    expect(result.notes.some((note) => note.includes("rejected"))).toBe(true);
    expect(result.workflow.nodes.map((node) => node.kind)).toEqual([
      "check",
      "policy",
      "gate",
      "action",
      "action",
    ]);
  });

  it("still works with no API key", async () => {
    const result = await compileBriefSmart("send a welcome email", null);
    expect(result.source).toBe("rules");
  });

  it("parses fenced JSON as well", () => {
    const parsed = extractJson("```json\n{\"a\":1}\n```");
    expect(parsed).toEqual({ a: 1 });
  });
});
