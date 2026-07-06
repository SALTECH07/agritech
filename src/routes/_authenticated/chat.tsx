import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, Trash2, Bot, User as UserIcon, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askFarmAssistant, getMyDeviceContext } from "@/lib/chat.functions";
import { listMyDevices } from "@/lib/devices.functions";
import { getAIConnectionStatus } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const STORAGE_KEY = "vk_chat_v1";
const SESSION_REFRESH_WINDOW_MS = 2 * 60 * 1000;

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Msaidizi wa Kilimo — Veta Kipawa Agri Tech" }] }),
  component: ChatPage,
});

function isAuthWarningMessage(message: unknown) {
  if (!message || typeof message !== "object") return false;
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string") return false;
  const normalized = content.toLowerCase();
  return (
    content.includes("Please sign in first") ||
    content.includes("Tafadhali ingia kwanza") ||
    content.includes("use the AI assistant") ||
    normalized.includes("sign in first") ||
    normalized.includes("sign in again")
  );
}

function loadMessages(): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((m) => !isAuthWarningMessage(m)) : [];
  } catch {
    return [];
  }
}

function shouldRefreshSession(expiresAt?: number | null) {
  if (!expiresAt) return false;
  return expiresAt * 1000 - Date.now() <= SESSION_REFRESH_WINDOW_MS;
}

async function getFreshChatSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) return null;

  let session = data.session;

  if (shouldRefreshSession(data.session.expires_at)) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.session?.access_token) session = refreshed.data.session;
  }

  const user = await supabase.auth.getUser(session.access_token);
  if (!user.error && user.data?.user) return session;

  const refreshed = await supabase.auth.refreshSession();
  if (!refreshed.data.session?.access_token) return null;

  const refreshedUser = await supabase.auth.getUser(refreshed.data.session.access_token);
  return refreshedUser.error || !refreshedUser.data?.user ? null : refreshed.data.session;
}

