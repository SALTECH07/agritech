import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { flaskLogin, flaskRegister, getCurrentFlaskUser } from "@/lib/flask-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle } from "@/components/lang-toggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingia — Veta Kipawa Agri Tech" },
      { name: "description", content: "Ingia au jisajili kwenye Veta Kipawa Agri Tech." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    getCurrentFlaskUser().then((user) => {
      if (user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        await flaskLogin(email, password);
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "up") {
        await flaskRegister(email, password, fullName);
        toast.success("Akaunti imeundwa!");
        navigate({ to: "/dashboard", replace: true });
      } else {
        toast.error("Password reset is not available for Flask login yet.");
        setMode("in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Leaf className="h-5 w-5" />
            </span>
            Veta Kipawa
          </Link>
          <LangToggle />
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-bold">
            {mode === "in"
              ? t("welcome_back")
              : mode === "up"
                ? t("create_account")
                : "Sahau Nywila"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "Andika email yako tutakutumia link ya kubadili nywila."
              : t("tagline")}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === "up" && (
              <div>
                <Label htmlFor="name">{t("full_name")}</Label>
                <Input
                  id="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <Label htmlFor="password">{t("password")}</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ficha nywila" : "Onyesha nywila"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "in" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    Umesahau nywila?
                  </button>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "in" ? t("sign_in") : mode === "up" ? t("sign_up") : "Tuma link"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "forgot" ? (
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => setMode("in")}
              >
                Rudi kuingia
              </button>
            ) : (
              <>
                {mode === "in" ? t("no_account") : t("have_account")}{" "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={() => setMode(mode === "in" ? "up" : "in")}
                >
                  {mode === "in" ? t("sign_up") : t("sign_in")}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
