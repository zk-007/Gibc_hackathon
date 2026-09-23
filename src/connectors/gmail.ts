import type { Connectors, EmailDraft, FollowUpTask } from "./types";
import { scheduleFollowUp } from "@/jobs/followups";

export type OutboxConnectors = Connectors & {
  outbox: {
    emails: EmailDraft[];
    tasks: FollowUpTask[];
  };
};

export type MailSender = (message: {
  from: string;
  to: string;
  subject: string;
  text: string;
}) => Promise<void>;

export type GmailDelivery = "mock" | "redirect" | "live";

export function isGmailLive(): boolean {
  return (
    process.env.FLOWFORGE_MAIL === "gmail" &&
    Boolean(process.env.GMAIL_USER?.trim()) &&
    Boolean(process.env.GMAIL_APP_PASSWORD?.trim())
  );
}

export function gmailDeliveryMode(): GmailDelivery {
  if (!isGmailLive()) return "mock";
  const mode = process.env.GMAIL_DELIVER?.trim().toLowerCase();
  if (mode === "live") return "live";
  return "redirect";
}

function smtpDelivery(): "redirect" | "live" {
  return process.env.GMAIL_DELIVER?.trim().toLowerCase() === "live"
    ? "live"
    : "redirect";
}

export function gmailRedirectTo(): string | null {
  if (gmailDeliveryMode() !== "redirect") return null;
  return (
    process.env.GMAIL_REDIRECT_TO?.trim() ||
    process.env.GMAIL_USER?.trim() ||
    null
  );
}

export function createOutboxConnectors(
  sendLive?: MailSender,
  delivery: "redirect" | "live" = smtpDelivery(),
): OutboxConnectors {
  const emails: EmailDraft[] = [];
  const tasks: FollowUpTask[] = [];
  const from = process.env.GMAIL_USER?.trim() || "flowforge@local";
  const redirect =
    process.env.GMAIL_REDIRECT_TO?.trim() ||
    process.env.GMAIL_USER?.trim() ||
    from;

  return {
    gmail: {
      async send(email) {
        emails.push(email);
        if (!sendLive) return;
        if (delivery === "live") {
          await sendLive({
            from,
            to: email.to,
            subject: email.subject,
            text: email.body,
          });
          return;
        }
        await sendLive({
          from,
          to: redirect,
          subject: `[FlowForge → ${email.to}] ${email.subject}`,
          text: `Intended recipient: ${email.to}\n\n${email.body}`,
        });
      },
    },
    tasks: {
      async create(task) {
        tasks.push(task);
        scheduleFollowUp(task);
      },
    },
    outbox: { emails, tasks },
  };
}

export function createAppConnectors(): OutboxConnectors {
  if (!isGmailLive()) {
    return createOutboxConnectors();
  }
  let sender: MailSender | undefined;
  return createOutboxConnectors(async (message) => {
    if (!sender) {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER?.trim(),
          pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ""),
        },
      });
      sender = async (mail) => {
        await transporter.sendMail(mail);
      };
    }
    await sender(message);
  }, smtpDelivery());
}
