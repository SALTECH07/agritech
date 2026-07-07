import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import {
  Brain,
  Camera,
  Check,
  Code2,
  Copy,
  Droplets,
  ExternalLink,
  Globe2,
  KeyRound,
  LocateFixed,
  MapPin,
  PencilLine,
  Settings,
  Sprout,
} from "lucide-react";
import { z } from "zod";
import { claimDevice, createManualDevice } from "@/lib/devices.functions";
import { CROP_PRESETS, findCropPreset, getCropMoisturePlan } from "@/lib/crop-presets";
import { useT, type DictKey, type Lang } from "@/lib/i18n";
import { getFlaskToken } from "@/lib/flask-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const searchSchema = z.object({ code: z.string().optional() });
const PUBLIC_OPERATION_BASE_URL = "https://farming-guide.com";

export const Route = createFileRoute("/_authenticated/devices/new")({
  head: () => ({ meta: [{ title: "Ongeza Kifaa - Veta Kipawa" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: NewDevicePage,
});

function extractCodeFromText(text: string): string | null {
  const trimmed = text.trim();
  try {
    const u = new URL(trimmed);
    const c = u.searchParams.get("code");
    if (c) return c.toUpperCase();
  } catch {
    // not a URL
  }
  const m = trimmed.match(/[A-Z2-9]{6}/i);
  return m ? m[0].toUpperCase() : null;
}

type DashboardWidget = "moisture" | "ph" | "air_temp" | "air_humidity" | "pump" | "weather";
const ALL_WIDGETS: DashboardWidget[] = [
  "moisture",
  "ph",
  "air_temp",
  "air_humidity",
  "pump",
  "weather",
];

type GeoStatus = "idle" | "loading" | "ready" | "denied" | "unavailable";

type GeneratedApiSetup = {
  deviceId: string;
  deviceKey: string;
  baseUrl: string;
  devicePageUrl: string;
  readingsUrl: string;
  configUrl: string;
  commandsUrl: string;
  decisionUrl: string;
  adviceUrl: string;
  ackUrl: string;
  examplePayload: string;
  quickSendExample: string;
};

type DeviceForm = {
  name: string;
  crop: string;
  location_name: string;
  lat: string;
  lon: string;
  target_moisture: number;
  pump_on_threshold: number;
  pump_off_threshold: number;
  ip_address: string;
  operator_name: string;
  dashboard_widgets: DashboardWidget[];
};

const blankForm = (): DeviceForm => {
  const maize = findCropPreset("mahindi");
  return {
    name: "",
    crop: maize?.name_sw ?? "Mahindi",
    location_name: "",
    lat: "",
    lon: "",
    target_moisture: maize?.target_moisture ?? 45,
    pump_on_threshold: maize?.pump_on_threshold ?? 30,
    pump_off_threshold: maize?.pump_off_threshold ?? 55,
    ip_address: "",
    operator_name: "",
    dashboard_widgets: [...ALL_WIDGETS],
  };
};

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function buildSafeDeviceName(form: DeviceForm, lang: Lang) {
  const typedName = form.name.trim();
  if (typedName) return typedName.slice(0, 80);

  const parts = [form.crop.trim(), form.location_name.trim()].filter(Boolean);
  const generated =
    parts.length > 0 ? parts.join(" - ") : lang === "sw" ? "Kifaa cha shamba" : "Farm device";
  return generated.slice(0, 80);
}

function getControllerBaseUrl() {
  if (typeof window === "undefined") return PUBLIC_OPERATION_BASE_URL;
  const origin = window.location.origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|$)/i.test(origin)) {
    return PUBLIC_OPERATION_BASE_URL;
  }
  return origin;
}

function buildGeneratedApiSetup(deviceId: string, deviceKey: string): GeneratedApiSetup {
  const baseUrl = getControllerBaseUrl();
  const readingsUrl = `${baseUrl}/api/public/readings`;
  const examplePayload = JSON.stringify(
    {
      soil_moisture: 42,
      soil_ph: 6.5,
      air_temp: 27.4,
      air_humidity: 61,
      water_level: 75,
      pump_on: false,
      valve_on: false,
    },
    null,
    2,
  );

  return {
    deviceId,
    deviceKey,
    baseUrl,
    devicePageUrl: `${baseUrl}/devices/${deviceId}`,
    readingsUrl,
    configUrl: `${baseUrl}/api/public/devices/config`,
    commandsUrl: `${baseUrl}/api/public/commands/next`,
    decisionUrl: `${baseUrl}/api/public/irrigation/decision`,
    adviceUrl: `${baseUrl}/api/public/advice/latest`,
    ackUrl: `${baseUrl}/api/public/devices/ack`,
    examplePayload,
    quickSendExample: `POST ${readingsUrl}
Header: X-API-Key: ${deviceKey}
Header: Content-Type: application/json
Body:
${examplePayload}`,
  };
}

function friendlyDeviceError(err: unknown, lang: Lang, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  if (
    message.includes("Unauthorized") ||
    message.includes("Invalid token") ||
    message.includes("authorization") ||
    message.includes("session expired") ||
    message.includes("sign in again")
  ) {
    return lang === "sw"
      ? "Muda wa kuingia umeisha. Tafadhali ingia tena kisha ongeza kifaa."
      : "Your sign-in session expired. Please sign in again, then add the device.";
  }
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY") || message.includes("Hardware claim needs")) {
    return lang === "sw"
      ? "Claim ya hardware inahitaji service key kwenye server. Tumia Manual create ili upate Device Key na API sasa, au ongeza service key kabla ya ku-claim hardware."
      : "Hardware claim needs a service key on the server. Use Manual create to get a Device Key and API now, or add the service key before claiming hardware.";
  }
  return message || fallback;
}

function signInAgainMessage(lang: Lang) {
  return lang === "sw"
    ? "Muda wa kuingia umeisha. Tafadhali ingia tena kisha ongeza kifaa."
    : "Your sign-in session expired. Please sign in again, then add the device.";
}

function requireFreshBrowserSession(lang: Lang) {
  if (!getFlaskToken()) throw new Error(signInAgainMessage(lang));
}

function NewDevicePage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { code: codeFromUrl } = useSearch({ from: "/_authenticated/devices/new" });
  const claimFn = useServerFn(claimDevice);
  const manualFn = useServerFn(createManualDevice);

  const [tab, setTab] = useState<"qr" | "manual">(codeFromUrl ? "qr" : "manual");
  const [step, setStep] = useState<1 | 2>(codeFromUrl ? 2 : 1);
  const [code, setCode] = useState(codeFromUrl ?? "");
  const [scanning, setScanning] = useState(false);
  const [form, setForm] = useState<DeviceForm>(blankForm());
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [generatedSetup, setGeneratedSetup] = useState<GeneratedApiSetup | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const detectLocation = useCallback(
    (force = false) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setGeoStatus("unavailable");
        return;
      }
      setGeoStatus("loading");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setForm((prev) =>
            !force && (prev.lat || prev.lon)
              ? prev
              : {
                  ...prev,
                  lat: pos.coords.latitude.toFixed(6),
                  lon: pos.coords.longitude.toFixed(6),
                  location_name:
                    prev.location_name || (lang === "sw" ? "Eneo la GPS" : "GPS farm location"),
                },
          );
          setGeoStatus("ready");
        },
        () => setGeoStatus("denied"),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    },
    [lang],
  );

  const clearLocation = () => {
    setForm((prev) => ({ ...prev, lat: "", lon: "" }));
    setGeoStatus("idle");
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
      }
    };
  }, []);

  const startScan = async () => {
    setScanning(true);
    try {
      const scanner = new Html5Qrcode("qr-region");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decoded) => {
          const c = extractCodeFromText(decoded);
          if (c) {
            setCode(c);
            scanner
              .stop()
              .then(() => {
                scanner.clear();
                scannerRef.current = null;
                setScanning(false);
                setStep(2);
              })
              .catch(() => setScanning(false));
          }
        },
        () => {},
      );
    } catch (e) {
      setScanning(false);
      toast.error(e instanceof Error ? e.message : "Camera haifiki");
    }
  };

  const buildPayload = () => ({
    name: buildSafeDeviceName(form, lang),
    crop: form.crop || undefined,
    location_name: form.location_name || undefined,
    lat: optionalNumber(form.lat),
    lon: optionalNumber(form.lon),
    target_moisture: Number(form.target_moisture),
    pump_on_threshold: Number(form.pump_on_threshold),
    pump_off_threshold: Number(form.pump_off_threshold),
    ip_address: form.ip_address || undefined,
    operator_name: form.operator_name || undefined,
    dashboard_widgets: form.dashboard_widgets,
  });

  const showGeneratedSetup = (deviceId: string, deviceKey: string) => {
    setGeneratedSetup(buildGeneratedApiSetup(deviceId, deviceKey));
    setTimeout(() => {
      document
        .getElementById("controller-api-helper")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const copyGeneratedValue = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(lang === "sw" ? "Imenakiliwa" : "Copied");
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      toast.error(lang === "sw" ? "Imeshindikana kunakili" : "Copy failed");
    }
  };

  const submitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requireFreshBrowserSession(lang);
      const dev = await claimFn({
        data: { claim_code: code, ...buildPayload() },
      });

      toast.success(t("saved"));
      showGeneratedSetup(dev.id, dev.device_key);
    } catch (err) {
      toast.error(friendlyDeviceError(err, lang, t("error_generic")));
    } finally {
      setLoading(false);
    }
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requireFreshBrowserSession(lang);
      const dev = await manualFn({ data: buildPayload() });
      toast.success(t("saved"));
      showGeneratedSetup(dev.id, dev.device_key);
    } catch (err) {
      toast.error(friendlyDeviceError(err, lang, t("error_generic")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("add_device")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "sw"
            ? "GPS hujaza latitudo na longitudo, kisha AI huchagua moisture ya chini na juu kulingana na zao."
            : "GPS fills latitude and longitude, then AI chooses minimum and maximum moisture from the crop."}
        </p>
      </div>

      <DeviceSetupPromise lang={lang} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "qr" | "manual")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">
            <PencilLine className="mr-2 h-4 w-4" /> {t("register_tab_manual")}
          </TabsTrigger>
          <TabsTrigger value="qr">
            <Camera className="mr-2 h-4 w-4" /> {t("register_tab_qr")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4">
          <form onSubmit={submitManual} className="space-y-4 rounded-lg border bg-card p-6">
            <div className="flex items-start gap-3">
              <Sprout className="mt-1 h-5 w-5 text-primary" />
              <div className="text-sm text-muted-foreground">
                {t("manual_register_help")}
                <span className="mt-1 block">
                  {lang === "sw"
                    ? "Njia hii hutengeneza Device Key na API sasa hivi, hata kama hardware bado haijaunganishwa."
                    : "This creates the Device Key and API now, even before the hardware is connected."}
                </span>
              </div>
            </div>
            <DeviceFields
              form={form}
              setForm={setForm}
              t={t}
              lang={lang}
              geoStatus={geoStatus}
              onUseLocation={() => detectLocation(true)}
              onClearLocation={clearLocation}
            />
            <WidgetPicker form={form} setForm={setForm} t={t} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading}>
                <Code2 className="h-4 w-4" />
                {loading
                  ? t("saving")
                  : lang === "sw"
                    ? "Tengeneza kifaa na API"
                    : "Create device & API"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/devices" })}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="qr" className="mt-4">
          {step === 1 ? (
            <div className="space-y-4 rounded-lg border bg-card p-6">
              <div className="flex items-start gap-3">
                <Sprout className="mt-1 h-5 w-5 text-primary" />
                <div className="text-sm text-muted-foreground">{t("claim_instructions")}</div>
              </div>

              {scanning ? (
                <div className="space-y-2">
                  <div
                    id="qr-region"
                    className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      scannerRef.current?.stop().then(() => {
                        scannerRef.current?.clear();
                        scannerRef.current = null;
                        setScanning(false);
                      });
                    }}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              ) : (
                <Button onClick={startScan} className="w-full">
                  <Camera className="mr-2 h-4 w-4" /> {t("scan_qr")}
                </Button>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> {t("or")}{" "}
                <div className="h-px flex-1 bg-border" />
              </div>

              <div>
                <Label className="mb-1 block">{t("enter_code")}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="A3K7QZ au dk_xxxxxxxx..."
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim().replace(/\s+/g, ""))}
                    maxLength={80}
                    className="font-mono"
                  />
                  <Button onClick={() => code.length >= 4 && setStep(2)} disabled={code.length < 4}>
                    <KeyRound className="mr-2 h-4 w-4" /> {t("continue")}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === "sw"
                    ? "Weka Claim Code fupi au Device Key kamili kutoka kwenye firmware ya kifaa chako."
                    : "Enter the short claim code or the full device key from your device firmware."}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={submitClaim} className="space-y-4 rounded-lg border bg-card p-6">
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">{t("claim_code")}:</span>{" "}
                <span className="font-mono font-bold">{code}</span>
                <button type="button" className="ml-2 text-xs underline" onClick={() => setStep(1)}>
                  {t("change")}
                </button>
              </div>
              <DeviceFields
                form={form}
                setForm={setForm}
                t={t}
                lang={lang}
                geoStatus={geoStatus}
                onUseLocation={() => detectLocation(true)}
                onClearLocation={clearLocation}
              />
              <WidgetPicker form={form} setForm={setForm} t={t} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={loading}>
                  <Code2 className="h-4 w-4" />
                  {loading
                    ? t("saving")
                    : lang === "sw"
                      ? "Unganisha kifaa na API"
                      : "Claim device & API"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate({ to: "/devices" })}
                >
                  {t("cancel")}
                </Button>
              </div>
            </form>
          )}
        </TabsContent>
      </Tabs>

      <ControllerApiHelper
        setup={generatedSetup}
        copiedField={copiedField}
        lang={lang}
        onCopy={copyGeneratedValue}
        onOpenDevice={(deviceId) => navigate({ to: "/devices/$id", params: { id: deviceId } })}
      />

      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold">{t("settings")}</h2>
              <p className="text-sm text-muted-foreground">
                {lang === "sw"
                  ? "Badilisha lugha, arifa, eneo la msingi, na taarifa za akaunti kabla au baada ya kuongeza kifaa."
                  : "Change language, alerts, default location, and account details before or after adding a device."}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/settings" })}>
            <Settings className="h-4 w-4" />
            {t("settings")}
          </Button>
        </div>
      </section>
    </div>
  );
}

