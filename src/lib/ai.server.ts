import {
  generateGeminiText,
  getGeminiRuntimeStatus,
  GeminiConfigurationError,
  GeminiRequestError,
  isGeminiConfigured,
  type GeminiInputMessage,
} from "@/lib/gemini.server";
import {
  generateOpenAIText,
  getOpenAIRuntimeStatus,
  isOpenAIConfigured,
  OpenAIConfigurationError,
  OpenAIRequestError,
} from "@/lib/openai.server";
import { readServerEnv } from "@/lib/server-env.server";

export type AIInputMessage = GeminiInputMessage;
export type AIProvider = "gemini" | "openai";

export class AIConfigurationError extends Error {
  constructor() {
    super("Missing AI API key");
    this.name = "AIConfigurationError";
  }
}

export class AIRequestError extends Error {
  status: number;
  detail: string;
  provider: AIProvider;

  constructor(provider: AIProvider, status: number, detail: string) {
    super(`${provider} API error ${status}`);
    this.name = "AIRequestError";
    this.provider = provider;
    this.status = status;
    this.detail = detail;
  }
}

function requestedProvider(): AIProvider | null {
  const provider = readServerEnv("AI_PROVIDER").toLowerCase();
  if (provider === "openai" || provider === "gemini") return provider;
  return null;
}

function activeProvider(): AIProvider {
  const requested = requestedProvider();
  if (requested) return requested;
  if (isGeminiConfigured()) return "gemini";
  return "openai";
}

function isProviderConfigured(provider: AIProvider) {
  return provider === "gemini" ? isGeminiConfigured() : isOpenAIConfigured();
}

function providerOrder() {
  const first = activeProvider();
  const order: AIProvider[] = [first];
  const second: AIProvider = first === "gemini" ? "openai" : "gemini";
  if (isProviderConfigured(second)) order.push(second);
  return order;
}

async function generateWithProvider(
  provider: AIProvider,
  args: {
    instructions: string;
    input: string | AIInputMessage[];
    maxOutputTokens?: number;
  },
) {
  if (provider === "gemini") return await generateGeminiText(args);
  return await generateOpenAIText(args);
}

export function isAIConfigured() {
  return isGeminiConfigured() || isOpenAIConfigured();
}

export function getAIRuntimeStatus() {
  const provider = activeProvider();
  const runtime = provider === "gemini" ? getGeminiRuntimeStatus() : getOpenAIRuntimeStatus();
  return {
    ...runtime,
    configured: isAIConfigured() && runtime.configured,
    activeProvider: provider,
    configuredProviders: {
      gemini: isGeminiConfigured(),
      openai: isOpenAIConfigured(),
    },
  };
}

export async function generateAIText(args: {
  instructions: string;
  input: string | AIInputMessage[];
  maxOutputTokens?: number;
}) {
  let lastError: unknown = null;

  for (const provider of providerOrder()) {
    if (!isProviderConfigured(provider)) continue;
    try {
      return await generateWithProvider(provider, args);
    } catch (error) {
      lastError = { provider, error };
    }
  }

  const provider =
    lastError && typeof lastError === "object" && "provider" in lastError
      ? ((lastError as { provider: AIProvider }).provider ?? activeProvider())
      : activeProvider();
  const error =
    lastError && typeof lastError === "object" && "error" in lastError
      ? (lastError as { error: unknown }).error
      : lastError;

  if (error) {
    if (error instanceof GeminiConfigurationError || error instanceof OpenAIConfigurationError) {
      throw new AIConfigurationError();
    }
    if (error instanceof GeminiRequestError) {
      throw new AIRequestError("gemini", error.status, error.detail);
    }
    if (error instanceof OpenAIRequestError) {
      throw new AIRequestError("openai", error.status, error.detail);
    }
    throw error;
  }

  throw new AIConfigurationError();
}
