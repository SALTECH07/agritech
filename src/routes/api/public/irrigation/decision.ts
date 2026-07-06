import { createFileRoute } from "@tanstack/react-router";
import {
  corsPreflight,
  deviceFromAuthHeader,
  jsonResponse,
  markDeviceOnline,
  unauthorized,
} from "@/lib/esp32-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/irrigation/decision")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const device = await deviceFromAuthHeader(request);
        if (!device) return unauthorized();
        await markDeviceOnline(device.id);

        const { data: weather } = await supabaseAdmin
          .from("weather_snapshots")
          .select("rain_probability, rain_amount_mm, forecast_summary, recorded_at")
          .eq("device_id", device.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const isFresh =
          weather?.recorded_at &&
          Date.now() - new Date(weather.recorded_at).getTime() < 30 * 60 * 1000;
        let rainProb = Number(weather?.rain_probability ?? 0);
        let rainAmt = Number(weather?.rain_amount_mm ?? 0);
        let summary = weather?.forecast_summary ?? null;

        if (!isFresh && device.lat != null && device.lon != null) {
          try {
            const { fetchTmaWeather } = await import("@/lib/tma-weather.server");
            const live = await fetchTmaWeather(Number(device.lat), Number(device.lon));
            if (live) {
              rainProb = Number(live.rain_probability ?? 0);
              rainAmt = Number(live.rain_amount_mm ?? 0);
              summary = live.summary;
              await supabaseAdmin.from("weather_snapshots").insert({
                device_id: device.id,
                rain_probability: rainProb,
                rain_amount_mm: rainAmt,
                forecast_summary: summary,
                raw: { source: "open-meteo", live: true } as never,
              });
            }
          } catch (e) {
            console.error("live weather fetch failed", e);
          }
        }

        const willRain =
          rainProb >= Number(device.rain_block_probability ?? 70) ||
          rainAmt >= Number(device.rain_block_amount_mm ?? 5);
        return jsonResponse({
          allow_irrigation: !willRain,
          forecast: { rain_probability_percent: rainProb, rain_amount_mm: rainAmt },
          reason: willRain
            ? `Mvua inatarajiwa (${rainProb.toFixed(0)}% / ${rainAmt.toFixed(1)}mm) — subiri kabla ya umwagiliaji.`
            : (summary ?? "Hali ni nzuri kwa umwagiliaji."),
        });
      },
    },
  },
});
