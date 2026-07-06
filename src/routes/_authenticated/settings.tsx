import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/devices.functions";
import { getAIConnectionStatus } from "@/lib/ai.functions";
import { useT, type DictKey } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-provider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  UserCircle2,
  Camera,
  Loader2,
  Download,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Sparkles,
} from "lucide-react";
import { exportAllMyData } from "@/lib/export-data.functions";
import ExcelJS from "exceljs";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Mipangilio — Veta Kipawa" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useT();
  const { theme, setTheme } = useTheme();
  const fn = useServerFn(getMyProfile);
  const upFn = useServerFn(updateMyProfile);
  const aiStatusFn = useServerFn(getAIConnectionStatus);
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => fn() });
  const aiStatusQuery = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => aiStatusFn(),
  });
  const aiStatus = aiStatusQuery.data;
  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const [full, setFull] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loc, setLoc] = useState("");
  const [nInApp, setNInApp] = useState(true);
  const [nSms, setNSms] = useState(false);
  const [nWa, setNWa] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const THEME_OPTIONS: { value: "light" | "dark" | "system"; label: DictKey }[] = [
    { value: "light", label: "theme_light" },
    { value: "dark", label: "theme_dark" },
    { value: "system", label: "theme_system" },
  ];

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (data && !hydratedRef.current) {
      hydratedRef.current = true;
      setFull(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setWhatsapp((data as { whatsapp_phone?: string | null }).whatsapp_phone ?? "");
      setLoc(data.default_location_name ?? "");
      setNInApp((data as { notify_in_app?: boolean }).notify_in_app ?? true);
      setNSms((data as { notify_sms?: boolean }).notify_sms ?? false);
      setNWa((data as { notify_whatsapp?: boolean }).notify_whatsapp ?? false);
      setAvatarUrl((data as { avatar_url?: string | null }).avatar_url ?? "");
      if ((data.language === "sw" || data.language === "en") && data.language !== lang) {
        setLang(data.language);
      }
    }
  }, [data, setLang, lang]);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Picha isizidi 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${authUser.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !signed) throw sErr ?? new Error("Signed URL failed");
      await upFn({ data: { avatar_url: signed.signedUrl } });
      setAvatarUrl(signed.signedUrl);
      toast.success("Picha ya wasifu imesasishwa");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_generic"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = useMutation({
    mutationFn: () =>
      upFn({
        data: {
          full_name: full,
          phone,
          whatsapp_phone: whatsapp,
          default_location_name: loc,
          language: lang,
          notify_in_app: nInApp,
          notify_sms: nSms,
          notify_whatsapp: nWa,
        },
      }),
    onSuccess: () => toast.success(t("saved")),
    onError: (e) => toast.error(e instanceof Error ? e.message : t("error_generic")),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">{t("settings")}</h1>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <UserCircle2 className="h-12 w-12" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
              aria-label="Badilisha picha ya wasifu"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatar}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">
              {full || authUser?.user_metadata?.full_name || "—"}
            </div>
            <div className="truncate text-sm text-muted-foreground">{authUser?.email ?? "—"}</div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-1 text-xs text-primary hover:underline disabled:opacity-50"
            >
              {uploading ? "Inapakia..." : "Badilisha picha"}
            </button>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("phone_number")}</dt>
            <dd className="font-medium">{phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">WhatsApp</dt>
            <dd className="font-medium">{whatsapp || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("location")}</dt>
            <dd className="font-medium">{loc || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tarehe ya kujisajili</dt>
            <dd className="font-medium">
              {authUser?.created_at ? new Date(authUser.created_at).toLocaleDateString() : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="break-all font-mono text-xs">{authUser?.id ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <Label className="mb-1 block">{t("language")}</Label>
          <div className="flex gap-2">
            {(["sw", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={
                  "rounded-md border px-3 py-1.5 text-sm font-semibold uppercase " +
                  (lang === l
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input")
                }
              >
                {l === "sw" ? "Kiswahili" : "English"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-1 block">{t("theme")}</Label>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={
                  "rounded-md border px-3 py-1.5 text-sm font-semibold " +
                  (theme === opt.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input")
                }
              >
                {t(opt.label)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-1 block">{t("full_name")}</Label>
          <Input value={full} onChange={(e) => setFull(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block">{t("phone_number")}</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255..." />
        </div>
        <div>
          <Label className="mb-1 block">{t("whatsapp_phone")}</Label>
          <Input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+255..."
          />
        </div>
        <div>
          <Label className="mb-1 block">{t("location")}</Label>
          <Input value={loc} onChange={(e) => setLoc(e.target.value)} />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="font-semibold">{t("notifications_settings")}</h2>
        <Row label={t("notify_in_app")} checked={nInApp} onChange={setNInApp} />
        <Row label={t("notify_sms")} checked={nSms} onChange={setNSms} />
        <Row label={t("notify_whatsapp")} checked={nWa} onChange={setNWa} />
      </div>

      <SecurityLevelCard
        email={authUser?.email ?? null}
        phone={phone}
        whatsapp={whatsapp}
        avatarUrl={avatarUrl}
      />

      <AIConnectionCard
        status={aiStatus}
        lang={lang}
        checking={aiStatusQuery.isLoading}
        error={aiStatusQuery.isError}
      />

      <div className="space-y-3 rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Pakua data zako</h2>
        <p className="text-sm text-muted-foreground">
          Pakua taarifa zako zote (vifaa, vipimo, arifa, amri, hali ya hewa, ushauri) kama faili
          moja la Excel (.xlsx).
        </p>
        <DownloadExcelButton />
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {t("save")}
      </Button>
    </div>
  );
}

function AIConnectionCard({
  status,
  lang,
  checking,
  error,
}: {
  status?: { configured: boolean; model: string; provider: string };
  lang: "sw" | "en";
  checking?: boolean;
  error?: boolean;
}) {
  const configured = Boolean(status?.configured);
  return (
    <div className="space-y-3 rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> AI Assistant
        </h2>
        <span
          className={
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold " +
            (checking
              ? "bg-muted text-muted-foreground"
              : error
                ? "bg-destructive/15 text-destructive"
                : configured
                  ? "bg-success/15 text-success"
                  : "bg-warning/20 text-warning-foreground")
          }
        >
          {checking
            ? lang === "sw"
              ? "Inakaguliwa"
              : "Checking"
            : error
              ? lang === "sw"
                ? "Haijathibitishwa"
                : "Unavailable"
              : configured
                ? lang === "sw"
                  ? "Imeunganishwa"
                  : "Connected"
                : lang === "sw"
                  ? "Haijaunganishwa"
                  : "Not connected"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {checking
          ? lang === "sw"
            ? "Tunathibitisha kama server inaweza kuona funguo za AI."
            : "Checking whether the server can read the AI keys."
          : error
            ? lang === "sw"
              ? "Hatujaweza kukagua muunganisho wa AI. Refresh ukurasa baada ya kuingia tena."
              : "Could not check the AI connection. Refresh the page after signing in again."
            : configured
              ? lang === "sw"
                ? `Chatbot, ushauri wa shamba, na ushauri wa fedha sasa zinatumia ${status?.provider} kupitia model ${status?.model}.`
                : `Chat, farm advice, and finance advice now use ${status?.provider} with model ${status?.model}.`
              : lang === "sw"
                ? "Weka GEMINI_API_KEY au OPENAI_API_KEY kwenye mazingira ya server ili kuwasha chatbot na ushauri wa AI."
                : "Add GEMINI_API_KEY or OPENAI_API_KEY to the server environment to enable chat and AI advice."}
      </p>
      {!configured ? (
        <code className="block rounded-md bg-muted px-3 py-2 font-mono text-xs">
          GEMINI_API_KEY=...
        </code>
      ) : null}
    </div>
  );
}

function DownloadExcelButton() {
  const fn = useServerFn(exportAllMyData);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const data = await fn();
      const wb = new ExcelJS.Workbook();
      wb.creator = "Veta Kipawa Agri Tech";
      wb.created = new Date();

      const sheets: Array<[string, Array<Record<string, string | number | boolean | null>>]> = [
        ["Profile", data.profile],
        ["Devices", data.devices],
        ["Readings", data.readings],
        ["Alerts", data.alerts],
        ["Commands", data.commands],
        ["Weather", data.weather_snapshots],
        ["Advice", data.advice_log],
        ["Finance", data.farm_finance],
        ["SupplierShop", data.supplier_shop],
        ["SupplierProducts", data.supplier_products],
      ];

      // Palette inayoendana na theme ya mfumo (kijani cha kilimo)
      const HEADER_BG = "FF166534"; // primary green
      const HEADER_FG = "FFFFFFFF";
      const BAND_BG = "FFF0FDF4"; // light green tint
      const TITLE_BG = "FF14532D";
      const BORDER = "FFBBF7D0";

      for (const [name, rowsRaw] of sheets) {
        const ws = wb.addWorksheet(name, {
          views: [{ state: "frozen", ySplit: 2 }],
          properties: { defaultRowHeight: 20 },
        });

        const rows = rowsRaw.length ? rowsRaw : [{ info: "Hakuna data" }];
        const headers = Object.keys(rows[0]);

        // Title row
        ws.mergeCells(1, 1, 1, Math.max(headers.length, 1));
        const titleCell = ws.getCell(1, 1);
        titleCell.value = `Veta Kipawa Agri Tech — ${name}`;
        titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
        titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TITLE_BG } };
        titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        ws.getRow(1).height = 28;

        // Header row
        const headerRow = ws.getRow(2);
        headers.forEach((h, i) => {
          const c = headerRow.getCell(i + 1);
          c.value = h;
          c.font = { name: "Calibri", size: 11, bold: true, color: { argb: HEADER_FG } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
          c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          c.border = {
            top: { style: "thin", color: { argb: BORDER } },
            bottom: { style: "medium", color: { argb: HEADER_BG } },
            left: { style: "thin", color: { argb: BORDER } },
            right: { style: "thin", color: { argb: BORDER } },
          };
        });
        headerRow.height = 24;

        // Data rows
        rows.forEach((row, ri) => {
          const r = ws.getRow(ri + 3);
          headers.forEach((h, i) => {
            const c = r.getCell(i + 1);
            const v = row[h as keyof typeof row];
            c.value = v as string | number | boolean | null;
            c.alignment = {
              vertical: "top",
              horizontal: typeof v === "number" ? "right" : "left",
              wrapText: true,
            };
            c.font = { name: "Calibri", size: 10, color: { argb: "FF14532D" } };
            if (ri % 2 === 1) {
              c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND_BG } };
            }
            c.border = {
              top: { style: "hair", color: { argb: BORDER } },
              bottom: { style: "hair", color: { argb: BORDER } },
              left: { style: "hair", color: { argb: BORDER } },
              right: { style: "hair", color: { argb: BORDER } },
            };
          });
        });

        // Auto-size columns based on content, with sane min/max
        headers.forEach((h, i) => {
          let maxLen = h.length;
          for (const row of rows) {
            const v = row[h as keyof typeof row];
            const s = v == null ? "" : String(v);
            // consider longest line if wrapped text has newlines
            for (const line of s.split("\n")) {
              if (line.length > maxLen) maxLen = line.length;
            }
          }
          const col = ws.getColumn(i + 1);
          col.width = Math.min(Math.max(maxLen + 4, 12), 60);
        });

        // Auto-filter on header row
        ws.autoFilter = {
          from: { row: 2, column: 1 },
          to: { row: 2, column: headers.length },
        };
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veta-kipawa-data-${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Data imepakuliwa.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Imeshindikana kupakua.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button onClick={download} disabled={busy} variant="outline">
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Pakua Excel
    </Button>
  );
}

function Row({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SecurityLevelCard({
  email,
  phone,
  whatsapp,
  avatarUrl,
}: {
  email: string | null;
  phone: string;
  whatsapp: string;
  avatarUrl: string;
}) {
  const checks = [
    {
      ok: typeof window !== "undefined" && window.location.protocol === "https:",
      label: "Muunganisho salama (HTTPS)",
    },
    { ok: !!email, label: "Email imethibitishwa" },
    { ok: !!phone, label: "Nambari ya simu imewekwa (kwa alerts)" },
    { ok: !!whatsapp, label: "WhatsApp imeunganishwa" },
    { ok: !!avatarUrl, label: "Picha ya wasifu imepakiwa" },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const tier = score >= 80 ? "Juu" : score >= 50 ? "Wastani" : "Chini";
  const tone =
    score >= 80
      ? "text-success bg-success/15"
      : score >= 50
        ? "text-warning-foreground bg-warning/20"
        : "text-destructive bg-destructive/15";

  return (
    <div className="space-y-3 rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4" /> Kiwango cha Usalama
        </h2>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold " + tone
          }
        >
          {score >= 80 ? (
            <ShieldCheck className="h-3.5 w-3.5" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" />
          )}
          {tier} · {score}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={
            "h-full transition-all " +
            (score >= 80 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive")
          }
          style={{ width: `${score}%` }}
        />
      </div>
      <ul className="space-y-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            <span
              className={
                "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold " +
                (c.ok ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")
              }
            >
              {c.ok ? "✓" : "•"}
            </span>
            <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Boresha kiwango kwa kujaza sehemu zote na kutumia nywila imara. Rotisha Device Key ya kifaa
        chako mara kwa mara ili kulinda vifaa vyako.
      </p>
    </div>
  );
}
