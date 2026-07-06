import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Sprout,
  Bell,
  Settings,
  LogOut,
  MessageCircle,
  Home,
  Store,
  CirclePlus,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LangToggle } from "./lang-toggle";
import vetaLogo from "@/assets/veta-logo.png";

const NAV = [
  { to: "/home", key: "home", icon: Home },
  { to: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { to: "/devices", key: "devices", icon: Sprout },
  { to: "/finance", key: "finance", icon: Wallet },
  { to: "/suppliers", key: "suppliers", icon: Store },
  { to: "/chat", key: "chat", icon: MessageCircle },
  { to: "/alerts", key: "alerts", icon: Bell },
  { to: "/settings", key: "settings", icon: Settings },
] as const;

const RIBBON_NAV = [
  { to: "/home", key: "home", icon: Home },
  { to: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { to: "/devices", key: "devices", icon: Sprout },
  { to: "/devices/new", key: "add_device", icon: CirclePlus, primary: true },
  { to: "/finance", key: "finance", icon: Wallet },
  { to: "/chat", key: "chat", icon: MessageCircle },
  { to: "/alerts", key: "alerts", icon: Bell },
  { to: "/settings", key: "settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold">
            <img
              src={vetaLogo}
              alt="Veta Kipawa Agri Tech"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="hidden sm:inline">Veta Kipawa Agri Tech</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                    (active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t(item.key as never)}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Button asChild variant="ghost" size="icon" aria-label={t("settings")}>
              <Link to="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label={t("sign_out")}>
              <LogOut className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">{t("sign_out")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-32 md:pb-28">{children}</main>

      {/* Bottom movement ribbon */}
      <nav className="fixed inset-x-0 bottom-3 z-30 px-3">
        <div className="mx-auto grid max-w-4xl grid-cols-8 overflow-hidden rounded-lg border bg-card/95 shadow-[var(--shadow-card)] backdrop-blur">
          {RIBBON_NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition sm:text-xs " +
                  (item.primary
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground")
                }
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{t(item.key as never)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
