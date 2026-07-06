import { readServerEnv } from "@/lib/server-env.server";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5.5";

export type OpenAIInputMessage = {
  role: "developer" | "system" | "user" | "assistant";
  content: string;
};

export class OpenAIConfigurationError extends Error {
  constructor() {
    super("Missing OPENAI_API_KEY");
    this.name = "OpenAIConfigurationError";
  }
}

export class OpenAIRequestError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`OpenAI API error ${status}`);
    this.name = "OpenAIRequestError";
    this.status = status;
    this.detail = detail;
  }
}

export function getOpenAIModel() {
  return readServerEnv("OPENAI_MODEL") || DEFAULT_OPENAI_MODEL;
}

export function isOpenAIConfigured() {
  return Boolean(readServerEnv("OPENAI_API_KEY"));
}

export function getOpenAIRuntimeStatus() {
  return {
    configured: isOpenAIConfigured(),
    model: getOpenAIModel(),
    provider: "OpenAI Responses API",
  };
}

function getOpenAIKey() {
  const key = readServerEnv("OPENAI_API_KEY");
  if (!key) throw new OpenAIConfigurationError();
  return key;
}

function extractOutputText(response: unknown): string {
  if (response && typeof response === "object" && "output_text" in response) {
    const text = (response as { output_text?: unknown }).output_text;
    if (typeof text === "string" && text.trim()) return text;
  }

  const output =
    response && typeof response === "object" ? (response as { output?: unknown }).output : null;
  if (!Array.isArray(output)) return "";

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("").trim();
}

export async function generateOpenAIText(args: {
  instructions: string;
  input: string | OpenAIInputMessage[];
  maxOutputTokens?: number;
}) {
  const apiKey = getOpenAIKey();
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      reasoning: { effort: readServerEnv("OPENAI_REASONING_EFFORT") || "low" },
      text: { verbosity: readServerEnv("OPENAI_TEXT_VERBOSITY") || "low" },
      instructions: args.instructions,
      input: args.input,
      max_output_tokens: args.maxOutputTokens ?? 700,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new OpenAIRequestError(response.status, detail.slice(0, 500));
  }

  const json = (await response.json()) as unknown;
  const text = extractOutputText(json);
  if (!text) throw new OpenAIRequestError(502, "OpenAI returned an empty response.");
  return text;
}
