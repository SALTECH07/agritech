import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Sprout, ChevronRight } from "lucide-react";
import { listMyDevices } from "@/lib/devices.functions";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/devices/")({
  head: () => ({ meta: [{ title: "Vifaa — Veta Kipawa" }] }),
  component: DevicesPage,
});

function DevicesPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const fn = useServerFn(listMyDevices);
  const { data, isLoading } = useQuery({ queryKey: ["my-devices"], queryFn: () => fn() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("devices")}</h1>
        <Button onClick={() => navigate({ to: "/devices/new" })}>
          <Plus className="mr-2 h-4 w-4" /> {t("add_device")}
        </Button>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : !data?.length ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          <Sprout className="mx-auto mb-2 h-8 w-8 text-primary" />
          {t("no_devices")}
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.map((d) => (
            <li key={d.id}>
              <Link
                to="/devices/$id"
                params={{ id: d.id }}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/40"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{d.name}</span>
                    {!d.is_claimed && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                        {t("unclaimed_badge")}
                      </span>
                    )}
                    {d.online && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" title={t("online")} />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.crop || "—"} · {d.location_name || "—"}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
