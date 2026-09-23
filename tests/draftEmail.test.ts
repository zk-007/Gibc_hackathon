import { describe, expect, it } from "vitest";
import {
  draftFollowUpEmail,
  draftWelcomeEmail,
  templateWelcomeEmail,
} from "@/agent/draftEmail";
import { ali } from "@/fixtures/leads";

describe("email drafts", () => {
  it("falls back to the template when no model is passed", async () => {
    const result = await draftWelcomeEmail(ali, null);
    const fallback = templateWelcomeEmail(ali);

    expect(result.source).toBe("template");
    expect(result.email).toEqual(fallback);
    expect(result.email.to).toBe("ali@northstar.co");
  });

  it("uses the model draft when JSON is valid", async () => {
    const result = await draftWelcomeEmail(ali, async () =>
      JSON.stringify({
        subject: "Hello from Northstar",
        body: "Hi Ali — glad you reached out.",
      }),
    );

    expect(result.source).toBe("llm");
    expect(result.email.subject).toBe("Hello from Northstar");
    expect(result.email.body).toContain("Ali");
    expect(result.email.to).toBe("ali@northstar.co");
  });

  it("falls back if the model returns junk", async () => {
    const result = await draftWelcomeEmail(ali, async () => "not json");
    expect(result.source).toBe("template");
    expect(result.email.subject).toBe("Welcome, Ali");
  });

  it("drafts a follow-up from the model", async () => {
    const result = await draftFollowUpEmail(
      { name: "Ali", email: "ali@northstar.co", title: "Follow up with Ali" },
      async () =>
        JSON.stringify({
          subject: "Quick check-in",
          body: "Hi Ali — just circling back.",
        }),
    );

    expect(result.source).toBe("llm");
    expect(result.email.subject).toBe("Quick check-in");
  });
});
