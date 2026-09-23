import type { PolicyRule, WorkflowNode } from "./schema";
import { isoDelayLabel } from "@/jobs/delayCopy";
import { maxDiscountPercent } from "@/policy/evaluate";

export function ruleLabel(rule: PolicyRule): string {
  if (rule === "email.valid") return "valid email";
  if (rule === "consent.marketing") return "consent";
  if (rule === "dedupe.email") return "no duplicates";
  return `discount max ${maxDiscountPercent()}%`;
}

export function nodeCaption(node: WorkflowNode): { kind: string; title: string; sub: string } {
  if (node.kind === "check") {
    return {
      kind: "CHECK",
      title: "Missing details",
      sub: `Need ${node.fields.join(" and ")}`,
    };
  }
  if (node.kind === "policy") {
    return {
      kind: "RULES",
      title: "Safety checks",
      sub: node.rules.map(ruleLabel).join(" · "),
    };
  }
  if (node.kind === "gate") {
    return {
      kind: "YOU",
      title: "Your approval",
      sub: "Preview the email first",
    };
  }
  if (node.op === "gmail.send") {
    return { kind: "EMAIL", title: "Welcome email", sub: "Sent after you approve" };
  }
  return {
    kind: "EMAIL",
    title: "Reminder",
    sub: node.delay ? `${isoDelayLabel(node.delay)} later` : "Follow up",
  };
}
