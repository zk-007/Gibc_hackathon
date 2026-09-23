import type { Connectors, EmailDraft, FollowUpTask } from "./types";

export type MockConnectors = Connectors & {
  outbox: {
    emails: EmailDraft[];
    tasks: FollowUpTask[];
  };
};

export function createMockConnectors(): MockConnectors {
  const emails: EmailDraft[] = [];
  const tasks: FollowUpTask[] = [];

  return {
    gmail: {
      async send(email) {
        emails.push(email);
      },
    },
    tasks: {
      async create(task) {
        tasks.push(task);
      },
    },
    outbox: { emails, tasks },
  };
}
