import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateAIText } from "@/lib/ai.server";

const SYSTEM_SW = `Wewe ni mshauri wa fedha za kilimo wa "Veta Kipawa Agri Tech". Mkulima atakupa muhtasari wa mapato na matumizi ya shamba.
Toa jibu LIFUPI lenye sehemu HIZI tatu kwa Kiswahili rahisi (tumia vichwa hivi hivi):

1) **Faida / Hasara**: hesabu na sema ni faida au hasara, kiasi na asilimia ya faida (margin %).
2) **Mpangilio wa Matumizi**: taja matumizi 2-3 yenye sehemu kubwa zaidi, sema yapi yanaweza kupunguzwa au kupangwa vizuri ili kuepuka hasara zisizo za lazima.
3) **Bei ya Kuuza**: kwa kuzingatia jumla ya matumizi na zao husika, pendekeza bei ya chini (break-even) na bei nzuri ya kuuza yenye faida ya angalau 25-40%.

Kuwa wa moja kwa moja, tumia namba halisi kutoka kwenye data. Usiongeze maelezo yasiyo ya lazima.`;

const SYSTEM_EN = `You are a farm finance advisor for "Veta Kipawa Agri Tech". The farmer will give you their farm income/expense summary.
Reply SHORT with these THREE sections in plain English (use these exact headings):

1) **Profit / Loss**: compute and state profit or loss, amount and margin %.
2) **Expense Plan**: name the 2-3 largest expense categories, say which can be reduced or better timed to avoid unnecessary losses.
3) **Selling Price**: based on total expenses and the crop, suggest a break-even price and a healthy selling price with at least 25-40% margin.

Be direct, use real numbers from the data. No filler.`;

export const getFinanceAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { device_id?: string; lang?: "sw" | "en" } | undefined) =>
    z
      .object({
        device_id: z.string().uuid().optional(),
        lang: z.enum(["sw", "en"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const lang = data.lang ?? "sw";

    let q = context.supabase
      .from("farm_finance")
      .select("entry_type, category, amount, currency, season, occurred_at, description")
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (data.device_id) q = q.eq("device_id", data.device_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let cropLine = "";
    if (data.device_id) {
      const { data: d } = await context.supabase
        .from("devices")
        .select("name, crop, location_name")
        .eq("id", data.device_id)
        .maybeSingle();
      if (d)
        cropLine = `Shamba: ${d.name}${d.crop ? ` · Zao: ${d.crop}` : ""}${d.location_name ? ` · ${d.location_name}` : ""}`;
    }

    if (!rows || rows.length === 0) {
      return {
        text:
          lang === "sw"
            ? "Bado hakuna kumbukumbu za fedha. Ongeza mapato na matumizi yako kwanza ili nikupe uchambuzi."
            : "No finance records yet. Add some income/expense entries first so I can analyze.",
      };
    }

    const totals = rows.reduce(
      (a, r) => {
        const amt = Number(r.amount) || 0;
        if (r.entry_type === "income") a.income += amt;
        else a.expense += amt;
        return a;
      },
      { income: 0, expense: 0 },
    );
    const byCat: Record<string, number> = {};
    for (const r of rows) {
      if (r.entry_type !== "expense") continue;
      const k = (r.category || "-").trim();
      byCat[k] = (byCat[k] || 0) + (Number(r.amount) || 0);
    }
    const topCats = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join("\n");
    const cur = rows[0]?.currency || "TZS";

    const userMsg = [
      cropLine,
      `Sarafu: ${cur}`,
      `Jumla mapato: ${totals.income} ${cur}`,
      `Jumla matumizi: ${totals.expense} ${cur}`,
      `Faida halisi (income - expense): ${totals.income - totals.expense} ${cur}`,
      `Idadi ya kumbukumbu: ${rows.length}`,
      "Matumizi makubwa kwa aina:",
      topCats,
      "",
      "Kumbukumbu 10 za karibuni:",
      ...rows
        .slice(0, 10)
        .map(
          (r) =>
            `  · ${r.occurred_at} ${r.entry_type === "income" ? "+" : "-"}${r.amount} ${r.currency} (${r.category || "-"}${r.season ? `, ${r.season}` : ""}${r.description ? ` — ${r.description}` : ""})`,
        ),
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const text = await generateAIText({
        instructions: lang === "sw" ? SYSTEM_SW : SYSTEM_EN,
        input: userMsg,
        maxOutputTokens: 700,
      });
      return { text };
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI error";
      if (
        message.includes("AI API key") ||
        message.includes("GEMINI_API_KEY") ||
        message.includes("OPENAI_API_KEY") ||
        message.includes("Missing")
      ) {
        throw new Error(
          lang === "sw"
            ? "AI API haijaunganishwa. Weka GEMINI_API_KEY au OPENAI_API_KEY kwenye server."
            : "AI API is not connected. Add GEMINI_API_KEY or OPENAI_API_KEY on the server.",
        );
      }
      throw new Error(
        lang === "sw" ? "AI imeshindwa kuchambua. Jaribu tena." : "AI failed to analyze.",
      );
    }
  });
