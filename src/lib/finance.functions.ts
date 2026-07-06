import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { device_id?: string } | undefined) =>
    z.object({ device_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("farm_finance")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (data.device_id) q = q.eq("device_id", data.device_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const addSchema = z.object({
  device_id: z.string().uuid().nullable().optional(),
  season: z.string().max(60).default(""),
  entry_type: z.enum(["income", "expense"]),
  category: z.string().max(80).default(""),
  amount: z.number().nonnegative(),
  currency: z.string().max(8).default("TZS"),
  description: z.string().max(500).optional().nullable(),
  occurred_at: z.string().min(8).max(10),
});

export const addFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => addSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("farm_finance").insert({
      owner_id: context.userId,
      device_id: data.device_id ?? null,
      season: data.season,
      entry_type: data.entry_type,
      category: data.category,
      amount: data.amount,
      currency: data.currency,
      description: data.description ?? null,
      occurred_at: data.occurred_at,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("farm_finance").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
