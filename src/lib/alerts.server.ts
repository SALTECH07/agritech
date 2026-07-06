// Server-only notification engine.
// Evaluates a fresh reading against thresholds + weather and dispatches
// in-app / SMS / WhatsApp messages through Twilio (gateway).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

type AlertKind = "low_moisture" | "rain_incoming" | "device_online";

const COOLDOWN_HOURS: Record<AlertKind, number> = {
  low_moisture: 6,
  rain_incoming: 12,
  device_online: 1,
};

interface DeviceRow {
  id: string;
  owner_id: string | null;
  name: string;
  crop: string | null;
  pump_on_threshold: number;
  is_claimed: boolean;
}

interface ProfileRow {
  full_name: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  language: string;
  notify_in_app: boolean;
  notify_sms: boolean;
  notify_whatsapp: boolean;
}

async function recentAlertExists(device_id: string, kind: AlertKind) {
  const since = new Date(Date.now() - COOLDOWN_HOURS[kind] * 3600 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("alerts")
    .select("id")
    .eq("device_id", device_id)
    .eq("kind", kind)
    .gte("created_at", since)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function sendTwilio(params: { to: string; from: string; body: string }) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey || !twilioKey) {
    return { ok: false, error: "twilio_not_configured" as const };
  }
  const form = new URLSearchParams({
    To: params.to,
    From: params.from,
    Body: params.body,
  });
  const res = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `twilio_${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

async function writeAlert(args: {
  user_id: string;
  device_id: string;
  kind: AlertKind;
  channel: "in_app" | "sms" | "whatsapp";
  level: "info" | "warning" | "danger";
  title: string;
  body: string;
  sent: boolean;
}) {
  await supabaseAdmin.from("alerts").insert({
    user_id: args.user_id,
    device_id: args.device_id,
    kind: args.kind,
    channel: args.channel,
    level: args.level,
    title: args.title,
    body: args.body,
    sent_at: args.sent ? new Date().toISOString() : null,
  });
}

function buildMessage(
  kind: AlertKind,
  lang: string,
  device: DeviceRow,
  payload: Record<string, unknown>,
): { title: string; body: string; level: "info" | "warning" | "danger" } {
  const sw = lang !== "en";
  if (kind === "low_moisture") {
    const moisture = Number(payload.moisture ?? 0).toFixed(0);
    return sw
      ? {
          title: `Unyevu mdogo: ${device.name}`,
          body: `Udongo wa ${device.name} (${device.crop ?? "shamba"}) uko ${moisture}%, chini ya ${device.pump_on_threshold}%. Washa pampu.`,
          level: "warning",
        }
      : {
          title: `Low moisture: ${device.name}`,
          body: `${device.name} (${device.crop ?? "field"}) soil is at ${moisture}%, below ${device.pump_on_threshold}%. Turn on the pump.`,
          level: "warning",
        };
  }
  if (kind === "rain_incoming") {
    const mm = Number(payload.rain_mm ?? 0).toFixed(1);
    return sw
      ? {
          title: `Mvua inakuja: ${device.name}`,
          body: `Mvua ya ~${mm}mm inatarajiwa karibu na ${device.name}. Usimwagilie leo.`,
          level: "info",
        }
      : {
          title: `Rain expected: ${device.name}`,
          body: `About ${mm}mm of rain expected near ${device.name}. Skip watering today.`,
          level: "info",
        };
  }
  // device_online
  const when = new Date().toLocaleTimeString(sw ? "sw-TZ" : "en-US");
  return sw
    ? {
        title: `Kifaa kinafanya kazi: ${device.name}`,
        body: `Kifaa cha IoT cha ${device.name} (${device.crop ?? "shamba"}) kimeanza kutuma taarifa saa ${when}.`,
        level: "info",
      }
    : {
        title: `Device online: ${device.name}`,
        body: `IoT device for ${device.name} (${device.crop ?? "field"}) started reporting at ${when}.`,
        level: "info",
      };
}

async function dispatch(
  device: DeviceRow,
  profile: ProfileRow,
  kind: AlertKind,
  payload: Record<string, unknown>,
) {
  if (!device.owner_id) return;
  const msg = buildMessage(kind, profile.language, device, payload);

  if (profile.notify_in_app) {
    await writeAlert({
      user_id: device.owner_id,
      device_id: device.id,
      kind,
      channel: "in_app",
      level: msg.level,
      title: msg.title,
      body: msg.body,
      sent: true,
    });
  }

  const smsFrom = process.env.TWILIO_FROM_SMS;
  if (profile.notify_sms && profile.phone && smsFrom) {
    const r = await sendTwilio({
      to: profile.phone,
      from: smsFrom,
      body: `${msg.title}\n${msg.body}`,
    });
    await writeAlert({
      user_id: device.owner_id,
      device_id: device.id,
      kind,
      channel: "sms",
      level: msg.level,
      title: msg.title,
      body: r.ok ? msg.body : `${msg.body} [${r.error}]`,
      sent: r.ok,
    });
  }

  const waFrom = process.env.TWILIO_FROM_WHATSAPP; // e.g. whatsapp:+14155238886
  const waTo = profile.whatsapp_phone ?? profile.phone;
  if (profile.notify_whatsapp && waTo && waFrom) {
    const to = waTo.startsWith("whatsapp:") ? waTo : `whatsapp:${waTo}`;
    const from = waFrom.startsWith("whatsapp:") ? waFrom : `whatsapp:${waFrom}`;
    const r = await sendTwilio({ to, from, body: `${msg.title}\n${msg.body}` });
    await writeAlert({
      user_id: device.owner_id,
      device_id: device.id,
      kind,
      channel: "whatsapp",
      level: msg.level,
      title: msg.title,
      body: r.ok ? msg.body : `${msg.body} [${r.error}]`,
      sent: r.ok,
    });
  }
}

export async function evaluateAlerts(args: {
  device: DeviceRow;
  soil_moisture: number | null;
  rain_amount_mm?: number | null;
  rain_probability?: number | null;
  was_offline?: boolean;
}) {
  const { device } = args;
  if (!device.is_claimed || !device.owner_id) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select(
      "full_name, phone, whatsapp_phone, language, notify_in_app, notify_sms, notify_whatsapp",
    )
    .eq("id", device.owner_id)
    .maybeSingle();
  if (!profile) return;
  const p = profile as ProfileRow;

  // Low moisture
  if (
    typeof args.soil_moisture === "number" &&
    args.soil_moisture < Number(device.pump_on_threshold) &&
    !(await recentAlertExists(device.id, "low_moisture"))
  ) {
    await dispatch(device, p, "low_moisture", { moisture: args.soil_moisture });
  }

  // Rain incoming
  const mm = args.rain_amount_mm ?? 0;
  const prob = args.rain_probability ?? 0;
  if ((mm > 2 || prob > 70) && !(await recentAlertExists(device.id, "rain_incoming"))) {
    await dispatch(device, p, "rain_incoming", { rain_mm: mm, rain_probability: prob });
  }

  // Device came back online
  if (args.was_offline && !(await recentAlertExists(device.id, "device_online"))) {
    await dispatch(device, p, "device_online", {});
  }
}