function ChatPage() {
  const { t, lang } = useT();
  const fetchCtx = useServerFn(getMyDeviceContext);
  const askAssistantFn = useServerFn(askFarmAssistant);
  const listDevicesFn = useServerFn(listMyDevices);
  const aiStatusFn = useServerFn(getAIConnectionStatus);

  const sessionQuery = useQuery({
    queryKey: ["chat-session"],
    queryFn: getFreshChatSession,
    retry: false,
    staleTime: 30_000,
  });

  const canChat = Boolean(sessionQuery.data?.access_token);
  const authChecking = sessionQuery.isLoading || sessionQuery.isFetching;
  const needsSignIn = !authChecking && !canChat;

  const devicesQuery = useQuery({
    queryKey: ["chat-devices"],
    queryFn: () => listDevicesFn(),
    enabled: canChat,
    staleTime: 60_000,
  });

  const aiStatus = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => aiStatusFn(),
    staleTime: 60_000,
  });

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const ctxQuery = useQuery({
    queryKey: ["chat-device-context", selectedDeviceId || "all"],
    queryFn: () => fetchCtx({ data: selectedDeviceId ? { device_id: selectedDeviceId } : {} }),
    enabled: canChat,
    staleTime: 30_000,
  });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load from localStorage once mounted (avoid SSR mismatch)
  useEffect(() => {
    setMessages(loadMessages());
  }, []);

  // Persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // Focus input on mount + after streaming
  useEffect(() => {
    if (!streaming) inputRef.current?.focus();
  }, [streaming]);

  const send = async () => {
    const text = input.trim();
    if (streaming || authChecking) return;
    if (!text) {
      toast.error(
        lang === "sw"
          ? "Andika swali kwanza, kisha bonyeza kutuma."
          : "Type a question first, then press send.",
      );
      inputRef.current?.focus();
      return;
    }

    const session = await getFreshChatSession();
    if (!session?.access_token) {
      await sessionQuery.refetch();
      toast.error(
        lang === "sw"
          ? "Ingia kwanza ili Msaidizi atumie taarifa za shamba lako."
          : "Sign in first so the assistant can use your farm information.",
      );
      return;
    }

    setInput("");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantMsg: Msg = { id: crypto.randomUUID(), role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await askAssistantFn({
        data: {
          lang,
          deviceContext: ctxQuery.data?.text ?? "",
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setMessages((m) =>
        m.map((msg) => (msg.id === assistantMsg.id ? { ...msg, content: result.text } : msg)),
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : t("error_generic");
      toast.error(msg);
      if (isAuthWarningMessage({ content: msg })) {
        setMessages((m) => m.filter((x) => x.id !== assistantMsg.id));
        return;
      }
      setMessages((m) =>
        m.map((x) => (x.id === assistantMsg.id ? { ...x, content: `⚠️ ${msg}` } : x)),
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const clear = () => {
    if (streaming) abortRef.current?.abort();
    setMessages([]);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-180px)] max-w-3xl flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">{t("chat_title")}</h1>
            <p className="text-xs text-muted-foreground">{t("chat_subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              "hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex " +
              (aiStatus.isLoading
                ? "bg-muted text-muted-foreground"
                : aiStatus.isError
                  ? "bg-destructive/15 text-destructive"
                  : aiStatus.data?.configured
                    ? "bg-success/15 text-success"
                    : "bg-warning/20 text-warning-foreground")
            }
          >
            {aiStatus.isLoading
              ? lang === "sw"
                ? "AI inakaguliwa"
                : "Checking AI"
              : aiStatus.isError
                ? lang === "sw"
                  ? "AI haijathibitishwa"
                  : "Refresh AI status"
                : aiStatus.data?.configured
                  ? lang === "sw"
                    ? "AI imeunganishwa"
                    : "AI connected"
                  : lang === "sw"
                    ? "AI haijaunganishwa"
                    : "AI not connected"}
          </span>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} aria-label={t("chat_clear")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {devicesQuery.data && devicesQuery.data.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <label className="text-muted-foreground">{t("chat_select_device")}:</label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="rounded-md border bg-background px-2 py-1"
          >
            <option value="">{t("chat_all_devices")}</option>
            {devicesQuery.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.crop ? ` — ${d.crop}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border bg-card/40 p-4"
      >
        {messages.length === 0 && (
          <EmptyState
            t={t}
            lang={lang}
            aiReady={aiStatus.data?.configured}
            aiChecking={aiStatus.isLoading}
            aiError={aiStatus.isError}
            needsSignIn={needsSignIn}
            provider={aiStatus.data?.provider}
            onPick={setInput}
          />
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            streaming={streaming && m.role === "assistant" && m === messages[messages.length - 1]}
          />
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex gap-2"
      >
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={
            authChecking
              ? lang === "sw"
                ? "Tunathibitisha kuingia..."
                : "Checking sign-in..."
              : needsSignIn
                ? lang === "sw"
                  ? "Ingia kwanza ili kuuliza swali..."
                  : "Sign in first to ask a question..."
                : t("chat_placeholder")
          }
          className="resize-none"
          disabled={streaming || authChecking || needsSignIn}
        />
        {needsSignIn ? (
          <Button asChild size="lg">
            <Link to="/auth">
              <LogIn className="h-4 w-4" />
              {lang === "sw" ? "Ingia" : "Sign in"}
            </Link>
          </Button>
        ) : (
          <Button
            type="submit"
            size="lg"
            disabled={streaming || authChecking || !canChat}
            aria-label={t("send")}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
}

function MessageBubble({ msg, streaming }: { msg: Msg; streaming: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary text-primary-foreground" : "bg-accent/40 text-accent-foreground"
        }`}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isUser ? "bg-primary text-primary-foreground" : "bg-background text-foreground border"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : msg.content ? (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
            {streaming && (
              <span className="ml-1 inline-block h-3 w-2 animate-pulse bg-primary/60" />
            )}
          </div>
        ) : (
          <span className="inline-flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  t,
  lang,
  aiReady,
  aiChecking,
  aiError,
  needsSignIn,
  provider,
  onPick,
}: {
  t: (k: never) => string;
  lang: "sw" | "en";
  aiReady?: boolean;
  aiChecking?: boolean;
  aiError?: boolean;
  needsSignIn?: boolean;
  provider?: string;
  onPick: (s: string) => void;
}) {
  const suggestions = [
    t("chat_suggest_1" as never),
    t("chat_suggest_2" as never),
    t("chat_suggest_3" as never),
    t("chat_suggest_4" as never),
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold">{t("chat_welcome" as never)}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {t("chat_welcome_sub" as never)}
      </p>
      <p className="mt-2 max-w-md text-xs text-muted-foreground">
        {needsSignIn
          ? lang === "sw"
            ? "Ingia kwanza ili Msaidizi atumie taarifa za shamba lako na kutoa ushauri sahihi."
            : "Sign in first so the assistant can use your farm information and give useful advice."
          : aiChecking
            ? lang === "sw"
              ? "Tunathibitisha muunganisho wa AI kwenye server."
              : "Checking the server AI connection."
            : aiError
              ? lang === "sw"
                ? "Hatujaweza kuthibitisha muunganisho wa AI. Ingia tena au refresh ukurasa."
                : "Could not verify the AI connection. Sign in again or refresh the page."
              : aiReady
                ? lang === "sw"
                  ? `Imeunganishwa na ${provider ?? "AI"} na inaweza kutumia vipimo vya kifaa, hali ya hewa, na taarifa za shamba kutoa ushauri rahisi.`
                  : `Connected to ${provider ?? "AI"} and can use device readings, weather, and farm records to give simple advice.`
                : lang === "sw"
                  ? "AI haijaunganishwa bado. Weka GEMINI_API_KEY au OPENAI_API_KEY kwenye server ili kuwasha ushauri wa AI."
                  : "AI is not connected yet. Add GEMINI_API_KEY or OPENAI_API_KEY on the server to enable AI advice."}
      </p>
      {needsSignIn ? (
        <Button asChild className="mt-5">
          <Link to="/auth">
            <LogIn className="h-4 w-4" />
            {lang === "sw" ? "Ingia ili kutumia msaidizi" : "Sign in to use assistant"}
          </Link>
        </Button>
      ) : (
        <div className="mt-6 grid w-full max-w-md gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-lg border bg-card px-3 py-2 text-left text-sm transition hover:border-primary hover:bg-primary/5"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
