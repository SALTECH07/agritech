import { readServerEnv } from "@/lib/server-env.server";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

export type GeminiInputMessage = {
  role: "developer" | "system" | "user" | "assistant";
  content: string;
};

export class GeminiConfigurationError extends Error {
  constructor() {
    super("Missing GEMINI_API_KEY");
    this.name = "GeminiConfigurationError";
  }
}

export class GeminiRequestError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`Gemini API error ${status}`);
    this.name = "GeminiRequestError";
    this.status = status;
    this.detail = detail;
  }
}

export function getGeminiModel() {
  return readServerEnv("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
}

export function isGeminiConfigured() {
  return Boolean(readServerEnv("GEMINI_API_KEY"));
}

export function getGeminiRuntimeStatus() {
  return {
    configured: isGeminiConfigured(),
    model: getGeminiModel(),
    provider: "Google Gemini API",
  };
}

function getGeminiKey() {
  const key = readServerEnv("GEMINI_API_KEY");
  if (!key) throw new GeminiConfigurationError();
  return key;
}

function getGeminiTemperature() {
  const raw = readServerEnv("GEMINI_TEMPERATURE");
  if (!raw) return 0.3;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 2) : 0.3;
}

function buildGeminiPayload(args: {
  instructions: string;
  input: string | GeminiInputMessage[];
  maxOutputTokens?: number;
}) {
  const messages =
    typeof args.input === "string" ? [{ role: "user" as const, content: args.input }] : args.input;

  const extraInstructions: string[] = [];
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const message of messages) {
    const content = message.content.trim();
    if (!content) continue;
    if (message.role === "developer" || message.role === "system") {
      extraInstructions.push(content);
      continue;
    }
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: content }],
    });
  }

  const instructionText = [args.instructions, ...extraInstructions].filter(Boolean).join("\n\n");

  return {
    systemInstruction: instructionText ? { parts: [{ text: instructionText }] } : undefined,
    contents: contents.length ? contents : [{ role: "user", parts: [{ text: "" }] }],
    generationConfig: {
      maxOutputTokens: args.maxOutputTokens ?? 700,
      temperature: getGeminiTemperature(),
    },
  };
}

function extractGeminiText(response: unknown): string {
  const candidates =
    response && typeof response === "object"
      ? (response as { candidates?: unknown }).candidates
      : null;
  if (!Array.isArray(candidates)) return "";

  const chunks: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const content = (candidate as { content?: unknown }).content;
    if (!content || typeof content !== "object") continue;
    const parts = (content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }

  return chunks.join("").trim();
}

export async function generateGeminiText(args: {
  instructions: string;
  input: string | GeminiInputMessage[];
  maxOutputTokens?: number;
}) {
  const model = getGeminiModel().replace(/^models\//, "");
  const response = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": getGeminiKey(),
    },
    body: JSON.stringify(buildGeminiPayload(args)),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GeminiRequestError(response.status, detail.slice(0, 500));
  }

  const json = (await response.json()) as unknown;
  const text = extractGeminiText(json);
  if (!text) throw new GeminiRequestError(502, "Gemini returned an empty response.");
  return text;
}
