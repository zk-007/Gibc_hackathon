import { z } from "zod";

export const LeadSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  email: z.string().optional(),
  company: z.string().optional(),
  consentMarketing: z.boolean().optional(),
  /** Offer discount percent, optionally carried by a sheet row. */
  discountPercent: z.number().optional(),
});

export const TriggerSchema = z.object({
  type: z.literal("sheets.row_added"),
  sheet: z.string().min(1),
});

export const CheckNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("check"),
  op: z.literal("require_fields"),
  fields: z.array(z.enum(["email", "name", "company"])).min(1),
});

export const PolicyNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("policy"),
  rules: z
    .array(
      z.enum([
        "email.valid",
        "consent.marketing",
        "dedupe.email",
        "discount.limit",
      ]),
    )
    .min(1),
});

export const GateNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("gate"),
  when: z.literal("external_message"),
  preview: z.literal("email"),
});

export const ActionNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("action"),
  op: z.enum(["gmail.send", "tasks.create"]),
  delay: z.string().optional(),
});

export const WorkflowNodeSchema = z.discriminatedUnion("kind", [
  CheckNodeSchema,
  PolicyNodeSchema,
  GateNodeSchema,
  ActionNodeSchema,
]);

export const WorkflowSchema = z.object({
  name: z.string().min(1),
  trigger: TriggerSchema,
  nodes: z.array(WorkflowNodeSchema).min(1),
});

export type Lead = z.infer<typeof LeadSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type LeadField = "email" | "name" | "company";
export type PolicyRule =
  | "email.valid"
  | "consent.marketing"
  | "dedupe.email"
  | "discount.limit";

export function parseWorkflow(input: unknown): Workflow {
  return WorkflowSchema.parse(input);
}