function DeviceSetupPromise({ lang }: { lang: Lang }) {
  const items = [
    {
      icon: <Sprout className="h-4 w-4" />,
      title: lang === "sw" ? "1. Chagua zao" : "1. Choose crop",
      text:
        lang === "sw"
          ? "AI huweka minimum, target, na maximum moisture automatic."
          : "AI fills minimum, target, and maximum moisture automatically.",
    },
    {
      icon: <LocateFixed className="h-4 w-4" />,
      title: lang === "sw" ? "2. GPS ni hiari" : "2. GPS is optional",
      text:
        lang === "sw"
          ? "Ruhusu location, jaza mwenyewe, au acha wazi uendelee."
          : "Allow location, enter it manually, or leave it blank and continue.",
    },
    {
      icon: <Code2 className="h-4 w-4" />,
      title: lang === "sw" ? "3. API kwa controller yoyote" : "3. API for any controller",
      text:
        lang === "sw"
          ? "Baada ya Create utapata Device Key na URL ya kutuma data."
          : "After Create you get the Device Key and send-data URL.",
    },
  ];

  return (
    <section className="grid gap-2 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="rounded-lg border bg-card p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              {item.icon}
            </span>
            {item.title}
          </div>
          <p className="text-xs text-muted-foreground">{item.text}</p>
        </div>
      ))}
    </section>
  );
}

