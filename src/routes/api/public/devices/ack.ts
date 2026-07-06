import { createFileRoute } from "@tanstack/react-router";
import {
  corsPreflight,
  deviceFromAuthHeader,
  jsonResponse,
  markDeviceOnline,
  unauthorized,
} from "@/lib/esp32-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/devices/ack")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        const device = await deviceFromAuthHeader(request);
        if (!device) return unauthorized();
        await markDeviceOnline(device.id);
        let body: { id?: string; command_id?: string; ok?: boolean } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400);
        }
        const commandId = body.id ?? body.command_id;
        if (!commandId) return jsonResponse({ error: "missing_id" }, 400);
        const ok = body.ok !== false;
        const { data: updated, error } = await supabaseAdmin
          .from("commands")
          .update({
            status: ok ? "acked" : "failed",
            acked_at: new Date().toISOString(),
          })
          .eq("id", commandId)
          .eq("device_id", device.id)
          .select("kind")
          .maybeSingle();
        if (error) return jsonResponse({ error: error.message }, 500);

        // Notify the owner that the farm device actually executed the command.
        if (updated && device.owner_id) {
          const k = updated.kind as string;
          const label: Record<string, string> = {
            pump_on: "Pampu imewashwa",
            pump_off: "Pampu imezimwa",
            valve_on: "Valve imefunguliwa",
            valve_off: "Valve imefungwa",
            set_thresholds: "Viwango vimewekwa",
          };
          const title = `${label[k] ?? "Amri imetekelezwa"} ✓ ${device.name ?? ""}`.trim();
          await supabaseAdmin.from("alerts").insert({
            user_id: device.owner_id,
            device_id: device.id,
            kind: `ack_${k}`,
            channel: "in_app",
            level: ok ? "info" : "warning",
            title,
            body: ok
              ? `Kifaa cha ${device.name ?? "shamba"} kimethibitisha kutekeleza amri.`
              : `Kifaa cha ${device.name ?? "shamba"} kimeshindwa kutekeleza amri.`,
            sent_at: new Date().toISOString(),
          });
        }
        return jsonResponse({ ok: true });
      },
    },
  },
});
