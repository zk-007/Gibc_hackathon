import { maxDiscountPercent } from "@/policy/evaluate";
import type { Lead } from "@/workflow/schema";

export type LeadScenario =
  | "complete_consented"
  | "vip"
  | "missing_consent"
  | "incomplete"
  | "invalid_email"
  | "excessive_discount"
  | "duplicate";

export type SyntheticLead = Lead & {
  scenario: LeadScenario;
};

export type GenerateLeadsOptions = {
  consented?: number;
  vip?: number;
  missingConsent?: number;
  incomplete?: number;
  invalidEmail?: number;
  excessiveDiscount?: number;
  duplicates?: number;
};

/**
 * Spec ki edge-case list: valid, VIP, no consent, missing email, invalid email,
 * excessive discount, duplicate.
 */
export function generateLeads(options: GenerateLeadsOptions = {}): SyntheticLead[] {
  const consented = options.consented ?? 12;
  const vip = options.vip ?? 1;
  const missingConsent = options.missingConsent ?? 2;
  const incomplete = options.incomplete ?? 1;
  const invalidEmail = options.invalidEmail ?? 1;
  const excessiveDiscount = options.excessiveDiscount ?? 1;
  const duplicates = options.duplicates ?? 2;

  const leads: SyntheticLead[] = [];
  let n = 1;

  for (let i = 0; i < consented; i += 1) {
    leads.push(makeLead(n, "complete_consented", { consentMarketing: true }));
    n += 1;
  }

  for (let i = 0; i < vip; i += 1) {
    leads.push(
      makeLead(n, "vip", { consentMarketing: true, company: `VIP Holdings ${n}` }),
    );
    n += 1;
  }

  for (let i = 0; i < missingConsent; i += 1) {
    leads.push(makeLead(n, "missing_consent", { consentMarketing: false }));
    n += 1;
  }

  for (let i = 0; i < incomplete; i += 1) {
    leads.push(makeLead(n, "incomplete", { consentMarketing: true, email: "" }));
    n += 1;
  }

  for (let i = 0; i < invalidEmail; i += 1) {
    leads.push(
      makeLead(n, "invalid_email", {
        consentMarketing: true,
        email: `lead${n}-at-sandbox`,
      }),
    );
    n += 1;
  }

  for (let i = 0; i < excessiveDiscount; i += 1) {
    leads.push(
      makeLead(n, "excessive_discount", {
        consentMarketing: true,
        discountPercent: maxDiscountPercent() + 40,
      }),
    );
    n += 1;
  }

  const original = leads.find((lead) => lead.scenario === "complete_consented");
  for (let i = 0; i < duplicates; i += 1) {
    if (!original) break;
    leads.push({
      ...makeLead(n, "duplicate", { consentMarketing: true }),
      email: original.email,
      name: `${original.name} copy`,
    });
    n += 1;
  }

  return leads;
}

function makeLead(
  n: number,
  scenario: LeadScenario,
  extra: Partial<Lead>,
): SyntheticLead {
  return {
    id: `syn-${n}`,
    name: `Lead ${n}`,
    email: `lead${n}@sandbox.test`,
    company: `Sandbox Co ${n}`,
    consentMarketing: true,
    scenario,
    ...extra,
  };
}
