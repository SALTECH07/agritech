import { createFileRoute, Link } from "@tanstack/react-router";
import { Droplets, CloudRain, Sparkles, MessageCircle, QrCode, Leaf } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/lang-toggle";
import { AgriBackground } from "@/components/agri-background";
import farmHero from "@/assets/farm-hero.jpg";
import vetaLogo from "@/assets/veta-logo.png";

const SITE_NAME = "Veta Kipawa Agri Tech";
const SITE_DESCRIPTION =
  "Mfumo wa kisasa wa umwagiliaji kwa wakulima wa Tanzania: vipimo vya unyevu wa udongo, hali ya hewa, udhibiti wa pampu kupitia kifaa chochote cha IoT, na msaidizi wa AI kwa Kiswahili.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veta Kipawa Agri Tech — Umwagiliaji Smart kwa Wakulima wa Tanzania" },
      { name: "description", content: SITE_DESCRIPTION },
      {
        name: "keywords",
        content:
          "umwagiliaji smart, kilimo Tanzania, IoT kilimo, IoT shamba, smart farming, soil moisture sensor, AI msaidizi kilimo, Veta Kipawa",
      },
      { property: "og:title", content: "Veta Kipawa Agri Tech — Umwagiliaji Smart" },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "sw_TZ" },
      { property: "og:site_name", content: SITE_NAME },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_NAME },
      { name: "twitter:description", content: SITE_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SITE_NAME,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, IoT devices",
          description: SITE_DESCRIPTION,
          inLanguage: ["sw", "en"],
          offers: { "@type": "Offer", price: "0", priceCurrency: "TZS" },
          featureList: [
            "Vipimo vya unyevu wa udongo kwa wakati halisi",
            "Udhibiti wa pampu wa moja kwa moja",
            "Msaidizi wa AI kwa Kiswahili",
            "Arifa kupitia SMS na WhatsApp",
            "Utabiri wa hali ya hewa",
          ],
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="relative z-20 border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 font-bold">
            <img
              src={vetaLogo}
              alt="Veta Kipawa Agri Tech logo"
              width={36}
              height={36}
              className="h-9 w-9"
            />
            <span>Veta Kipawa Agri Tech</span>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                {t("sign_in")}
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">{t("get_started")}</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <AgriBackground />
        <img
          src={farmHero}
          alt="Shamba la kisasa Tanzania lenye mfumo wa umwagiliaji"
          width={1600}
          height={900}
          className="absolute inset-0 z-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-background/90 via-background/60 to-background/20" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-24 md:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> AI + IoT kwa Wakulima
            </span>
            <h1 className="mt-4 text-4xl font-bold text-foreground md:text-6xl drop-shadow-sm">
              {t("landing_hero_title")}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-foreground/80">{t("landing_hero_sub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="shadow-lg">
                  {t("get_started")}
                </Button>
              </Link>
              <a href="#features">
                <Button variant="outline" size="lg" className="bg-card/80 backdrop-blur">
                  {t("learn_more")}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Video za kilimo" className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">Kilimo cha Kisasa kwa Macho Yako</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tazama jinsi teknolojia inavyobadilisha mashamba — bila sauti, kwa utulivu.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              src: "https://videos.pexels.com/video-files/2933375/2933375-uhd_2560_1440_24fps.mp4",
              poster: farmHero,
              label: "Shamba la kijani kutoka angani",
            },
            {
              src: "https://videos.pexels.com/video-files/2252797/2252797-uhd_2560_1440_30fps.mp4",
              poster: farmHero,
              label: "Mfumo wa umwagiliaji ukifanya kazi",
            },
            {
              src: "https://videos.pexels.com/video-files/4625747/4625747-uhd_2560_1440_25fps.mp4",
              poster: farmHero,
              label: "Mkulima akihudumia mazao",
            },
          ].map((v) => (
            <div
              key={v.src}
              className="group overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]"
            >
              <video
                src={v.src}
                poster={v.poster}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={v.label}
                className="h-56 w-full object-cover transition group-hover:scale-[1.02]"
              />
              <div className="p-3 text-xs text-muted-foreground">{v.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Droplets className="h-6 w-6" />}
            title={t("feature_realtime")}
            text={t("feature_realtime_sub")}
            tone="primary"
          />
          <FeatureCard
            icon={<Sparkles className="h-6 w-6" />}
            title={t("feature_ai")}
            text={t("feature_ai_sub")}
            tone="accent"
          />
          <FeatureCard
            icon={<CloudRain className="h-6 w-6" />}
            title={t("feature_rain")}
            text={t("feature_rain_sub")}
            tone="sky"
          />
          <FeatureCard
            icon={<MessageCircle className="h-6 w-6" />}
            title={t("chat_title")}
            text={t("chat_welcome_sub")}
            tone="primary"
          />
          <FeatureCard
            icon={<QrCode className="h-6 w-6" />}
            title={t("scan_qr")}
            text={t("claim_instructions")}
            tone="accent"
          />
          <FeatureCard
            icon={<Leaf className="h-6 w-6" />}
            title="IoT Device + Cloud"
            text="Unganisha microcontroller yoyote inayoweza kutuma data ya HTTP/HTTPS. Hakuna kulazimishwa kutumia board moja."
            tone="sky"
          />
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Veta Kipawa Agri Tech
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: "primary" | "accent" | "sky";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-accent-foreground",
    sky: "bg-sky/30 text-sky-foreground",
  } as const;
  return (
    <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] transition hover:shadow-lg">
      <div
        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ${toneMap[tone]}`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
