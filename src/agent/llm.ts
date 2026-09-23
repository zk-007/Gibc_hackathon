export type LlmComplete = (prompt: string) => Promise<string>;

function llmKey(): string {
  return (
    process.env.FLOWFORGE_LLM_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim() ||
    process.env.groq_api_key?.trim() ||
    ""
  );
}

export function isLlmConfigured(): boolean {
  return Boolean(llmKey());
}

function looksLikeGroq(): boolean {
  return llmKey().startsWith("gsk_");
}

export function llmModel(): string {
  return (
    process.env.FLOWFORGE_LLM_MODEL?.trim() ||
    (looksLikeGroq() ? "openai/gpt-oss-20b" : "gpt-4o-mini")
  );
}

function baseUrl(): string {
  return (
    process.env.FLOWFORGE_LLM_BASE_URL?.trim() ||
    (looksLikeGroq()
      ? "https://api.groq.com/openai/v1"
      : "https://api.openai.com/v1")
  );
}

export const SYSTEM_PROMPT = `You turn one English sentence into a workflow JSON for a lead automation tool.
Reply with JSON only, no prose. Shape:
{"name":string,"trigger":{"type":"sheets.row_added","sheet":string},
 "nodes":[
   {"id":string,"kind":"check","op":"require_fields","fields":["email","name"]},
   {"id":string,"kind":"policy","rules":["email.valid","consent.marketing","dedupe.email","discount.limit"]},
   {"id":string,"kind":"gate","when":"external_message","preview":"email"},
   {"id":string,"kind":"action","op":"gmail.send"},
   {"id":string,"kind":"action","op":"tasks.create","delay":"P3D"}
 ]}
Rules: only those kinds and ops exist. delay is ISO-8601 like P1D or P3D.
Put a gate before any gmail.send. Keep node ids short and unique.`;

export function shouldUseLlm(): boolean {
  return (
    isLlmConfigured() &&
    process.env.VITEST !== "true" &&
    process.env.NODE_ENV !== "test"
  );
}

export function llmStatus(): {
  configured: boolean;
  model: string;
  baseUrl: string;
  draftsEmails: boolean;
} {
  return {
    configured: isLlmConfigured(),
    model: llmModel(),
    baseUrl: baseUrl(),
    draftsEmails: shouldUseLlm(),
  };
}

async function chat(
  prompt: string,
  jsonMode: boolean,
  system: string,
  temperature: number,
): Promise<Response> {
  const key = llmKey();
  return fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: llmModel(),
      temperature,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
}

export async function callLlm(
  prompt: string,
  options: { system?: string; temperature?: number } = {},
): Promise<string> {
  if (!isLlmConfigured()) throw new Error("No LLM key configured");
  const system = options.system ?? SYSTEM_PROMPT;
  const temperature = options.temperature ?? 0;

  let response = await chat(prompt, true, system, temperature);
  // Some providers reject json_object mode, so retry once without it.
  if (response.status === 400 || response.status === 422) {
    response = await chat(prompt, false, system, temperature);
  }
  if (!response.ok) {
    throw new Error(`LLM call failed (${response.status})`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("LLM returned an empty workflow");
  return text;
}

/** Fenced or chatty replies se pehla JSON object nikaalna. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LLM reply had no JSON object");
  return JSON.parse(raw.slice(start, end + 1));
}
