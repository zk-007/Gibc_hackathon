export type EmailDraft = {
  to: string;
  subject: string;
  body: string;
};

export type FollowUpTask = {
  title: string;
  leadId: string;
  delay: string;
  email?: string;
  name?: string;
};

export type Connectors = {
  gmail: {
    send: (email: EmailDraft) => Promise<void>;
  };
  tasks: {
    create: (task: FollowUpTask) => Promise<void>;
  };
};
