import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCropMoistureSettings } from "@/lib/crop-presets";

// ============ LIST DEVICES ============
export const listMyDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("devices")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ============ GET ONE DEVICE + LATEST READING ============
export const getDevice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: device, error } = await context.supabase
      .from("devices")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!device) throw new Error("Device not found");

    const { data: latest } = await context.supabase
      .from("readings")
      .select("*")
      .eq("device_id", data.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: history } = await context.supabase
      .from("readings")
      .select(
        "recorded_at, soil_moisture, soil_ph, air_temp, air_humidity, water_level, pump_on, raw",
      )
      .eq("device_id", data.id)
      .gte("recorded_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("recorded_at", { ascending: true })
      .limit(500);

    const { data: weather } = await context.supabase
      .from("weather_snapshots")
      .select("*")
      .eq("device_id", data.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: advice } = await context.supabase
      .from("advice_log")
      .select("*")
      .eq("device_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { device, latest, history: history ?? [], weather, advice };
  });

// (createDevice removed — devices now self-register via /api/public/devices/register and are claimed via claimDevice below.)

// ============ CLAIM DEVICE (after hardware self-registered) ============
const claimDeviceSchema = z.object({
  // Accept either a short claim_code (e.g. A3K7QZ) OR the full device_key
  // (e.g. dk_abcd...) so users with pre-flashed hardware can pair without
  // needing the short code.
  claim_code: z.string().trim().min(4).max(80),
  name: z.string().min(1).max(80),
  crop: z.string().max(80).optional(),
  location_name: z.string().max(120).optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  target_moisture: z.number().min(0).max(100).optional(),
  pump_on_threshold: z.number().min(0).max(100).optional(),
  pump_off_threshold: z.number().min(0).max(100).optional(),
  ip_address: z.string().max(45).optional(),
  operator_name: z.string().max(120).optional(),
  dashboard_widgets: z
    .array(z.enum(["moisture", "ph", "air_temp", "air_humidity", "pump", "weather"]))
    .optional(),
});

export const claimDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => claimDeviceSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Use service role to find the unclaimed device by code (RLS hides it otherwise)
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Hardware claim needs SUPABASE_SERVICE_ROLE_KEY on the server. Use Manual create to generate a device key now, or add the service-role key before claiming hardware.",
      );
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const moisture = resolveCropMoistureSettings(data.crop, data);
    const raw = data.claim_code.trim();
    const asCode = raw.toUpperCase();
    // Look up by claim_code (short) OR device_key (long "dk_..." token)
    const { data: dev, error: findErr } = await supabaseAdmin
      .from("devices")
      .select("id, is_claimed, owner_id, device_key")
      .or(`claim_code.eq.${asCode},device_key.eq.${raw}`)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!dev)
      throw new Error("Kifaa hakipatikani. Hakikisha umeandika Claim Code au Device Key sawasawa.");
    if (dev.is_claimed && dev.owner_id !== context.userId) {
      throw new Error("Kifaa hiki tayari kimesajiliwa na mkulima mwingine.");
    }

    const { error: upErr } = await supabaseAdmin
      .from("devices")
      .update({
        owner_id: context.userId,
        is_claimed: true,
        claimed_at: new Date().toISOString(),
        claim_code: null,
        name: data.name,
        crop: moisture.crop,
        location_name: data.location_name ?? null,
        lat: data.lat ?? null,
        lon: data.lon ?? null,
        target_moisture: moisture.target_moisture,
        pump_on_threshold: moisture.pump_on_threshold,
        pump_off_threshold: moisture.pump_off_threshold,
        ip_address: data.ip_address ?? null,
        operator_name: data.operator_name ?? null,
        ...(data.dashboard_widgets ? { dashboard_widgets: data.dashboard_widgets } : {}),
      })
      .eq("id", dev.id);
    if (upErr) throw new Error(upErr.message);
    return { id: dev.id, device_key: dev.device_key };
  });

// ============ MANUAL CREATE DEVICE (no physical hardware yet) ============
// Generates a device_key + hardware_id slot for the user. They can flash
// the firmware later with the returned device_key, or simply use the app
// to monitor while the device is offline.
const manualDeviceSchema = z.object({
  name: z.string().min(1).max(80),
  crop: z.string().max(80).optional(),
  location_name: z.string().max(120).optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  target_moisture: z.number().min(0).max(100).optional(),
  pump_on_threshold: z.number().min(0).max(100).optional(),
  pump_off_threshold: z.number().min(0).max(100).optional(),
  ip_address: z.string().max(45).optional(),
  operator_name: z.string().max(120).optional(),
  dashboard_widgets: z
    .array(z.enum(["moisture", "ph", "air_temp", "air_humidity", "pump", "weather"]))
    .optional(),
});

