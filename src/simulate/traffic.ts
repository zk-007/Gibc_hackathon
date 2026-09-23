import type { Workflow } from "@/workflow/schema";
import type { SandboxReport } from "./runSandbox";
import type { LeadScenario } from "./generateLeads";

export type NodeTraffic = {
  nodeId: string;
  paused: number;
  blocked: number;
  review: number;
};

export function trafficByNode(workflow: Workflow, sandbox: SandboxReport): NodeTraffic[] {
  return workflow.nodes.map((node) => {
    const atNode = sandbox.cases.filter((item) => item.nodeId === node.id);
    return {
      nodeId: node.id,
      paused: atNode.filter((item) => item.status === "NEEDS_APPROVAL").length,
      blocked: atNode.filter((item) => item.status === "BLOCKED").length,
      review: atNode.filter((item) => item.status === "REVIEW").length,
    };
  });
}

export function countScenario(
  sandbox: SandboxReport,
  scenario: LeadScenario,
): number {
  return sandbox.cases.filter((item) => item.scenario === scenario).length;
}
