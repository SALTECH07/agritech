// IoT device self-registration endpoint.
// Called once by a fresh device. Returns a device_key (used as bearer for all
// subsequent API calls) and a short claim_code displayed on the OLED + QR.
// A logged-in farmer then "claims" the device via claimDevice server fn.
import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, jsonResponse } from "@/lib/esp32-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function generateDeviceKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "dk_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateClaimCode(): string {
  // 6 chars, unambiguous alphabet (no 0/O/1/I)
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const Route = createFileRoute("/api/public/devices/register")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        let body: { hardware_id?: string } = {};
        try {
          body = (await request.json()) as { hardware_id?: string };
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400);
        }
        const hardware_id = (body.hardware_id ?? "").toString().trim().slice(0, 64);
        if (!hardware_id || hardware_id.length < 4) {
          return jsonResponse({ error: "invalid_hardware_id" }, 400);
        }

        // Idempotent: if this hardware already registered, return its existing values
        const { data: existing } = await supabaseAdmin
          .from("devices")
          .select("device_key, claim_code, is_claimed, name")
          .eq("hardware_id", hardware_id)
          .maybeSingle();

        if (existing) {
          return jsonResponse({
            device_key: existing.device_key,
            claim_code: existing.is_claimed ? null : existing.claim_code,
            is_claimed: existing.is_claimed,
            name: existing.name,
          });
        }

        // Fresh registration. Generate keys and ensure claim_code is unique.
        const device_key = generateDeviceKey();
        let claim_code = generateClaimCode();
        for (let i = 0; i < 5; i++) {
          const { data: clash } = await supabaseAdmin
            .from("devices")
            .select("id")
            .eq("claim_code", claim_code)
            .maybeSingle();
          if (!clash) break;
          claim_code = generateClaimCode();
        }

        const { error } = await supabaseAdmin.from("devices").insert({
          hardware_id,
          device_key,
          claim_code,
          name: `IOT-${hardware_id.slice(-6).toUpperCase()}`,
          owner_id: null,
          is_claimed: false,
        });
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({
          device_key,
          claim_code,
          is_claimed: false,
        });
      },
    },
  },
});
