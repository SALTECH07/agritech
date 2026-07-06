import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const exportAllMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

    const [
      devicesRes,
      alertsRes,
      commandsRes,
      weatherRes,
      adviceRes,
      profileRes,
      financeRes,
      supplierRes,
    ] = await Promise.all([
      supabase.from("devices").select("*").order("created_at", { ascending: false }),
      supabase.from("alerts").select("*").order("created_at", { ascending: false }),
      supabase.from("commands").select("*").order("created_at", { ascending: false }),
      supabase
        .from("weather_snapshots")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(2000),
      supabase.from("advice_log").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      supabase.from("farm_finance").select("*").order("occurred_at", { ascending: false }),
      supabase
        .from("suppliers")
        .select(
          "id, owner_id, business_name, description, region, district, village, latitude, longitude, is_active, created_at, updated_at",
        )
        .eq("owner_id", context.userId)
        .maybeSingle(),
    ]);

    const devices = devicesRes.data ?? [];
    const deviceIds = devices.map((d: { id: string }) => d.id);

    let readings: Array<Record<string, unknown>> = [];
    if (deviceIds.length) {
      const { data } = await supabase
        .from("readings")
        .select("*")
        .in("device_id", deviceIds)
        .order("recorded_at", { ascending: false })
        .limit(10000);
      readings = (data ?? []) as typeof readings;
    }

    let products: Array<Record<string, unknown>> = [];
    if (supplierRes.data?.id) {
      const { data } = await supabase
        .from("supplier_products")
        .select("*")
        .eq("supplier_id", supplierRes.data.id)
        .order("name", { ascending: true });
      products = (data ?? []) as typeof products;
    }

    // Flatten nested objects/arrays so XLSX renders them as readable JSON strings
    type Cell = string | number | boolean | null;
    const flatten = (rows: Array<Record<string, unknown>>): Array<Record<string, Cell>> =>
      rows.map((row) => {
        const out: Record<string, Cell> = {};
        for (const [k, v] of Object.entries(row)) {
          if (v === null || v === undefined) out[k] = "";
          else if (v instanceof Date) out[k] = v.toISOString();
          else if (typeof v === "object") out[k] = JSON.stringify(v);
          else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
            out[k] = v;
          else out[k] = String(v);
        }
        return out;
      });

    return {
      profile: flatten(profileRes.data ? [profileRes.data] : []),
      devices: flatten(devices),
      readings: flatten(readings),
      alerts: flatten(alertsRes.data ?? []),
      commands: flatten(commandsRes.data ?? []),
      weather_snapshots: flatten(weatherRes.data ?? []),
      advice_log: flatten(adviceRes.data ?? []),
      farm_finance: flatten(financeRes.data ?? []),
      supplier_shop: flatten(supplierRes.data ? [supplierRes.data] : []),
      supplier_products: flatten(products),
    };
  });
