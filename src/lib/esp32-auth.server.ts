// Server-only helper for public IoT device routes. Uses service-role admin client.
// Filename ends with .server.ts so the bundler blocks it from client bundles.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function deviceFromAuthHeader(request: Request) {
  const url = new URL(request.url);
  const header =
    request.headers.get("authorization") ??
    request.headers.get("x-device-key") ??
    request.headers.get("x-api-key") ??
    url.searchParams.get("device_key") ??
    url.searchParams.get("api_key") ??
    url.searchParams.get("key") ??
    url.searchParams.get("token");
  const trimmed = header?.trim();
  const key = trimmed?.toLowerCase().startsWith("bearer ") ? trimmed.slice(7).trim() : trimmed;
  if (!key) return null;
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("*")
    .eq("device_key", key)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function markDeviceOnline(deviceId: string) {
  await supabaseAdmin
    .from("devices")
    .update({ last_seen_at: new Date().toISOString(), online: true })
    .eq("id", deviceId);
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Device-Key, X-API-Key",
  "Access-Control-Max-Age": "86400",
} as const;

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export function unauthorized() {
  return jsonResponse({ error: "invalid_device_key" }, 401);
}
