import type { Workflow } from "./schema";

/** Golden-path recipe for the hackathon demo. Compiler (Slice 3) will emit this. */
export const leadWelcomeWorkflow: Workflow = {
  name: "Lead welcome sequence",
  trigger: { type: "sheets.row_added", sheet: "Leads" },
  nodes: [
    {
      id: "normalize",
      kind: "check",
      op: "require_fields",
      fields: ["email", "name"],
    },
    {
      id: "guards",
      kind: "policy",
      rules: ["consent.marketing", "dedupe.email"],
    },
    {
      id: "human-approval",
      kind: "gate",
      when: "external_message",
      preview: "email",
    },
    { id: "welcome-email", kind: "action", op: "gmail.send" },
    {
      id: "follow-up-task",
      kind: "action",
      op: "tasks.create",
      delay: "P3D",
    },
  ],
};
