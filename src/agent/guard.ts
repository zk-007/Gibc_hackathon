import { parseWorkflow, type Workflow, type WorkflowNode } from "@/workflow/schema";

export type GuardResult = {
  workflow: Workflow;
  injected: string[];
};

function isExternalSend(node: WorkflowNode): boolean {
  return node.kind === "action" && node.op === "gmail.send";
}

/**
 * The heart of Guardian: whatever workflow arrives (from the LLM or the rules),
 * re-inject the required-fields check, the policy rules, and the human gate.
 * The model is not allowed to drop these.
 */
export function enforceGuards(input: Workflow): GuardResult {
  const injected: string[] = [];
  const nodes = [...input.nodes];

  const checkIdx = nodes.findIndex((node) => node.kind === "check");
  if (checkIdx < 0) {
    nodes.unshift({
      id: "normalize",
      kind: "check",
      op: "require_fields",
      fields: ["email", "name"],
    });
    injected.push("Required fields check (email + name)");
  }

  const policyIdx = nodes.findIndex((node) => node.kind === "policy");
  if (policyIdx < 0) {
    const insertAt = nodes.findIndex((node) => node.kind !== "check");
    nodes.splice(insertAt < 0 ? nodes.length : insertAt, 0, {
      id: "guards",
      kind: "policy",
      rules: [
        "email.valid",
        "consent.marketing",
        "dedupe.email",
        "discount.limit",
      ],
    });
    injected.push("Valid email + consent + duplicate + discount policy");
  } else {
    const policy = nodes[policyIdx];
    if (policy.kind === "policy") {
      const rules = new Set(policy.rules);
      const before = rules.size;
      rules.add("email.valid");
      rules.add("consent.marketing");
      rules.add("dedupe.email");
      rules.add("discount.limit");
      if (rules.size !== before) {
        nodes[policyIdx] = { ...policy, rules: [...rules] };
        injected.push("Missing policy rules restored");
      }
    }
  }

  const sendIdx = nodes.findIndex(isExternalSend);
  if (sendIdx >= 0) {
    const gateIdx = nodes.findIndex((node) => node.kind === "gate");
    if (gateIdx < 0 || gateIdx > sendIdx) {
      if (gateIdx > sendIdx) nodes.splice(gateIdx, 1);
      nodes.splice(nodes.findIndex(isExternalSend), 0, {
        id: "human-approval",
        kind: "gate",
        when: "external_message",
        preview: "email",
      });
      injected.push("Human approval before the customer email");
    }
  }

  return { workflow: parseWorkflow({ ...input, nodes }), injected };
}
