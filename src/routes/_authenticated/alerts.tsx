import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { listMyAlerts, markAlertRead } from "@/lib/devices.functions";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Arifa — Veta Kipawa" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const { t } = useT();
  const fn = useServerFn(listMyAlerts);
  const mFn = useServerFn(markAlertRead);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });
  const mark = useMutation({
    mutationFn: (id: number) => mFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      userId = u.user?.id ?? null;
      if (!userId) return;
      channel = supabase
        .channel(`alerts:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "alerts", filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as { title?: string; body?: string; level?: string };
            qc.invalidateQueries({ queryKey: ["alerts"] });
            if (row?.title) {
              toast(row.title, {
                description: row.body,
                duration: 6000,
              });
            }
          },
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("alerts")}</h1>
      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : !data?.length ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          <Bell className="mx-auto mb-2 h-8 w-8 text-primary" />
          {t("no_alerts")}
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((a) => (
            <li
              key={a.id}
              className={"rounded-xl border bg-card p-4 " + (a.read_at ? "opacity-60" : "")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "inline-block h-2 w-2 rounded-full " +
                        (a.level === "danger"
                          ? "bg-destructive"
                          : a.level === "warning"
                            ? "bg-warning"
                            : "bg-primary")
                      }
                    />
                    <h3 className="font-semibold">{a.title}</h3>
                  </div>
                  {a.body && <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                {!a.read_at && (
                  <Button size="sm" variant="ghost" onClick={() => mark.mutate(a.id)}>
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
