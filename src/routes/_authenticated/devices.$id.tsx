import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Droplets,
  ThermometerSun,
  FlaskConical,
  Wind,
  Power,
  CloudRain,
  Sparkles,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDevice, issueCommand, deleteDevice } from "@/lib/devices.functions";
import { getDeviceAdvice } from "@/lib/ai-advice.functions";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { FarmFinanceSection } from "@/components/farm-finance-section";

export const Route = createFileRoute("/_authenticated/devices/$id")({
  head: () => ({ meta: [{ title: "Kifaa — Veta Kipawa" }] }),
  component: DeviceDetail,
});

const PUBLIC_OPERATION_BASE_URL = "https://farming-guide.com";

function getDeviceCloudBaseUrl() {
  if (typeof window === "undefined") return PUBLIC_OPERATION_BASE_URL;
  const origin = window.location.origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|$)/i.test(origin)) {
    return PUBLIC_OPERATION_BASE_URL;
  }
  return origin;
}

function DeviceDetail() {
  const { id } = Route.useParams();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getDevice);
  const cmdFn = useServerFn(issueCommand);
  const adviceFn = useServerFn(getDeviceAdvice);
  const delFn = useServerFn(deleteDevice);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["device", id],
    queryFn: () => getFn({ data: { id } }),
    refetchInterval: 5_000,
  });

  // Realtime: refresh instantly when hardware posts a new reading / command ack
  useEffect(() => {
    const ch = supabase
      .channel(`device-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings", filter: `device_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["device", id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "devices", filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["device", id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commands", filter: `device_id=eq.${id}` },
        (payload) => {
          const row = payload.new as { status?: string; kind?: string } | null;
          if (row?.status === "acked") toast.success(`Kifaa kimepokea: ${row.kind}`);
          qc.invalidateQueries({ queryKey: ["device", id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  // "Sekunde X zilizopita" — auto-tick every second
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sendCmd = useMutation({
    mutationFn: (kind: "pump_on" | "pump_off" | "valve_on" | "valve_off") =>
      cmdFn({ data: { device_id: id, kind, payload: {} } }),
    onSuccess: () => {
      toast.success("Amri imetumwa");
      qc.invalidateQueries({ queryKey: ["device", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("error_generic")),
  });

  const askAi = useMutation({
    mutationFn: () => adviceFn({ data: { device_id: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["device", id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : t("error_generic")),
  });

  const remove = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("saved"));
      navigate({ to: "/devices" });
    },
  });

  if (isLoading || !data) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  }

  const { device, latest: latestRaw, history, weather, advice } = data;
  const deviceCloudBaseUrl = getDeviceCloudBaseUrl();
  const isOnline =
    device.online && device.last_seen_at
      ? Date.now() - new Date(device.last_seen_at).getTime() < 10 * 60 * 1000
      : false;

  const readingAgeMs = latestRaw?.recorded_at
    ? nowTick - new Date(latestRaw.recorded_at).getTime()
    : Number.POSITIVE_INFINITY;
  const latest = latestRaw;
  const safeSoilMoisture = latest?.soil_moisture ?? null;
  const safeWaterLevel = latest?.water_level ?? null;

  const moistureColor = (m: number | null | undefined) => {
    if (m == null) return "muted";
    if (m < Number(device.pump_on_threshold)) return "destructive";
    if (m < Number(device.target_moisture) - 10) return "warning";
    return "success";
  };

  const copyKey = async () => {
    await navigator.clipboard.writeText(device.device_key);
    setCopied(true);
    toast.success("Device key copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/devices"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> {t("devices")}
        </Link>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold " +
            (isOnline ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")
          }
        >
          <span
            className={
              "h-1.5 w-1.5 rounded-full " + (isOnline ? "bg-success" : "bg-muted-foreground")
            }
          />
          {isOnline ? t("online") : t("offline")}
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{device.name}</h1>
        <p className="text-sm text-muted-foreground">
          {device.crop || "—"} · {device.location_name || "—"}
        </p>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 text-sm font-semibold text-muted-foreground">{t("quick_actions")}</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Button
            onClick={() => sendCmd.mutate("pump_on")}
            disabled={sendCmd.isPending}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            <Power className="mr-2 h-4 w-4" /> {t("turn_pump_on")}
          </Button>
          <Button
            onClick={() => sendCmd.mutate("pump_off")}
            disabled={sendCmd.isPending}
            variant="outline"
          >
            <Power className="mr-2 h-4 w-4" /> {t("turn_pump_off")}
          </Button>
          <Button
            onClick={() => sendCmd.mutate("valve_on")}
            disabled={sendCmd.isPending}
            variant="outline"
          >
            <Droplets className="mr-2 h-4 w-4" /> {t("open_valve")}
          </Button>
          <Button
            onClick={() => sendCmd.mutate("valve_off")}
            disabled={sendCmd.isPending}
            variant="outline"
          >
            <Droplets className="mr-2 h-4 w-4" /> {t("close_valve")}
          </Button>
        </div>
      </div>

      {!latestRaw ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
          Sensor bado haijatuma data yoyote. Hakikisha kifaa chako cha IoT kimeunganishwa na
          kinatuma readings.
        </div>
      ) : null}

      {/* Device serial-style diagnostics */}
      {latestRaw
        ? (() => {
            const raw = (latestRaw.raw ?? {}) as Record<string, unknown>;
            const fmt = (value: unknown, suffix = "") =>
              typeof value === "number" && Number.isFinite(value)
                ? `${value.toFixed(2).replace(/\.00$/, "")}${suffix}`
                : "—";
            const sensorAgeSeconds = latestRaw.recorded_at
              ? Math.max(
                  0,
                  Math.floor((nowTick - new Date(latestRaw.recorded_at).getTime()) / 1000),
                )
              : null;

            // Derive diagnostics with fallbacks when firmware doesn't send them explicitly.
            const pick = (...keys: string[]) => {
              for (const k of keys) {
                const v = raw[k];
                if (v != null && v !== "") return v;
              }
              return null;
            };
            const apiHost =
              pick("api_host", "host", "api") ?? (readingAgeMs < 3 * 60 * 1000 ? "primary" : "—");
            const wifiRssi = pick("wifi_rssi", "rssi");
            const wifiSsid = pick("wifi_ssid", "ssid");
            const fw = pick("firmware_version", "fw", "version") ?? "unknown";

            // Compute variance from recent history if firmware doesn't send it.
            const computeVar = (
              extract: (r: (typeof history)[number]) => number | null | undefined,
            ) => {
              const values = history
                .slice(-15)
                .map(extract)
                .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
              if (values.length < 3) return null;
              const mean = values.reduce((a, b) => a + b, 0) / values.length;
              const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
              return Math.round(variance * 100) / 100;
            };
            const varSoil =
              pick("soil_raw_window_variance", "soil_raw_variance", "soil_variance") ??
              computeVar((r) => r.soil_moisture as number | null);
            const varWater =
              pick("water_raw_window_variance", "water_raw_variance", "water_variance") ??
              computeVar((r) => r.water_level as number | null);

            return (
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-muted-foreground">Diagnostics</div>
                  <div className="text-[11px] text-muted-foreground">
                    {sensorAgeSeconds != null ? `${sensorAgeSeconds}s zilizopita` : "—"}
                  </div>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <code className="rounded-md bg-muted px-2 py-1">
                    soil_raw={String(raw?.soil_moisture_raw ?? "—")}
                  </code>
                  <code className="rounded-md bg-muted px-2 py-1">
                    soil={fmt(latestRaw.soil_moisture, "%")}
                  </code>
                  <code className="rounded-md bg-muted px-2 py-1">ph={fmt(latestRaw.soil_ph)}</code>
                  <code className="rounded-md bg-muted px-2 py-1">
                    temp={fmt(latestRaw.air_temp, "°C")}
                  </code>
                  <code className="rounded-md bg-muted px-2 py-1">
                    hum={fmt(latestRaw.air_humidity, "%")}
                  </code>
                  <code className="rounded-md bg-muted px-2 py-1">
                    water_raw={String(raw?.water_level_raw ?? "—")}
                  </code>
                  <code className="rounded-md bg-muted px-2 py-1">
                    tank={fmt(latestRaw.water_level, "%")}
                  </code>
                  <code className="rounded-md bg-muted px-2 py-1">api={String(apiHost)}</code>
                  <code className="rounded-md bg-muted px-2 py-1">
                    wifi={wifiRssi != null ? `${wifiRssi} dBm` : "—"}
                    {wifiSsid ? ` (${wifiSsid})` : ""}
                  </code>
                  <code className="rounded-md bg-muted px-2 py-1">fw={String(fw)}</code>
                  <code className="rounded-md bg-muted px-2 py-1">
                    var_soil={varSoil != null ? String(varSoil) : "—"}
                  </code>
                  <code className="rounded-md bg-muted px-2 py-1">
                    var_water={varWater != null ? String(varWater) : "—"}
                  </code>
                </div>
              </div>
            );
          })()
        : null}

      {/* Readings */}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          tone={moistureColor(safeSoilMoisture)}
          icon={<Droplets className="h-5 w-5" />}
          label={t("moisture")}
          value={safeSoilMoisture != null ? `${Number(safeSoilMoisture).toFixed(1)}%` : "—"}
        />
        <MetricCard
          tone="soil"
          icon={<FlaskConical className="h-5 w-5" />}
          label={t("ph")}
          value={latest?.soil_ph != null ? Number(latest.soil_ph).toFixed(2) : "—"}
        />
        <MetricCard
          tone="warning"
          icon={<ThermometerSun className="h-5 w-5" />}
          label={t("temp")}
          value={latest?.air_temp != null ? `${Number(latest.air_temp).toFixed(1)}°C` : "—"}
        />
        <MetricCard
          tone="sky"
          icon={<Wind className="h-5 w-5" />}
          label={t("humidity")}
          value={latest?.air_humidity != null ? `${Number(latest.air_humidity).toFixed(1)}%` : "—"}
        />
      </div>

      {(() => {
        const raw = (latest?.raw ?? {}) as Record<string, unknown>;
        const soilRaw = typeof raw?.soil_moisture_raw === "number" ? raw.soil_moisture_raw : null;
        const waterRaw = typeof raw?.water_level_raw === "number" ? raw.water_level_raw : null;
        const recorded = latest?.recorded_at ? new Date(latest.recorded_at) : null;
        const fmtNum = (v: unknown, d = 1, suf = "") =>
          typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(d)}${suf}` : "—";
        return (
          <div className="rounded-xl border bg-card p-3 text-[11px] text-muted-foreground">
            <div className="mb-1 font-semibold text-foreground">Live sensor readout</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Soil:{" "}
                <span className="font-mono text-foreground">
                  {fmtNum(safeSoilMoisture, 1, "%")}
                </span>
              </span>
              <span>
                pH: <span className="font-mono text-foreground">{fmtNum(latest?.soil_ph, 2)}</span>
              </span>
              <span>
                Temp:{" "}
                <span className="font-mono text-foreground">
                  {fmtNum(latest?.air_temp, 1, "°C")}
                </span>
              </span>
              <span>
                Hum:{" "}
                <span className="font-mono text-foreground">
                  {fmtNum(latest?.air_humidity, 1, "%")}
                </span>
              </span>
              <span>
                Tank:{" "}
                <span className="font-mono text-foreground">{fmtNum(safeWaterLevel, 1, "%")}</span>
              </span>
              <span>
                Pump:{" "}
                <span className="font-mono text-foreground">{latest?.pump_on ? "ON" : "OFF"}</span>
              </span>
              <span>
                Valve:{" "}
                <span className="font-mono text-foreground">
                  {latest?.valve_on ? "OPEN" : "CLOSED"}
                </span>
              </span>
              {soilRaw != null && (
                <span>
                  Soil ADC: <span className="font-mono text-foreground">{soilRaw}</span>
                </span>
              )}
              {waterRaw != null && (
                <span>
                  Tank ADC: <span className="font-mono text-foreground">{waterRaw}</span>
                </span>
              )}
              {recorded && (
                <span>
                  Sensor time:{" "}
                  <span className="font-mono text-foreground">{recorded.toLocaleTimeString()}</span>
                  {" · "}
                  {Math.max(0, Math.floor((nowTick - recorded.getTime()) / 1000))}s
                </span>
              )}
            </div>
          </div>
        );
      })()}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t("pump")}</div>
          <div
            className={
              "mt-1 text-lg font-bold " +
              (latest?.pump_on ? "text-success" : "text-muted-foreground")
            }
          >
            {latest?.pump_on ? t("on") : t("off")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Valve</div>
          <div
            className={
              "mt-1 text-lg font-bold " +
              (latest?.valve_on ? "text-success" : "text-muted-foreground")
            }
          >
            {latest?.valve_on ? t("on") : t("off")}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Tank</div>
            <Droplets className="h-4 w-4 text-sky" />
          </div>
          <div className="mt-1 text-lg font-bold">
            {safeWaterLevel != null ? `${Number(safeWaterLevel).toFixed(1)}%` : "—"}
          </div>
          {(() => {
            const raw = (latest?.raw as { water_level_raw?: number } | null | undefined)
              ?.water_level_raw;
            return typeof raw === "number" ? (
              <div className="mt-1 text-[10px] text-muted-foreground">
                ADC: {raw} · rekebisha calibration kama % si sahihi
              </div>
            ) : null;
          })()}
          {latest?.tank_fill_needed ? (
            <div className="mt-1 text-[11px] font-medium text-warning-foreground">
              Inahitaji kujazwa
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border bg-card p-4 sm:col-span-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{t("rain_prob")}</div>
            <CloudRain className="h-4 w-4 text-sky" />
          </div>
          <div className="mt-1 text-lg font-bold">
            {weather?.rain_probability != null
              ? `${Number(weather.rain_probability).toFixed(0)}%`
              : "—"}
            {weather?.rain_amount_mm != null ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {Number(weather.rain_amount_mm).toFixed(1)} mm
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* AI Advice */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent-foreground" />
            {t("advice")}
          </div>
          <Button size="sm" onClick={() => askAi.mutate()} disabled={askAi.isPending}>
            {askAi.isPending ? "..." : t("get_ai_advice")}
          </Button>
        </div>
        <p className="text-base">{askAi.data?.message ?? advice?.message ?? "—"}</p>
      </div>

      {/* Chart */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 text-sm font-semibold text-muted-foreground">{t("last_24h")}</div>
        {history.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t("no_readings_yet")}
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={history.map((h) => ({
                  ...h,
                  t:
                    new Date(h.recorded_at).getHours() +
                    ":" +
                    String(new Date(h.recorded_at).getMinutes()).padStart(2, "0"),
                }))}
              >
                <defs>
                  <linearGradient id="m" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="soil_moisture"
                  stroke="var(--primary)"
                  fill="url(#m)"
                  name={t("moisture")}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Device key + danger zone */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 text-sm font-semibold text-muted-foreground">{t("device_key")}</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">
            {device.device_key}
          </code>
          <Button size="sm" variant="outline" onClick={copyKey}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("device_key_help")}</p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-primary">
            {t("setup_instructions")}
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-[11px]">
            {`// IoT device - kwenye firmware/arduino_secrets.h
#define FARM_CLOUD_BASE_URL_PRIMARY "${deviceCloudBaseUrl}"
#define FARM_DEVICE_API_KEY "${device.device_key}"

// POST ${"${FARM_CLOUD_BASE_URL_PRIMARY}"}/api/public/readings
//   Headers: X-API-Key: ${"${FARM_DEVICE_API_KEY}"}
//   Body (JSON): { "soil_moisture": 32.5, "soil_ph": 6.4, "air_temp": 27, "air_humidity": 60, "pump_on": false, "valve_on": false, "weather": { "rain_probability": 10, "rain_amount_mm": 0 } }
// GET ${"${FARM_CLOUD_BASE_URL_PRIMARY}"}/api/public/commands/next
// POST ${"${FARM_CLOUD_BASE_URL_PRIMARY}"}/api/public/devices/ack
// GET ${"${FARM_CLOUD_BASE_URL_PRIMARY}"}/api/public/irrigation/decision
// GET ${"${FARM_CLOUD_BASE_URL_PRIMARY}"}/api/public/advice/latest`}
          </pre>
        </details>
      </div>

      <FarmFinanceSection deviceId={id} />

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => {
            if (confirm("Futa kifaa hiki?")) remove.mutate();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Futa kifaa
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {lang === "sw" ? "Imeonekana mwisho" : "Last seen"}:{" "}
        {device.last_seen_at ? (
          <>
            {new Date(device.last_seen_at).toLocaleString()}
            {" · "}
            <span className="font-medium text-foreground">
              {Math.max(0, Math.floor((nowTick - new Date(device.last_seen_at).getTime()) / 1000))}s
            </span>
          </>
        ) : (
          "—"
        )}
      </div>
    </div>
  );
}

function MetricCard({
  tone,
  icon,
  label,
  value,
}: {
  tone: "primary" | "success" | "warning" | "destructive" | "muted" | "soil" | "sky";
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
    soil: "bg-soil/15 text-soil",
    sky: "bg-sky/25 text-sky-foreground",
  } as const;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={"inline-flex h-7 w-7 items-center justify-center rounded-md " + toneMap[tone]}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
