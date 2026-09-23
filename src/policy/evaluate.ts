import type { Lead, PolicyRule } from "@/workflow/schema";

export type Severity = "high" | "medium";

export type PolicyVerdict =
  | { ok: true }
  | { ok: false; status: "BLOCKED" | "REVIEW"; reason: string; severity: Severity };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function missingRequiredFields(
  lead: Lead,
  fields: Array<"email" | "name" | "company">,
): string[] {
  return fields.filter((field) => {
    const value = lead[field];
    return !value || value.trim() === "";
  });
}

export function maxDiscountPercent(): number {
  const raw = Number(process.env.FLOWFORGE_MAX_DISCOUNT);
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

export function isValidEmail(value: string | undefined): boolean {
  return EMAIL_SHAPE.test((value ?? "").trim());
}

export function evaluateRule(
  rule: PolicyRule,
  lead: Lead,
  seenEmails: Set<string>,
): PolicyVerdict {
  const email = lead.email?.trim().toLowerCase();

  if (rule === "email.valid") {
    if (isValidEmail(email)) return { ok: true };
    return {
      ok: false,
      status: "BLOCKED",
      reason: "Email address is not a valid address",
      severity: "high",
    };
  }

  if (rule === "consent.marketing") {
    if (lead.consentMarketing === true) return { ok: true };
    return {
      ok: false,
      status: "BLOCKED",
      reason: "No marketing consent field found",
      severity: "high",
    };
  }

  if (rule === "discount.limit") {
    const offered = lead.discountPercent;
    if (offered === undefined || Number.isNaN(offered)) return { ok: true };
    if (offered <= maxDiscountPercent()) return { ok: true };
    return {
      ok: false,
      status: "BLOCKED",
      reason: `Discount ${offered}% is over the ${maxDiscountPercent()}% limit`,
      severity: "high",
    };
  }

  if (!email) {
    return {
      ok: false,
      status: "BLOCKED",
      reason: "Email is required for dedupe",
      severity: "high",
    };
  }
  if (seenEmails.has(email)) {
    return {
      ok: false,
      status: "REVIEW",
      reason: "Duplicate lead suspected",
      severity: "medium",
    };
  }
  return { ok: true };
}
