// Alias for device firmware: GET /api/commands/next?device_id=...
// Returns the next pending/sent command as a single object the firmware
// understands: { command: "PUMP_ON" | "PUMP_OFF" | ... , params: {...} }
// or { command: "NONE" } if there is nothing to do.
import { createFileRoute } from "@tanstack/react-router";
import {
  corsPreflight,
  deviceFromAuthHeader,
  jsonResponse,
  markDeviceOnline,
  unauthorized,
} from "@/lib/esp32-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KIND_TO_COMMAND: Record<string, string> = {
  pump_on: "PUMP_ON",
  pump_off: "PUMP_OFF",
  valve_on: "VALVE_ON",
  valve_off: "VALVE_OFF",
  set_thresholds: "SET_THRESHOLDS",
};

export const Route = createFileRoute("/api/commands/next")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const device = await deviceFromAuthHeader(request);
        if (!device) return unauthorized();
        await markDeviceOnline(device.id);

        const { data, error } = await supabaseAdmin
          .from("commands")
          .select("id, kind, payload, created_at")
          .eq("device_id", device.id)
          .in("status", ["pending", "sent"])
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) return jsonResponse({ error: error.message }, 500);
        if (!data) return jsonResponse({ command: "NONE" });

        // Mark delivery as sent; firmware confirms execution through /api/public/devices/ack.
        await supabaseAdmin.from("commands").update({ status: "sent" }).eq("id", data.id);

        const command = KIND_TO_COMMAND[data.kind as string] ?? "NONE";
        return jsonResponse({
          command,
          id: data.id,
          params: data.payload ?? {},
          ack_url: "/api/public/devices/ack",
          ack_required: true,
        });
      },
    },
  },
});