function genKey(prefix: string, bytes: number) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return prefix + Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const createManualDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => manualDeviceSchema.parse(d))
  .handler(async ({ data, context }) => {
    const moisture = resolveCropMoistureSettings(data.crop, data);
    const device_key = genKey("dk_", 24);
    const hardware_id = genKey("manual-", 6);
    const payload = {
      owner_id: context.userId,
      is_claimed: true,
      claimed_at: new Date().toISOString(),
      device_key,
      hardware_id,
      claim_code: null,
      name: data.name,
      crop: moisture.crop,
      location_name: data.location_name ?? null,
      lat: data.lat ?? null,
      lon: data.lon ?? null,
      target_moisture: moisture.target_moisture,
      pump_on_threshold: moisture.pump_on_threshold,
      pump_off_threshold: moisture.pump_off_threshold,
      ip_address: data.ip_address ?? null,
      operator_name: data.operator_name ?? null,
      ...(data.dashboard_widgets ? { dashboard_widgets: data.dashboard_widgets } : {}),
    };

    const { data: inserted, error } = await context.supabase
      .from("devices")
      .insert(payload)
      .select("id")
      .single();

    if (!error && inserted) return { id: inserted.id, device_key };

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: adminInserted, error: adminError } = await supabaseAdmin
        .from("devices")
        .insert(payload)
        .select("id")
        .single();

      if (adminError) throw new Error(adminError.message);
      return { id: adminInserted.id, device_key };
    }

    if (error) throw new Error(error.message);
    throw new Error("Device was not created. Please try again.");
  });

// ============ UPDATE THRESHOLDS ============
const updateThresholdsSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  crop: z.string().max(80).nullable().optional(),
  target_moisture: z.number().min(0).max(100).optional(),
  pump_on_threshold: z.number().min(0).max(100).optional(),
  pump_off_threshold: z.number().min(0).max(100).optional(),
  ip_address: z.string().max(45).nullable().optional(),
  operator_name: z.string().max(120).nullable().optional(),
  dashboard_widgets: z
    .array(z.enum(["moisture", "ph", "air_temp", "air_humidity", "pump", "weather"]))
    .optional(),
});

export const updateDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => updateThresholdsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("devices").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ DELETE DEVICE ============
export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ISSUE COMMAND ============
const cmdSchema = z.object({
  device_id: z.string().uuid(),
  kind: z.enum(["pump_on", "pump_off", "valve_on", "valve_off", "set_thresholds"]),
  payload: z.record(z.string(), z.any()).default({}),
});

export const issueCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => cmdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: cmd, error } = await context.supabase
      .from("commands")
      .insert({
        device_id: data.device_id,
        kind: data.kind,
        payload: data.payload,
        issued_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Write an in-app alert so the user sees a confirmation in the
    // Notifications panel and via the realtime toast subscription.
    const { data: dev } = await context.supabase
      .from("devices")
      .select("name, crop")
      .eq("id", data.device_id)
      .maybeSingle();
    const label: Record<typeof data.kind, { sw: string; en: string }> = {
      pump_on: { sw: "Pampu imewashwa", en: "Pump turned ON" },
      pump_off: { sw: "Pampu imezimwa", en: "Pump turned OFF" },
      valve_on: { sw: "Valve imefunguliwa", en: "Valve OPENED" },
      valve_off: { sw: "Valve imefungwa", en: "Valve CLOSED" },
      set_thresholds: { sw: "Viwango vimebadilishwa", en: "Thresholds updated" },
    };
    const name = dev?.name ?? "kifaa";
    await context.supabase.from("alerts").insert({
      user_id: context.userId,
      device_id: data.device_id,
      kind: `command_${data.kind}`,
      channel: "in_app",
      level: "info",
      title: `${label[data.kind].sw} — ${name}`,
      body: `Amri imetumwa kwa kifaa cha ${name}${dev?.crop ? ` (${dev.crop})` : ""}. Inasubiri uthibitisho kutoka kifaani.`,
      sent_at: new Date().toISOString(),
    });
    return { ok: true, command_id: cmd?.id };
  });

// ============ ALERTS ============
export const listMyAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markAlertRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ PROFILE ============
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        full_name: z.string().max(120).optional(),
        phone: z.string().max(20).optional(),
        whatsapp_phone: z.string().max(20).optional(),
        language: z.enum(["sw", "en"]).optional(),
        default_location_name: z.string().max(120).optional(),
        notify_in_app: z.boolean().optional(),
        notify_sms: z.boolean().optional(),
        notify_whatsapp: z.boolean().optional(),
        avatar_url: z.string().url().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ id: context.userId, ...data })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
