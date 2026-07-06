import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { region?: string; search?: string } | undefined) =>
    z.object({ region: z.string().optional(), search: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("suppliers")
      .select("id, business_name, description, region, district, village, latitude, longitude")
      .eq("is_active", true)
      .order("business_name", { ascending: true })
      .limit(200);
    if (data.region) q = q.ilike("region", `%${data.region}%`);
    if (data.search) q = q.ilike("business_name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getSupplier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: supplier, error } = await context.supabase
      .from("suppliers")
      .select(
        "id, owner_id, business_name, description, region, district, village, latitude, longitude, is_active, created_at, updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!supplier) return null;
    const { data: contactRows } = await context.supabase.rpc("get_supplier_contact", {
      _supplier_id: data.id,
    });
    const contact =
      Array.isArray(contactRows) && contactRows.length > 0
        ? contactRows[0]
        : { phone: null, whatsapp: null };
    const { data: products } = await context.supabase
      .from("supplier_products")
      .select("*")
      .eq("supplier_id", data.id)
      .order("name", { ascending: true });
    return {
      supplier: { ...supplier, phone: contact.phone, whatsapp: contact.whatsapp },
      products: products ?? [],
    };
  });

export const getMySupplier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: supplier } = await context.supabase
      .from("suppliers")
      .select(
        "id, owner_id, business_name, description, region, district, village, latitude, longitude, is_active, created_at, updated_at",
      )
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!supplier) return { supplier: null, products: [] };
    const { data: contactRows } = await context.supabase.rpc("get_supplier_contact", {
      _supplier_id: supplier.id,
    });
    const contact =
      Array.isArray(contactRows) && contactRows.length > 0
        ? contactRows[0]
        : { phone: null, whatsapp: null };
    const { data: products } = await context.supabase
      .from("supplier_products")
      .select("*")
      .eq("supplier_id", supplier.id)
      .order("name", { ascending: true });
    return {
      supplier: { ...supplier, phone: contact.phone, whatsapp: contact.whatsapp },
      products: products ?? [],
    };
  });

const supplierSchema = z.object({
  business_name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  region: z.string().max(80).optional().nullable(),
  district: z.string().max(80).optional().nullable(),
  village: z.string().max(80).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const upsertMySupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => supplierSchema.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, owner_id: context.userId };
    const { data: row, error } = await context.supabase
      .from("suppliers")
      .upsert(payload, { onConflict: "owner_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  category: z.string().max(80).optional().nullable(),
  unit: z.string().max(40).optional().nullable(),
  price: z.number().nonnegative(),
  currency: z.string().max(8).default("TZS"),
  stock: z.number().int().nullable().optional(),
  description: z.string().max(800).optional().nullable(),
  image_url: z.string().max(500).optional().nullable(),
  is_available: z.boolean().optional(),
});

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: my } = await context.supabase
      .from("suppliers")
      .select("id")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!my) throw new Error("Sajili duka lako kwanza.");
    const payload = { ...data, supplier_id: my.id };
    if (data.id) {
      const { error } = await context.supabase
        .from("supplier_products")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("supplier_products").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("supplier_products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
