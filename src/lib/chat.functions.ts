import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runFarmAssistant } from "@/lib/farm-assistant.server";

const farmAssistantMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().trim().min(1).max(4000),
});

export const askFarmAssistant = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        lang: z.enum(["sw", "en"]).default("sw"),
        deviceContext: z.string().max(20000).optional(),
        messages: z.array(farmAssistantMessageSchema).min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => runFarmAssistant(data));

/**
 * Returns a text snapshot of the user's farm data for the chatbot context.
 * If `device_id` is provided, returns a deep snapshot for that single farm
 * (latest readings, short history trend, weather, finance totals, recent alerts).
 * Otherwise returns a summary across all the user's claimed devices.
 */
export const getMyDeviceContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { device_id?: string } | undefined) =>
    z.object({ device_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    if (data.device_id) {
      const { data: d } = await sb
        .from("devices")
        .select(
          "id, name, crop, location_name, target_moisture, pump_on_threshold, pump_off_threshold, last_seen_at",
        )
        .eq("id", data.device_id)
        .maybeSingle();
      if (!d) return { text: "Kifaa hakikupatikana." };

      const [
        { data: latest },
        { data: history },
        { data: weather },
        { data: alerts },
        { data: finance },
      ] = await Promise.all([
        sb
          .from("readings")
          .select("soil_moisture, soil_ph, air_temp, air_humidity, pump_on, recorded_at")
          .eq("device_id", d.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb
          .from("readings")
          .select("soil_moisture, recorded_at")
          .eq("device_id", d.id)
          .gte("recorded_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .order("recorded_at", { ascending: true })
          .limit(48),
        sb
          .from("weather_snapshots")
          .select("rain_probability, rain_amount_mm, forecast_summary, recorded_at")
          .eq("device_id", d.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb
          .from("alerts")
          .select("kind, title, body, created_at")
          .eq("device_id", d.id)
          .order("created_at", { ascending: false })
          .limit(5),
        sb
          .from("farm_finance")
          .select("entry_type, category, amount, currency, season, occurred_at")
          .eq("device_id", d.id)
          .order("occurred_at", { ascending: false })
          .limit(50),
      ]);

      const lines: string[] = [];
      lines.push(
        `KIFAA: "${d.name}"${d.crop ? ` (zao: ${d.crop})` : ""}${d.location_name ? ` @ ${d.location_name}` : ""}`,
      );
      if (latest) {
        lines.push(
          `Vipimo vya sasa: unyevu udongo=${latest.soil_moisture ?? "-"}%, pH=${latest.soil_ph ?? "-"}, joto=${latest.air_temp ?? "-"}°C, unyevu hewa=${latest.air_humidity ?? "-"}%, pampu=${latest.pump_on ? "on" : "off"} (${latest.recorded_at})`,
        );
      } else {
        lines.push("Hakuna vipimo bado.");
      }
      lines.push(
        `Thresholds: pump_on<${d.pump_on_threshold}%, pump_off>${d.pump_off_threshold}%, lengo=${d.target_moisture}%`,
      );
      if (history && history.length >= 2) {
        const first = history[0].soil_moisture ?? 0;
        const last = history[history.length - 1].soil_moisture ?? 0;
        const trend = last > first ? "unaongezeka" : last < first ? "unapungua" : "umesimama";
        lines.push(`Trend ya unyevu (saa 24): ${first}% → ${last}% (${trend})`);
      }
      if (weather) {
        lines.push(
          `Hali ya hewa: mvua=${weather.rain_probability ?? "-"}%/${weather.rain_amount_mm ?? "-"}mm${weather.forecast_summary ? `, "${weather.forecast_summary}"` : ""}`,
        );
      }
      if (alerts && alerts.length) {
        lines.push("Arifa za karibuni:");
        for (const a of alerts)
          lines.push(`  - [${a.kind ?? "info"}] ${a.title}${a.body ? ` — ${a.body}` : ""}`);
      }
      if (finance && finance.length) {
        const totals = finance.reduce(
          (acc, r) => {
            const amt = Number(r.amount) || 0;
            if (r.entry_type === "income") acc.income += amt;
            else acc.expense += amt;
            return acc;
          },
          { income: 0, expense: 0 },
        );
        const cur = finance[0]?.currency ?? "TZS";
        lines.push(
          `Fedha za shamba: mapato=${totals.income} ${cur}, matumizi=${totals.expense} ${cur}, faida=${totals.income - totals.expense} ${cur} (kumbukumbu ${finance.length})`,
        );
        const recent = finance.slice(0, 5);
        for (const r of recent) {
          lines.push(
            `  · ${r.occurred_at} ${r.entry_type === "income" ? "+" : "-"}${r.amount} ${r.currency} (${r.category || "-"}${r.season ? `, ${r.season}` : ""})`,
          );
        }
      }
      // Nearby suppliers (top 8 active)
      const { data: suppliers } = await sb
        .from("suppliers")
        .select("id, business_name, region, district, village")
        .eq("is_active", true)
        .limit(8);
      if (suppliers && suppliers.length) {
        lines.push("Wasambazaji wa pembejeo (karibu):");
        for (const s of suppliers) {
          const loc = [s.village, s.district, s.region].filter(Boolean).join(", ");
          const { data: prods } = await sb
            .from("supplier_products")
            .select("name, price, currency, unit, category")
            .eq("supplier_id", s.id)
            .eq("is_available", true)
            .limit(5);
          const prodStr = (prods ?? [])
            .map((p) => `${p.name}=${p.price} ${p.currency}${p.unit ? "/" + p.unit : ""}`)
            .join("; ");
          lines.push(
            `  - ${s.business_name}${loc ? ` (${loc})` : ""}${prodStr ? ` | ${prodStr}` : ""}`,
          );
        }
      }
      return { text: lines.join("\n") };
    }

    // Default: summary across all devices
    const { data: devices } = await sb
      .from("devices")
      .select(
        "id, name, crop, location_name, target_moisture, pump_on_threshold, pump_off_threshold, last_seen_at",
      )
      .eq("is_claimed", true)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!devices || devices.length === 0) {
      return { text: "Mtumiaji hana kifaa kilichosajiliwa bado." };
    }

    const lines: string[] = [];
    for (const d of devices) {
      const [{ data: latest }, { data: weather }] = await Promise.all([
        sb
          .from("readings")
          .select("soil_moisture, soil_ph, air_temp, air_humidity, pump_on, recorded_at")
          .eq("device_id", d.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb
          .from("weather_snapshots")
          .select("rain_probability, rain_amount_mm, forecast_summary, recorded_at")
          .eq("device_id", d.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const parts: string[] = [
        `Kifaa "${d.name}" (id=${d.id})${d.crop ? ` (zao: ${d.crop})` : ""}${d.location_name ? ` @ ${d.location_name}` : ""}`,
      ];
      if (latest) {
        parts.push(
          `unyevu udongo=${latest.soil_moisture ?? "-"}%, pH=${latest.soil_ph ?? "-"}, joto=${latest.air_temp ?? "-"}°C, unyevu hewa=${latest.air_humidity ?? "-"}%, pampu=${latest.pump_on ? "on" : "off"}`,
        );
      } else {
        parts.push("hakuna vipimo bado");
      }
      parts.push(
        `thresholds: pump_on<${d.pump_on_threshold}%, pump_off>${d.pump_off_threshold}%, lengo=${d.target_moisture}%`,
      );
      if (weather) {
        parts.push(
          `hali ya hewa: mvua=${weather.rain_probability ?? "-"}%/${weather.rain_amount_mm ?? "-"}mm${weather.forecast_summary ? `, "${weather.forecast_summary}"` : ""}`,
        );
      }
      lines.push("- " + parts.join("; "));
    }
    return { text: lines.join("\n") };
  });
