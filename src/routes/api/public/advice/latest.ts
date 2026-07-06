import { createFileRoute } from "@tanstack/react-router";
import {
  corsPreflight,
  deviceFromAuthHeader,
  jsonResponse,
  markDeviceOnline,
  unauthorized,
} from "@/lib/esp32-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/advice/latest")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const device = await deviceFromAuthHeader(request);
        if (!device) return unauthorized();
        await markDeviceOnline(device.id);

        const { data } = await supabaseAdmin
          .from("advice_log")
          .select("message, action, created_at")
          .eq("device_id", device.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return jsonResponse({
          advice_text: data?.message ?? "Hakuna ushauri bado",
          action: data?.action ?? null,
          created_at: data?.created_at ?? null,
        });
      },
    },
  },
});
