import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateAIText, isAIConfigured } from "@/lib/ai.server";

const inputSchema = z.object({ device_id: z.string().uuid() });

type AdviceOut = {
  source: "ai" | "rules";
  message: string;
  action: string;
};

function rulesAdvice(args: {
  moisture: number | null;
  pumpOn: number;
  pumpOff: number;
  rainProb: number | null;
  rainMm: number | null;
  pumpOnNow: boolean | null;
  lang: "sw" | "en";
}): AdviceOut {
  const { moisture, pumpOn, pumpOff, rainProb, rainMm, pumpOnNow, lang } = args;
  const sw = lang === "sw";
  if (moisture == null) {
    return {
      source: "rules",
      action: "wait",
      message: sw
        ? "Bado hatujapata vipimo vya unyevu. Subiri kifaa kitume data."
        : "No moisture readings yet. Waiting for the device.",
    };
  }
  if ((rainProb ?? 0) >= 60 && (rainMm ?? 0) >= 2) {
    return {
      source: "rules",
      action: "skip",
      message: sw
        ? `Mvua inatarajiwa (uwezekano ${Math.round(rainProb!)}%). Usimwagilia sasa — subiri.`
        : `Rain is expected (${Math.round(rainProb!)}% chance). Skip irrigation for now.`,
    };
  }
  if (moisture < pumpOn && !pumpOnNow) {
    return {
      source: "rules",
      action: "pump_on",
      message: sw
        ? `Udongo umekauka (${moisture.toFixed(0)}%). Washa pampu mpaka unyevu ufike ${pumpOff}%.`
        : `Soil is dry (${moisture.toFixed(0)}%). Turn on the pump until moisture reaches ${pumpOff}%.`,
    };
  }
  if (moisture >= pumpOff && pumpOnNow) {
    return {
      source: "rules",
      action: "pump_off",
      message: sw
        ? `Unyevu umetosha (${moisture.toFixed(0)}%). Zima pampu.`
        : `Moisture is sufficient (${moisture.toFixed(0)}%). Turn off the pump.`,
    };
  }
  return {
    source: "rules",
    action: "hold",
    message: sw
      ? `Unyevu uko sawa (${moisture.toFixed(0)}%). Endelea kufuatilia.`
      : `Moisture looks OK (${moisture.toFixed(0)}%). Keep monitoring.`,
  };
}

export const getDeviceAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }): Promise<AdviceOut> => {
    const { data: device } = await context.supabase
      .from("devices")
      .select("*")
      .eq("id", data.device_id)
      .maybeSingle();
    if (!device) throw new Error("Device not found");

    const { data: latest } = await context.supabase
      .from("readings")
      .select("*")
      .eq("device_id", data.device_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let { data: weather } = await context.supabase
      .from("weather_snapshots")
      .select("*")
      .eq("device_id", data.device_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Burudisha hali ya hewa kutoka chanzo cha TMA/Open-Meteo ikiwa
    // hakuna snapshot ya hivi karibuni (chini ya saa 1) na kifaa kina lat/lon.
    const stale =
      !weather || Date.now() - new Date(weather.recorded_at as string).getTime() > 60 * 60 * 1000;
    if (stale && device.lat != null && device.lon != null) {
      try {
        const { fetchTmaWeather } = await import("@/lib/tma-weather.server");
        const tma = await fetchTmaWeather(Number(device.lat), Number(device.lon));
        if (tma) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: inserted } = await supabaseAdmin
            .from("weather_snapshots")
            .insert({
              device_id: data.device_id,
              rain_probability: tma.rain_probability,
              rain_amount_mm: tma.rain_amount_mm,
              forecast_summary: tma.summary,
              raw: tma.raw as never,
            })
            .select("*")
            .maybeSingle();
          if (inserted) weather = inserted;
        }
      } catch (e) {
        console.error("TMA weather refresh failed", e);
      }
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("language")
      .eq("id", context.userId)
      .maybeSingle();
    const lang = (profile?.language as "sw" | "en" | undefined) ?? "sw";

    const fallback = rulesAdvice({
      moisture: latest?.soil_moisture ?? null,
      pumpOn: Number(device.pump_on_threshold),
      pumpOff: Number(device.pump_off_threshold),
      rainProb: weather?.rain_probability ?? null,
      rainMm: weather?.rain_amount_mm ?? null,
      pumpOnNow: latest?.pump_on ?? null,
      lang,
    });

    // Try AI. Fall back to rules on any error.
    let advice: AdviceOut = fallback;
    if (isAIConfigured()) {
      try {
        const sysSw =
          "Wewe ni mshauri wa kilimo. Jibu kwa Kiswahili rahisi cha sentensi 1-2 tu. Toa hatua moja maalum.";
        const sysEn =
          "You are a farm irrigation advisor. Reply in 1-2 simple sentences with one specific action.";
        const userMsg = JSON.stringify({
          crop: device.crop,
          location: device.location_name,
          soil_moisture_pct: latest?.soil_moisture,
          soil_ph: latest?.soil_ph,
          air_temp_c: latest?.air_temp,
          air_humidity_pct: latest?.air_humidity,
          pump_on_now: latest?.pump_on,
          target_moisture_pct: Number(device.target_moisture),
          pump_on_threshold_pct: Number(device.pump_on_threshold),
          pump_off_threshold_pct: Number(device.pump_off_threshold),
          rain_probability_pct: weather?.rain_probability,
          rain_amount_mm: weather?.rain_amount_mm,
        });
        const msg = await generateAIText({
          instructions: lang === "sw" ? sysSw : sysEn,
          input: userMsg,
          maxOutputTokens: 180,
        });
        if (msg) advice = { source: "ai", message: msg.trim(), action: fallback.action };
      } catch {
        // keep fallback
      }
    }

    await context.supabase.from("advice_log").insert({
      device_id: data.device_id,
      source: advice.source,
      language: lang,
      message: advice.message,
      action: advice.action,
      context: {
        moisture: latest?.soil_moisture,
        rain_probability: weather?.rain_probability,
      },
    });

    return advice;
  });
