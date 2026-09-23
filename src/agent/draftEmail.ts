import type { EmailDraft } from "@/connectors/types";
import type { Lead } from "@/workflow/schema";
import {
  callLlm,
  extractJson,
  shouldUseLlm,
  type LlmComplete,
} from "./llm";

export type DraftSource = "llm" | "template";

export type DraftResult = {
  email: EmailDraft;
  source: DraftSource;
};

export const DRAFT_SYSTEM_PROMPT = `You write a short customer email for a design-studio lead tool.
Reply with JSON only: {"subject":string,"body":string}
Rules:
- 1-3 short paragraphs, professional and warm
- Use the person's name and company when given
- Do not invent discounts, prices, meetings, attachments, or phone numbers
- Do not claim they already bought something
- Plain text, no markdown
- Sign off as the studio team`;

export function templateWelcomeEmail(
  lead: Pick<Lead, "name" | "email" | "company">,
): EmailDraft {
  const name = lead.name?.trim() || "there";
  const company = lead.company?.trim() ? ` from ${lead.company.trim()}` : "";
  return {
    to: lead.email ?? "",
    subject: `Welcome, ${name}`,
    body: `Hi ${name}${company} — thanks for reaching out. Here's what happens next…`,
  };
}

export function templateFollowUpEmail(input: {
  name?: string;
  email?: string;
  title?: string;
}): EmailDraft {
  const name = input.name?.trim() || "there";
  return {
    to: input.email || "",
    subject: `Checking in, ${name}`,
    body: `Hi ${name} — just following up on our welcome note. If you'd still like to talk, reply to this email and we'll find a time.\n\n— The studio team`,
  };
}

function parseDraft(text: string, to: string): EmailDraft {
  const parsed = extractJson(text) as { subject?: unknown; body?: unknown };
  const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
  const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
  if (!subject || !body) throw new Error("Draft was missing subject or body");
  return { to, subject, body };
}

async function draftWith(
  complete: LlmComplete | null,
  prompt: string,
  fallback: EmailDraft,
): Promise<DraftResult> {
  if (!complete) return { email: fallback, source: "template" };
  try {
    const text = await complete(prompt);
    return { email: parseDraft(text, fallback.to), source: "llm" };
  } catch {
    return { email: fallback, source: "template" };
  }
}

function liveComplete(): LlmComplete | null {
  if (!shouldUseLlm()) return null;
  return (prompt) =>
    callLlm(prompt, { system: DRAFT_SYSTEM_PROMPT, temperature: 0.4 });
}

export async function draftWelcomeEmail(
  lead: Pick<Lead, "name" | "email" | "company">,
  complete: LlmComplete | null = liveComplete(),
): Promise<DraftResult> {
  const fallback = templateWelcomeEmail(lead);
  return draftWith(
    complete,
    [
      "Write the first welcome email after this person appeared on the Leads sheet.",
      `Name: ${lead.name ?? ""}`,
      `Company: ${lead.company ?? ""}`,
      `Email: ${lead.email ?? ""}`,
      "This is the first note, not a follow-up. Invite a reply. Keep it under 90 words.",
    ].join("\n"),
    fallback,
  );
}

export async function draftFollowUpEmail(
  input: { name?: string; email?: string; title?: string },
  complete: LlmComplete | null = liveComplete(),
): Promise<DraftResult> {
  const fallback = templateFollowUpEmail(input);
  return draftWith(
    complete,
    [
      "Write a short follow-up email. They already received a welcome note and have not replied.",
      `Name: ${input.name ?? ""}`,
      `Email: ${input.email ?? ""}`,
      `Internal task: ${input.title ?? "follow up"}`,
      "Do not sound pushy. Keep it under 80 words.",
    ].join("\n"),
    fallback,
  );
}
