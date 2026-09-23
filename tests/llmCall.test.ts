import { describe, expect, it, afterEach, vi } from "vitest";
import { callLlm, llmStatus } from "@/agent/llm";

const originalFetch = globalThis.fetch;
const originalKey = process.env.FLOWFORGE_LLM_KEY;

function reply(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.FLOWFORGE_LLM_KEY;
  else process.env.FLOWFORGE_LLM_KEY = originalKey;
  vi.restoreAllMocks();
});

describe("llm transport", () => {
  it("does not call the API without a key", async () => {
    delete process.env.FLOWFORGE_LLM_KEY;
    expect(llmStatus().configured).toBe(false);
    await expect(callLlm("hi")).rejects.toThrow(/No LLM key/);
  });

  it("retries without json_object when the provider rejects it", async () => {
    process.env.FLOWFORGE_LLM_KEY = "test-key";
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (_url, init) => {
      const body = String((init as RequestInit).body);
      calls.push(body);
      if (body.includes("response_format")) {
        return new Response("{}", { status: 400 });
      }
      return reply('{"ok":true}');
    }) as typeof fetch;

    await expect(callLlm("welcome new leads")).resolves.toBe('{"ok":true}');
    expect(calls).toHaveLength(2);
    expect(calls[1]).not.toContain("response_format");
  });

  it("an empty reply throws", async () => {
    process.env.FLOWFORGE_LLM_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => reply("   ")) as typeof fetch;

    await expect(callLlm("hi")).rejects.toThrow(/empty workflow/);
  });
});
