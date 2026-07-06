import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Badili Nywila — Veta Kipawa Agri Tech" },
      { name: "description", content: "Weka nywila mpya kwa akaunti yako." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        session
      ) {
        setHasSession(true);
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const token_hash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const errParam = url.searchParams.get("error_description") || url.searchParams.get("error");

        if (errParam) {
          setLinkError(decodeURIComponent(errParam));
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setHasSession(true);
          window.history.replaceState({}, "", url.pathname);
          return;
        }
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as "recovery",
          });
          if (error) throw error;
          setHasSession(true);
          window.history.replaceState({}, "", url.pathname);
          return;
        }
        const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
        if (hash) {
          const params = new URLSearchParams(hash);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          const hashErr = params.get("error_description") || params.get("error");
          if (hashErr) setLinkError(decodeURIComponent(hashErr));
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            setHasSession(true);
            window.history.replaceState({}, "", url.pathname);
            return;
          }
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) setHasSession(true);
      } catch (err) {
        setLinkError(err instanceof Error ? err.message : "Link haijafanya kazi.");
      } finally {
        setChecking(false);
      }
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  const resend = async () => {
    if (!resendEmail) {
      toast.error("Andika email yako kwanza.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success("Tumetuma link mpya ya kubadili nywila kwenye email yako.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Imeshindikana.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Nywila iwe na herufi 6 au zaidi.");
      return;
    }
    if (password !== confirm) {
      toast.error("Nywila hazifanani.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Nywila imebadilishwa. Karibu tena!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Imeshindikana.");
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
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-bold">Weka Nywila Mpya</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasSession
              ? "Andika nywila mpya hapa chini."
              : checking
                ? "Tunathibitisha link yako..."
                : "Link ya kubadili nywila imeisha muda au tayari ilitumika. Omba link mpya hapa chini."}
          </p>

          {!hasSession && !checking && (
            <div className="mt-4 space-y-2 rounded-lg border bg-muted/30 p-3">
              {linkError && <p className="text-xs text-destructive">{linkError}</p>}
              <Label htmlFor="resend-email" className="text-xs">
                Email yako
              </Label>
              <Input
                id="resend-email"
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="email@mfano.com"
              />
              <Button
                type="button"
                onClick={resend}
                disabled={loading || !resendEmail}
                className="w-full"
              >
                Tuma link mpya
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Fungua email kwenye simu/kompyuta yako kisha bofya link mpya — itakuleta hapa ukiwa
                umeingia.
              </p>
            </div>
          )}

          {hasSession && (
            <form onSubmit={submit} className="mt-6 space-y-3">
              <div>
                <Label htmlFor="password">Nywila mpya</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 z-10 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ficha nywila" : "Onyesha nywila"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm">Rudia nywila</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute inset-y-0 right-0 z-10 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? "Ficha nywila" : "Onyesha nywila"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                Hifadhi nywila
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="font-semibold text-primary hover:underline">
              Rudi kuingia
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
