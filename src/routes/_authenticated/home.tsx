import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Sprout,
  MessageCircle,
  Bell,
  CirclePlus,
  CloudRain,
  Droplets,
  MapPinned,
  RadioTower,
  Settings,
  ShieldCheck,
} from "lucide-react";
import farmHero from "@/assets/farm-hero.jpg";
import { useT } from "@/lib/i18n";
import { listMyDevices } from "@/lib/devices.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Mwanzo — Veta Kipawa" }] }),
  component: HomePage,
});

const QUICK_LINKS = [
  { to: "/dashboard", key: "dashboard", icon: LayoutDashboard, tone: "primary" },
  { to: "/devices/new", key: "add_device", icon: CirclePlus, tone: "accent" },
  { to: "/chat", key: "chat", icon: MessageCircle, tone: "sky" },
  { to: "/alerts", key: "alerts", icon: Bell, tone: "primary" },
  { to: "/settings", key: "settings", icon: Settings, tone: "accent" },
] as const;

function HomePage() {
  const { t, lang } = useT();
  const listDevicesFn = useServerFn(listMyDevices);
  const { data: devices = [] } = useQuery({
    queryKey: ["home-devices"],
    queryFn: () => listDevicesFn(),
    refetchInterval: 30_000,
  });

  const onlineCount = devices.filter(
    (device) =>
      device.online &&
      device.last_seen_at &&
      Date.now() - new Date(device.last_seen_at).getTime() < 10 * 60 * 1000,
  ).length;
  const cropCount = new Set(devices.map((device) => device.crop).filter(Boolean)).size;
  const heroTitle = lang === "sw" ? "Veta Kipawa Agri Tech" : "Veta Kipawa Agri Tech";
  const heroText =
    lang === "sw"
      ? "Unganisha kifaa chochote cha IoT, fuatilia unyevu wa udongo, dhibiti pampu, na pata ushauri wa AI kwa shamba lako."
      : "Connect any IoT microcontroller, watch soil moisture, control pumps, and get AI guidance for your farm.";

  return (
    <div className="relative -m-6 min-h-[calc(100vh-4rem)] overflow-hidden p-6">
      <img
        src={farmHero}
        alt="Shamba background"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/78 to-background/40" />
      <div className="relative z-10 mx-auto max-w-6xl space-y-8 py-4">
        <section className="grid min-h-[420px] items-center gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-md bg-card/85 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              <RadioTower className="h-3.5 w-3.5" />
              IoT + AI irrigation
            </span>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-foreground/80 md:text-lg">{heroText}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/devices/new">
                  <CirclePlus className="h-5 w-5" />
                  {t("add_device")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-card/80">
                <Link to="/chat">
                  <MessageCircle className="h-5 w-5" />
                  {t("chat")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="bg-card/70">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-5 w-5" />
                  {t("dashboard")}
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-card/90 p-4 shadow-[var(--shadow-card)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {lang === "sw" ? "Hali ya shamba" : "Farm status"}
                </p>
                <h2 className="text-xl font-bold">
                  {devices.length ? devices[0]?.name : t("welcome")}
                </h2>
              </div>
              <span className="rounded-md bg-success/15 px-2 py-1 text-xs font-semibold text-success">
                {onlineCount}/{devices.length || 0} {t("online")}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <HomeStat
                icon={<Sprout className="h-4 w-4" />}
                label={t("devices")}
                value={String(devices.length)}
              />
              <HomeStat
                icon={<Droplets className="h-4 w-4" />}
                label={t("moisture")}
                value={devices.length ? `${devices[0]?.target_moisture ?? 45}%` : "--"}
              />
              <HomeStat
                icon={<MapPinned className="h-4 w-4" />}
                label={t("crop")}
                value={String(cropCount || 0)}
              />
            </div>
            <div className="grid gap-2 text-sm">
              <HomeSignal
                icon={<CloudRain className="h-4 w-4" />}
                text={
                  lang === "sw"
                    ? "Rain-aware logic inazuia umwagiliaji wakati mvua inatarajiwa."
                    : "Rain-aware logic can skip irrigation when rain is expected."
                }
              />
              <HomeSignal
                icon={<ShieldCheck className="h-4 w-4" />}
                text={
                  lang === "sw"
                    ? "Threshold za crop huwekwa automatic wakati unasajili kifaa."
                    : "Crop thresholds are set automatically when you register a device."
                }
              />
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group flex min-h-24 items-center gap-4 rounded-lg border bg-card/90 p-4 shadow-[var(--shadow-soft)] backdrop-blur transition hover:bg-card hover:shadow-[var(--shadow-card)]"
              >
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-lg ${toneClass(item.tone)}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{t(item.key as never)}</h3>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function HomeStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}

function HomeSignal({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-background/70 p-3 text-muted-foreground">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function toneClass(tone: "primary" | "accent" | "sky") {
  const map = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-accent-foreground",
    sky: "bg-sky/30 text-sky-foreground",
  } as const;
  return map[tone];
}
