import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Droplets,
  FlaskConical,
  LayoutDashboard,
  MapPinned,
  MessageCircle,
  Plus,
  Sprout,
  ThermometerSun,
  Wallet,
  Wifi,
} from "lucide-react";
import farmHero from "@/assets/farm-hero.jpg";
import { listMyDevices } from "@/lib/devices.functions";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashibodi - Veta Kipawa" }] }),
  component: Dashboard,
});

type Device = Awaited<ReturnType<typeof listMyDevices>>[number];

function Dashboard() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const fn = useServerFn(listMyDevices);
  const qc = useQueryClient();
  const { data: devices, isLoading } = useQuery({
    queryKey: ["my-devices"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  return (
    <div className="relative -m-6 min-h-[calc(100vh-4rem)] overflow-hidden p-6">
      <img
        src={farmHero}
        alt="Shamba background"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/75 to-background/95" />
      <div className="relative z-10 space-y-6">
        <section className="rounded-lg border bg-card/90 p-5 shadow-[var(--shadow-card)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold text-primary">
                {lang === "sw" ? "Kituo cha shamba" : "Farm command center"}
              </p>
              <h1 className="mt-1 text-2xl font-bold">{t("dashboard")}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {lang === "sw"
                  ? "Ongeza vifaa, fuatilia mashamba, na tumia AI kupata ushauri wa haraka."
                  : "Add devices, monitor farms, and use AI for quick field guidance."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate({ to: "/devices/new" })}>
                <Plus className="h-4 w-4" />
                {t("add_device")}
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/chat" })}>
                <MessageCircle className="h-4 w-4" />
                {t("chat")}
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/finance" })}>
                <Wallet className="h-4 w-4" />
                {t("finance")}
              </Button>
            </div>
          </div>
          <DashboardSummary devices={devices ?? []} loading={isLoading} />
        </section>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-lg border bg-muted" />
            ))}
          </div>
        ) : !devices?.length ? (
          <EmptyState onAdd={() => navigate({ to: "/devices/new" })} />
        ) : (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-muted-foreground">
                {lang === "sw" ? "Mashamba yaliyounganishwa" : "Connected farms"}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {devices.map((d) => (
                <DeviceCard
                  key={d.id}
                  device={d}
                  onClick={() => navigate({ to: "/devices/$id", params: { id: d.id } })}
                />
              ))}
            </div>
          </section>
        )}

        <div className="text-xs text-muted-foreground">
          <Activity className="mr-1 inline h-3 w-3" />
          {isLoading ? "..." : `${devices?.length ?? 0} vifaa - `}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["my-devices"] })}
            className="underline"
          >
            {lang === "sw" ? "Onyesha upya" : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t, lang } = useT();
  return (
    <div className="rounded-lg border border-dashed bg-card/90 p-10 text-center shadow-[var(--shadow-soft)]">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Sprout className="h-7 w-7" />
      </div>
      <p className="text-base font-medium">{t("no_devices")}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {lang === "sw"
          ? "Chagua zao, ruhusu GPS ijaze latitudo na longitudo, kisha AI itaweka kiwango cha chini na cha juu cha unyevu."
          : "Pick a crop, allow GPS to fill latitude and longitude, then AI will set minimum and maximum moisture."}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {t("add_device")}
        </Button>
        <Button asChild variant="outline">
          <Link to="/chat">
            <MessageCircle className="h-4 w-4" />
            {t("chat")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function DashboardSummary({ devices, loading }: { devices: Device[]; loading: boolean }) {
  const { t, lang } = useT();
  const onlineCount = devices.filter(
    (device) =>
      device.online &&
      device.last_seen_at &&
      Date.now() - new Date(device.last_seen_at).getTime() < 10 * 60 * 1000,
  ).length;
  const offlineCount = Math.max(0, devices.length - onlineCount);
  const cropCount = new Set(devices.map((device) => device.crop).filter(Boolean)).size;
  const loadingValue = loading ? "..." : undefined;

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={<Sprout className="h-4 w-4" />}
        label={t("devices")}
        value={loadingValue ?? String(devices.length)}
        tone="primary"
      />
      <SummaryCard
        icon={<Wifi className="h-4 w-4" />}
        label={t("online")}
        value={loadingValue ?? String(onlineCount)}
        tone="success"
      />
      <SummaryCard
        icon={<AlertCircle className="h-4 w-4" />}
        label={lang === "sw" ? "Zinahitaji kuangaliwa" : "Need attention"}
        value={loadingValue ?? String(offlineCount)}
        tone="warning"
      />
      <SummaryCard
        icon={<MapPinned className="h-4 w-4" />}
        label={t("crop")}
        value={loadingValue ?? String(cropCount)}
        tone="sky"
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "success" | "warning" | "sky";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    sky: "bg-sky/25 text-sky-foreground",
  } as const;

  return (
    <div className="rounded-md bg-background/80 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={"inline-flex h-7 w-7 items-center justify-center rounded-md " + toneMap[tone]}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function DeviceCard({ device, onClick }: { device: Device; onClick: () => void }) {
  const { t, lang } = useT();
  const isOnline =
    device.online && device.last_seen_at
      ? Date.now() - new Date(device.last_seen_at).getTime() < 10 * 60 * 1000
      : false;
  return (
    <button
      onClick={onClick}
      className="group rounded-lg border bg-card/95 p-5 text-left shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{device.name}</h3>
          <p className="text-xs text-muted-foreground">
            {device.crop || "--"} - {device.location_name || "--"}
          </p>
        </div>
        <span
          className={
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold " +
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
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Stat
          icon={<Droplets className="h-3.5 w-3.5" />}
          label={t("target_moisture")}
          value={`${device.target_moisture}%`}
        />
        <Stat
          icon={<ThermometerSun className="h-3.5 w-3.5" />}
          label="Min"
          value={`${device.pump_on_threshold}%`}
        />
        <Stat
          icon={<FlaskConical className="h-3.5 w-3.5" />}
          label="Max"
          value={`${device.pump_off_threshold}%`}
        />
      </div>
      <div className="mt-3 inline-flex items-center text-xs text-primary opacity-0 transition group-hover:opacity-100">
        {lang === "sw" ? "Fungua" : "Open"} <ChevronRight className="ml-1 h-3 w-3" />
      </div>
    </button>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 font-bold">{value}</div>
    </div>
  );
}
