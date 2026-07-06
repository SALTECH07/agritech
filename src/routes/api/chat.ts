import { createFileRoute } from "@tanstack/react-router";
import { runFarmAssistant } from "@/lib/farm-assistant.server";
import { readServerEnv } from "@/lib/server-env.server";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function unauthorized(lang: "sw" | "en") {
  return new Response(
    JSON.stringify({
      error:
        lang === "sw"
          ? "Ingia kwanza ili kupata ushauri wa shamba."
          : "Sign in first to get farm advice.",
    }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

async function verifySignedInFarmer(request: Request, lang: "sw" | "en") {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return unauthorized(lang);
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return unauthorized(lang);

  const SUPABASE_URL = readServerEnv("SUPABASE_URL");
  const SUPABASE_PUBLISHABLE_KEY = readServerEnv("SUPABASE_PUBLISHABLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return new Response(JSON.stringify({ error: "Supabase auth is not configured." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return unauthorized(lang);
  return null;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { messages?: ChatMsg[]; lang?: "sw" | "en"; deviceContext?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const lang = body.lang === "en" ? "en" : "sw";
        const authError = await verifySignedInFarmer(request, lang);
        if (authError) return authError;

        const incoming = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
        if (incoming.length === 0) {
          return new Response(JSON.stringify({ error: "No messages" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { text, mode } = await runFarmAssistant({
          lang,
          messages: incoming,
          deviceContext: body.deviceContext ?? "",
        });

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(text));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-AI-Mode": mode,
          },
        });
      },
    },
  },
});
