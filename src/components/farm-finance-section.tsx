import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { addFinance, deleteFinance, listFinance } from "@/lib/finance.functions";
import { getFinanceAdvice } from "@/lib/finance-advice.functions";

export function FarmFinanceSection({
  deviceId,
  defaultOpen = false,
}: {
  deviceId?: string;
  defaultOpen?: boolean;
}) {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const listFn = useServerFn(listFinance);
  const addFn = useServerFn(addFinance);
  const delFn = useServerFn(deleteFinance);
  const adviceFn = useServerFn(getFinanceAdvice);

  const key = ["finance", deviceId ?? "all"];
  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { device_id: deviceId } }),
  });

  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState({
    entry_type: "expense" as "income" | "expense",
    season: "",
    category: "",
    amount: "",
    currency: "TZS",
    description: "",
    occurred_at: new Date().toISOString().slice(0, 10),
  });

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          device_id: deviceId,
          entry_type: form.entry_type,
          season: form.season.trim(),
          category: form.category.trim(),
          amount: Number(form.amount || 0),
          currency: form.currency.trim() || "TZS",
          description: form.description.trim() || null,
          occurred_at: form.occurred_at,
        },
      }),
    onSuccess: () => {
      toast.success(t("saved"));
      setOpen(false);
      setForm((f) => ({ ...f, category: "", amount: "", description: "" }));
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("error_generic")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const advice = useMutation({
    mutationFn: () => adviceFn({ data: { device_id: deviceId, lang } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : t("error_generic")),
  });

  const totals = rows.reduce(
    (acc, r) => {
      const amt = Number(r.amount) || 0;
      if (r.entry_type === "income") acc.income += amt;
      else acc.expense += amt;
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const net = totals.income - totals.expense;
  const fmt = (n: number) => n.toLocaleString(lang === "sw" ? "sw-TZ" : "en-US");
  const categorySuggestions =
    lang === "sw"
      ? [
          "Mbegu",
          "Mbolea",
          "Dawa",
          "Vibarua",
          "Umwagiliaji",
          "Usafiri",
          "Matengenezo",
          "Kodi ya shamba",
          "Mavuno",
          "Uhifadhi",
          "Mauzo",
        ]
      : [
          "Seeds",
          "Fertilizer",
          "Pesticide",
          "Labor",
          "Irrigation",
          "Transport",
          "Repairs",
          "Land rent",
          "Harvest",
          "Storage",
          "Sales",
        ];
  const expenseCategorySuggestions = categorySuggestions.filter(
    (category) => !["Mauzo", "Sales"].includes(category),
  );

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Wallet className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold">{t("finance_title")}</h2>
        </div>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> {t("finance_add")}
        </Button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-success/10 p-2">
          <div className="flex items-center justify-center gap-1 text-success">
            <TrendingUp className="h-3 w-3" /> {t("finance_income")}
          </div>
          <div className="mt-1 text-sm font-bold">{fmt(totals.income)}</div>
        </div>
        <div className="rounded-lg bg-destructive/10 p-2">
          <div className="flex items-center justify-center gap-1 text-destructive">
            <TrendingDown className="h-3 w-3" /> {t("finance_expense")}
          </div>
          <div className="mt-1 text-sm font-bold">{fmt(totals.expense)}</div>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <div className="text-muted-foreground">{t("finance_net")}</div>
          <div
            className={"mt-1 text-sm font-bold " + (net >= 0 ? "text-success" : "text-destructive")}
          >
            {fmt(net)}
          </div>
        </div>
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
          className="mb-3 grid grid-cols-2 gap-2 rounded-lg border bg-background/60 p-3 text-sm"
        >
          <select
            value={form.entry_type}
            onChange={(e) =>
              setForm({ ...form, entry_type: e.target.value as "income" | "expense" })
            }
            className="rounded-md border bg-background px-2 py-2"
          >
            <option value="expense">{t("finance_expense")}</option>
            <option value="income">{t("finance_income")}</option>
          </select>
          <Input
            placeholder={t("finance_season")}
            value={form.season}
            onChange={(e) => setForm({ ...form, season: e.target.value })}
          />
          <Input
            list="farm-finance-categories"
            placeholder={t("finance_category")}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          />
          <datalist id="farm-finance-categories">
            {categorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder={t("finance_amount")}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
          <Input
            placeholder={t("finance_currency")}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          />
          <Input
            type="date"
            value={form.occurred_at}
            onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
          />
          <Input
            className="col-span-2"
            placeholder={t("finance_description")}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="col-span-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {lang === "sw" ? "Aina za matumizi ya haraka" : "Quick expense categories"}
            </p>
            <div className="flex flex-wrap gap-2">
              {expenseCategorySuggestions.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, entry_type: "expense", category }))}
                  className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={add.isPending}>
              {add.isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t("finance_empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold " +
                      (r.entry_type === "income"
                        ? "bg-success/15 text-success"
                        : "bg-destructive/15 text-destructive")
                    }
                  >
                    {r.entry_type === "income" ? t("finance_income") : t("finance_expense")}
                  </span>
                  <span className="truncate font-medium">{r.category || "—"}</span>
                  {r.season && <span className="text-xs text-muted-foreground">· {r.season}</span>}
                </div>
                {r.description && (
                  <p className="truncate text-xs text-muted-foreground">{r.description}</p>
                )}
                <p className="text-xs text-muted-foreground">{r.occurred_at}</p>
              </div>
              <div className="text-right text-sm font-semibold tabular-nums">
                {fmt(Number(r.amount))} {r.currency}
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="delete"
                onClick={() => remove.mutate(r.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-lg border bg-background/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("finance_ai_title")}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => advice.mutate()}
            disabled={advice.isPending}
          >
            {advice.isPending ? t("finance_ai_loading") : t("finance_ai_btn")}
          </Button>
        </div>
        {advice.data?.text ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {advice.data.text}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("finance_ai_empty")}</p>
        )}
      </div>
    </div>
  );
}