function ControllerApiHelper({
  setup,
  copiedField,
  lang,
  onCopy,
  onOpenDevice,
}: {
  setup: GeneratedApiSetup | null;
  copiedField: string | null;
  lang: Lang;
  onCopy: (field: string, value: string) => void;
  onOpenDevice: (deviceId: string) => void;
}) {
  const previewBaseUrl = setup?.baseUrl ?? getControllerBaseUrl();
  const previewReadingsUrl = setup?.readingsUrl ?? `${previewBaseUrl}/api/public/readings`;
  const title =
    lang === "sw" ? "API ya kifaa imeandaliwa automatic" : "Device API generated automatically";
  const description =
    lang === "sw"
      ? "Baada ya kubofya Tengeneza, sehemu hii inaonyesha web URL, Device Key, na API ambazo microcontroller itatumia kutuma data kwenye website."
      : "After you press Create, this section shows the web URL, Device Key, and APIs your controller uses to send data into the website.";
  const pending =
    lang === "sw"
      ? "Tengeneza au claim kifaa kwanza ili funguo na URL kamili zijazwe hapa automatic."
      : "Create or claim a device first, then the key and full URLs will appear here automatically.";

  return (
    <section id="controller-api-helper" className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Code2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {!setup ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
          {pending}
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <MiniEndpoint
              icon={<Globe2 className="h-4 w-4" />}
              label={lang === "sw" ? "Web URL" : "Web URL"}
              value={previewBaseUrl}
            />
            <MiniEndpoint
              icon={<ExternalLink className="h-4 w-4" />}
              label={lang === "sw" ? "API ya kutuma data" : "Send data API"}
              value={previewReadingsUrl}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <CopyField
              id="web-url"
              label={lang === "sw" ? "Web URL ya website" : "Website URL"}
              value={setup.baseUrl}
              copiedField={copiedField}
              onCopy={onCopy}
            />
            <CopyField
              id="device-page"
              label={lang === "sw" ? "Link ya kuona kifaa" : "Device page link"}
              value={setup.devicePageUrl}
              copiedField={copiedField}
              onCopy={onCopy}
            />
            <CopyField
              id="device-key"
              label={
                lang === "sw" ? "Device Key ya kuweka kwenye firmware" : "Device Key for firmware"
              }
              value={setup.deviceKey}
              copiedField={copiedField}
              onCopy={onCopy}
            />
            <CopyField
              id="send-api"
              label={lang === "sw" ? "API ya kutuma vipimo" : "Send readings API"}
              value={setup.readingsUrl}
              copiedField={copiedField}
              onCopy={onCopy}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <MiniEndpoint
              icon={<ExternalLink className="h-4 w-4" />}
              label={lang === "sw" ? "Soma settings za kifaa" : "Read device settings"}
              value={setup.configUrl}
            />
            <MiniEndpoint
              icon={<ExternalLink className="h-4 w-4" />}
              label={lang === "sw" ? "Chukua amri mpya" : "Get next command"}
              value={setup.commandsUrl}
            />
            <MiniEndpoint
              icon={<ExternalLink className="h-4 w-4" />}
              label={lang === "sw" ? "Uamuzi wa umwagiliaji" : "Irrigation decision"}
              value={setup.decisionUrl}
            />
            <MiniEndpoint
              icon={<ExternalLink className="h-4 w-4" />}
              label={lang === "sw" ? "Thibitisha amri" : "Acknowledge command"}
              value={setup.ackUrl}
            />
          </div>

          <CopyField
            id="quick-send"
            label={lang === "sw" ? "Mfano rahisi wa kutuma data" : "Simple send-data example"}
            value={setup.quickSendExample}
            copiedField={copiedField}
            onCopy={onCopy}
            multiline
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => onOpenDevice(setup.deviceId)}>
              <ExternalLink className="h-4 w-4" />
              {lang === "sw" ? "Fungua ukurasa wa kifaa" : "Open device page"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onCopy("all-api", setup.quickSendExample)}
            >
              {copiedField === "all-api" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {lang === "sw" ? "Nakili maelekezo" : "Copy instructions"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function CopyField({
  id,
  label,
  value,
  copiedField,
  onCopy,
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  copiedField: string | null;
  onCopy: (field: string, value: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      <div className="flex items-start gap-2">
        {multiline ? (
          <pre className="min-h-28 flex-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-[11px]">
            {value}
          </pre>
        ) : (
          <code className="min-h-10 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">
            {value}
          </code>
        )}
        <Button type="button" variant="outline" size="icon" onClick={() => onCopy(id, value)}>
          {copiedField === id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function MiniEndpoint({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-[11px] text-foreground">{value}</div>
    </div>
  );
}

function DeviceFields({
  form,
  setForm,
  t,
  lang,
  geoStatus,
  onUseLocation,
  onClearLocation,
}: {
  form: DeviceForm;
  setForm: Dispatch<SetStateAction<DeviceForm>>;
  t: (k: DictKey) => string;
  lang: Lang;
  geoStatus: GeoStatus;
  onUseLocation: () => void;
  onClearLocation: () => void;
}) {
  const selectedPreset = findCropPreset(form.crop);
  const cropPlan = getCropMoisturePlan(form.crop);
  const minLabel = lang === "sw" ? "Unyevu wa chini (%)" : "Minimum moisture (%)";
  const maxLabel = lang === "sw" ? "Unyevu wa juu (%)" : "Maximum moisture (%)";
  const analysisTitle = lang === "sw" ? "Uchambuzi wa AI wa zao" : "AI crop analysis";
  const hasLocationValue = Boolean(form.lat || form.lon);

  const applyCropPreset = (key: string) => {
    const preset = CROP_PRESETS.find((c) => c.key === key);
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      crop: preset.name_sw,
      target_moisture: preset.target_moisture,
      pump_on_threshold: preset.pump_on_threshold,
      pump_off_threshold: preset.pump_off_threshold,
    }));
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label={t("device_name")}>
        <Input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Shamba la Mbeya"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {lang === "sw"
            ? "Ukiiacha wazi, jina litatengenezwa automatic kutoka zao na eneo."
            : "Leave blank to create a name from the crop and location automatically."}
        </p>
      </Field>

      <div className="md:col-span-2">
        <Field label={t("crop")}>
          <div className="grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <select
              value={selectedPreset?.key ?? ""}
              onChange={(e) => applyCropPreset(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">-- Chagua zao --</option>
              {CROP_PRESETS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name_sw} - {c.name_en}
                </option>
              ))}
            </select>
            <Input
              list="crop-presets-list"
              value={form.crop}
              onChange={(e) => {
                const value = e.target.value;
                const preset = findCropPreset(value);
                if (preset) {
                  setForm((prev) => ({
                    ...prev,
                    crop: preset.name_sw,
                    target_moisture: preset.target_moisture,
                    pump_on_threshold: preset.pump_on_threshold,
                    pump_off_threshold: preset.pump_off_threshold,
                  }));
                } else {
                  setForm((prev) => ({ ...prev, crop: value }));
                }
              }}
              placeholder={lang === "sw" ? "Au andika jina la zao..." : "Or type a crop name..."}
            />
          </div>
          <datalist id="crop-presets-list">
            {CROP_PRESETS.map((c) => (
              <option key={c.key} value={c.name_sw}>
                {c.name_en}
              </option>
            ))}
          </datalist>
        </Field>
      </div>

      <div className="rounded-md bg-primary/5 p-3 md:col-span-2">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <Brain className="h-4 w-4" />
          {analysisTitle}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <MoistureChip
            icon={<Droplets className="h-4 w-4" />}
            label={minLabel}
            value={`${cropPlan.min_moisture}%`}
          />
          <MoistureChip
            icon={<Sprout className="h-4 w-4" />}
            label={t("target_moisture")}
            value={`${cropPlan.target_moisture}%`}
          />
          <MoistureChip
            icon={<Droplets className="h-4 w-4" />}
            label={maxLabel}
            value={`${cropPlan.max_moisture}%`}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {lang === "sw" ? cropPlan.analysis_sw : cropPlan.analysis_en}
        </p>
      </div>

      <div className="rounded-md bg-muted/40 p-3 md:col-span-2">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-primary" />
            {lang === "sw" ? "Eneo la kifaa" : "Device location"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUseLocation}
              disabled={geoStatus === "loading"}
            >
              <LocateFixed className="h-4 w-4" />
              {geoStatus === "loading"
                ? lang === "sw"
                  ? "Inatafuta..."
                  : "Locating..."
                : lang === "sw"
                  ? "Jaza GPS"
                  : "Use GPS"}
            </Button>
            {(hasLocationValue || geoStatus === "denied" || geoStatus === "unavailable") && (
              <Button type="button" variant="ghost" size="sm" onClick={onClearLocation}>
                {lang === "sw" ? "Acha GPS" : "Skip GPS"}
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("location")}>
            <Input
              value={form.location_name}
              onChange={(e) => setForm((prev) => ({ ...prev, location_name: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("latitude")}>
              <Input
                value={form.lat}
                onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))}
              />
            </Field>
            <Field label={t("longitude")}>
              <Input
                value={form.lon}
                onChange={(e) => setForm((prev) => ({ ...prev, lon: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{geoStatusText(geoStatus, lang)}</p>
      </div>

      <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
        <Field label={t("target_moisture")}>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.target_moisture}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, target_moisture: Number(e.target.value) }))
            }
          />
        </Field>
        <Field label={minLabel}>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.pump_on_threshold}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, pump_on_threshold: Number(e.target.value) }))
            }
          />
        </Field>
        <Field label={maxLabel}>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.pump_off_threshold}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, pump_off_threshold: Number(e.target.value) }))
            }
          />
        </Field>
      </div>

      <Field label={t("ip_address")}>
        <Input
          value={form.ip_address}
          onChange={(e) => setForm((prev) => ({ ...prev, ip_address: e.target.value }))}
          placeholder="192.168.1.42"
          inputMode="decimal"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t("ip_address_help")}</p>
      </Field>
      <Field label={t("operator_name")}>
        <Input
          value={form.operator_name}
          onChange={(e) => setForm((prev) => ({ ...prev, operator_name: e.target.value }))}
          placeholder="Salum Mohamed"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t("operator_name_help")}</p>
      </Field>
    </div>
  );
}

function MoistureChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-background/80 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}

function geoStatusText(status: GeoStatus, lang: Lang): string {
  if (lang === "sw") {
    const sw: Record<GeoStatus, string> = {
      idle: "GPS ni hiari. Bofya Jaza GPS, jaza mwenyewe, au acha wazi uendelee.",
      loading: "Inatafuta GPS ya eneo lako...",
      ready: "Latitudo na longitudo zimejazwa automatic.",
      denied: "GPS ni hiari. Unaweza kuruhusu location, kujaza mwenyewe, au kuacha wazi uendelee.",
      unavailable:
        "GPS haipatikani hapa, lakini unaweza kuacha latitudo na longitudo wazi uendelee.",
    };
    return sw[status];
  }

  const en: Record<GeoStatus, string> = {
    idle: "GPS is optional. Use GPS, enter coordinates manually, or leave them blank and continue.",
    loading: "Finding your GPS location...",
    ready: "Latitude and longitude were filled automatically.",
    denied:
      "GPS is optional. You can allow location, enter coordinates manually, or leave them blank and continue.",
    unavailable:
      "GPS is not available here, but you can leave latitude and longitude blank and continue.",
  };
  return en[status];
}

function WidgetPicker({
  form,
  setForm,
  t,
}: {
  form: DeviceForm;
  setForm: Dispatch<SetStateAction<DeviceForm>>;
  t: (k: DictKey) => string;
}) {
  return (
    <div>
      <Label className="mb-2 block">{t("dashboard_widgets")}</Label>
      <p className="mb-3 text-xs text-muted-foreground">{t("dashboard_widgets_help")}</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {(
          [
            { key: "moisture", label: t("widget_moisture") },
            { key: "ph", label: t("widget_ph") },
            { key: "air_temp", label: t("widget_air_temp") },
            { key: "air_humidity", label: t("widget_air_humidity") },
            { key: "pump", label: t("widget_pump") },
            { key: "weather", label: t("widget_weather") },
          ] as const
        ).map((w) => {
          const checked = form.dashboard_widgets.includes(w.key);
          return (
            <label
              key={w.key}
              className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm transition ${
                checked ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    dashboard_widgets: e.target.checked
                      ? [...prev.dashboard_widgets, w.key]
                      : prev.dashboard_widgets.filter((k) => k !== w.key),
                  }))
                }
                className="h-4 w-4 accent-primary"
              />
              {w.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
