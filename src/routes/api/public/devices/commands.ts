import { createFileRoute } from "@tanstack/react-router";
import {
  corsPreflight,
  deviceFromAuthHeader,
  jsonResponse,
  markDeviceOnline,
  unauthorized,
} from "@/lib/esp32-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/devices/commands")({
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
          .limit(10);
        if (error) return jsonResponse({ error: error.message }, 500);
        if (data && data.length) {
          await supabaseAdmin
            .from("commands")
            .update({ status: "sent" })
            .in(
              "id",
              data.map((c) => c.id),
            );
        }
        return jsonResponse({ commands: data ?? [] });
      },
    },
  },
});
