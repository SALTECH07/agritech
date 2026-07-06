import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Plus, ReceiptText, Sparkles, Wallet } from "lucide-react";
import { FarmFinanceSection } from "@/components/farm-finance-section";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Farm Expenses - Veta Kipawa" }] }),
  component: FinancePage,
});

function FinancePage() {
  const { t, lang } = useT();
  const tips =
    lang === "sw"
      ? [
          {
            icon: <ReceiptText className="h-4 w-4" />,
            title: "Weka kila matumizi",
            text: "Mbegu, mbolea, dawa, vibarua, maji, usafiri, matengenezo na mavuno.",
          },
          {
            icon: <ClipboardList className="h-4 w-4" />,
            title: "Tenganisha kwa msimu",
            text: "Andika msimu ili ujue gharama ya kila zao na kila shamba.",
          },
          {
            icon: <Sparkles className="h-4 w-4" />,
            title: "Pata uchambuzi wa AI",
            text: "Msaidizi ataonyesha faida/hasara, matumizi makubwa, na bei ya kuuza.",
          },
        ]
      : [
          {
            icon: <ReceiptText className="h-4 w-4" />,
            title: "Record every expense",
            text: "Seeds, fertilizer, pesticide, labor, water, transport, repairs, and harvest.",
          },
          {
            icon: <ClipboardList className="h-4 w-4" />,
            title: "Separate by season",
            text: "Use the season field to know the cost of each crop and each farm cycle.",
          },
          {
            icon: <Sparkles className="h-4 w-4" />,
            title: "Get AI analysis",
            text: "The assistant can show profit/loss, large costs, and selling-price advice.",
          },
        ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-primary">
                {lang === "sw" ? "Kituo cha gharama za shamba" : "Farm cost center"}
              </p>
              <h1 className="text-2xl font-bold">{t("finance")}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {lang === "sw"
                  ? "Ongeza matumizi yote ya mkulima na mapato ili ujue faida ya shamba."
                  : "Add all farmer expenses and income so the farm profit is easy to understand."}
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to="/chat">
              <Sparkles className="h-4 w-4" />
              {t("chat")}
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {tips.map((tip) => (
          <div key={tip.title} className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                {tip.icon}
              </span>
              {tip.title}
            </div>
            <p className="text-xs text-muted-foreground">{tip.text}</p>
          </div>
        ))}
      </section>

      <FarmFinanceSection defaultOpen />

      <section className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <Plus className="mt-0.5 h-4 w-4 text-primary" />
          <p>
            {lang === "sw"
              ? "Kwa matumizi mapya, chagua Expense, weka aina ya gharama, kiasi, tarehe na maelezo. Kwa mauzo au mapato, chagua Income."
              : "For a new cost, choose Expense, add the category, amount, date, and notes. For sales or other money received, choose Income."}
          </p>
        </div>
      </section>
    </div>
  );
}
