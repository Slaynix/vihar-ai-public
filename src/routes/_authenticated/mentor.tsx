import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { SpeakButton } from "@/components/holo/ReadAloudPlayer";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { AIResponse } from "@/components/ui-system/AIResponse";
import { ErrorState } from "@/components/ui-system";
import { WeatherCard } from "@/components/holo/WeatherCard";
import { getWeather, describeWeather, type WeatherResult } from "@/lib/weather.functions";
import { useCalmWhile } from "@/lib/perf";
import { SkeletonChat, SkeletonList } from "@/components/holo/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Send, Mic, MicOff, Plus, MessageSquare, Trash2, Loader2, Cpu, Image as ImageIcon, FileText as FileIcon, PanelLeft, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mentor")({
  head: () => ({
    meta: [
      { title: "VIHAR // AI Mentor" },
      { name: "description", content: "Conversational AI mentor for coding, study plans, careers and live answers." },
      { property: "og:title", content: "VIHAR // AI Mentor" },
      { property: "og:description", content: "Conversational AI mentor for coding, study plans, careers and live answers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MentorPage,
});

/** Weather intent detection — keeps the AI from guessing live conditions. */
const WEATHER_RE =
  /\b(weather|forecast|temperature|how (?:hot|cold)|raining|will it rain|humidity|wind speed)\b/i;

function extractCity(text: string): string | null {
  const m = text.match(/\b(?:in|at|for)\s+([A-Za-z][A-Za-z\s.'-]{1,40})/i);
  if (!m) return null;
  return m[1]
    .replace(/\b(today|tomorrow|now|right now|tonight|this week|please)\b/gi, "")
    .replace(/[?.!,]/g, "")
    .trim() || null;
}

function currentPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 6000, maximumAge: 10 * 60 * 1000 },
    );
  });
}


type Thread = { id: string; title: string; updated_at: string };

/** Track the visual viewport so the composer stays above the mobile keyboard. */
function useViewportHeightVar() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const apply = () => {
      const h = vv?.height ?? window.innerHeight;
      root.style.setProperty("--app-vh", `${h}px`);
    };
    apply();
    vv?.addEventListener("resize", apply);
    window.addEventListener("resize", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--app-vh");
    };
  }, []);
}

function MentorPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState<"flash" | "pro">("flash");
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loadedThread, setLoadedThread] = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useViewportHeightVar();

  // Load threads
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("threads" as never)
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false }) as unknown as { data: Thread[] | null };
      const list = data || [];
      setThreads(list);
      if (list.length > 0) setActiveId(list[0].id);
      else await createThread();
      setThreadsLoading(false);
    })();
  }, []);

  async function createThread() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("threads" as never)
      .insert({ user_id: u.user.id, title: "New conversation" } as never)
      .select("id, title, updated_at")
      .single() as unknown as { data: Thread | null };
    if (data) {
      setThreads((prev) => [data, ...prev]);
      setActiveId(data.id);
      setInitialMessages([]);
      setLoadedThread(data.id);
      setDrawerOpen(false);
    }
  }

  async function deleteThread(id: string) {
    await supabase.from("threads" as never).delete().eq("id", id);
    setThreads((p) => p.filter((t) => t.id !== id));
    if (activeId === id) {
      const next = threads.find((t) => t.id !== id);
      if (next) setActiveId(next.id);
      else await createThread();
    }
  }

  // Load messages when active thread changes
  useEffect(() => {
    if (!activeId) return;
    if (loadedThread === activeId) return;
    (async () => {
      const { data } = await supabase
        .from("messages" as never)
        .select("id, role, parts, created_at")
        .eq("thread_id", activeId)
        .order("created_at", { ascending: true }) as unknown as { data: { id: string; role: string; parts: unknown }[] | null };
      const msgs: UIMessage[] = (data || []).map((r) => ({
        id: r.id,
        role: r.role as UIMessage["role"],
        parts: r.parts as UIMessage["parts"],
      }));
      setInitialMessages(msgs);
      setLoadedThread(activeId);
    })();
  }, [activeId, loadedThread]);

  const handleThreadTitle = useCallback(
    (title: string) => {
      setThreads((p) => p.map((t) => (t.id === activeId ? { ...t, title } : t)));
    },
    [activeId],
  );

  const sidebar = (
    <>
      <button
        onClick={createThread}
        className="hud-text text-xs flex items-center justify-center gap-2 px-3 min-h-[44px] rounded border border-[oklch(0.85_0.2_200/0.5)] text-[oklch(0.9_0.1_220)] hover:bg-[oklch(0.85_0.2_200/0.1)]"
      >
        <Plus className="w-4 h-4" /> New conversation
      </button>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
        {threadsLoading ? (
          <SkeletonList />
        ) : (
          threads.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center gap-2 rounded text-sm transition",
                activeId === t.id
                  ? "bg-[oklch(0.85_0.2_200/0.12)] border border-[oklch(0.85_0.2_200/0.4)] text-glow-cyan"
                  : "border border-transparent hover:border-[oklch(0.7_0.15_220/0.2)] hover:bg-[oklch(0.7_0.15_220/0.05)]",
              )}
            >
              <button
                onClick={() => { setActiveId(t.id); setDrawerOpen(false); }}
                className="flex-1 min-w-0 flex items-center gap-2 px-3 min-h-[44px] text-left"
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate font-sans">{t.title}</span>
              </button>
              <button
                onClick={() => deleteThread(t.id)}
                className="px-3 min-h-[44px] md:opacity-0 md:group-hover:opacity-100 text-[oklch(0.7_0.18_25)] hover:text-[oklch(0.85_0.22_25)]"
                aria-label="Delete conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="hud-text text-[10px] text-[oklch(0.6_0.1_220)] flex items-center gap-2 px-1">
        <Cpu className="w-3 h-3" /> MODEL
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as "flash" | "pro")}
          className="ml-auto bg-transparent border border-[oklch(0.7_0.15_220/0.3)] rounded px-2 py-1 min-h-[36px]"
        >
          <option value="flash">FLASH</option>
          <option value="pro">PRO</option>
        </select>
      </div>
    </>
  );

  return (
    <DashboardShell>
      <div className="flex flex-row gap-4 h-[calc(var(--app-vh,100dvh)-11.5rem)] md:h-[calc(100dvh-6.5rem)] min-h-[22rem]">
        {/* Sidebar — permanent from md up */}
        <aside className="hidden md:flex md:w-64 shrink-0 flex-col gap-2 min-h-0">{sidebar}</aside>

        {/* Sidebar — mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
                className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              />
              <motion.aside
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.2 }}
                className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-[80vw] max-w-xs flex flex-col gap-2 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-[oklch(0.08_0.03_270/0.97)] border-r border-[oklch(0.7_0.15_220/0.25)]"
              >
                <div className="flex items-center justify-between">
                  <HudLabel>CONVERSATIONS</HudLabel>
                  <button onClick={() => setDrawerOpen(false)} aria-label="Close" className="p-2 -mr-2 text-[oklch(0.8_0.12_220)]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {sidebar}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Chat */}
        <div className="flex-1 min-w-0 min-h-0">
          {activeId && loadedThread === activeId ? (
            <ChatPanel
              key={activeId}
              threadId={activeId}
              initialMessages={initialMessages}
              model={model}
              onThreadTitle={handleThreadTitle}
              onOpenDrawer={() => setDrawerOpen(true)}
            />
          ) : (
            <HoloPanel className="h-full p-0 overflow-hidden">
              <SkeletonChat />
            </HoloPanel>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function ChatPanel({
  threadId,
  initialMessages,
  model,
  onThreadTitle,
  onOpenDrawer,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  model: "flash" | "pro";
  onThreadTitle: (t: string) => void;
  onOpenDrawer: () => void;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { model, useMemory: true },
        fetch: async (input, init) => {
          const headers = new Headers(init?.headers);
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(input, { ...init, headers });
        },
      }),
    [model],
  );
  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });

  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const fetchWeather = useServerFn(getWeather);
  const recogRef = useRef<unknown>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastPersistedCount = useRef(initialMessages.length);

  // Freeze the 3D background while a reply is streaming — keeps mobile smooth.
  useCalmWhile(status === "submitted" || status === "streaming" || weatherLoading);

  useEffect(() => { inputRef.current?.focus(); }, [threadId]);


  // Auto-scroll the transcript container itself (works with a pinned composer).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  // Persist new messages once stream completes
  useEffect(() => {
    if (status !== "ready") return;
    if (messages.length <= lastPersistedCount.current) return;
    const fresh = messages.slice(lastPersistedCount.current);
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const rows = fresh.map((m) => ({
        thread_id: threadId,
        user_id: u.user!.id,
        role: m.role,
        parts: m.parts as unknown,
      }));
      await supabase.from("messages" as never).insert(rows as never);
      // Update thread title from first user message
      const firstUser = messages.find((m) => m.role === "user");
      if (firstUser) {
        const text = (firstUser.parts || [])
          .map((p) => (p.type === "text" ? p.text : ""))
          .join(" ")
          .slice(0, 60);
        if (text) {
          await supabase.from("threads" as never).update({ title: text, updated_at: new Date().toISOString() } as never).eq("id", threadId);
          onThreadTitle(text);
        }
      } else {
        await supabase.from("threads" as never).update({ updated_at: new Date().toISOString() } as never).eq("id", threadId);
      }
      lastPersistedCount.current = messages.length;
    })();
  }, [status, messages, threadId, onThreadTitle]);

  /** Real weather data first, then let the model summarise only those numbers. */
  async function resolveWeather(text: string): Promise<string | null> {
    setWeatherError(null);
    setWeatherLoading(true);
    try {
      const city = extractCity(text);
      let result: WeatherResult;
      if (city) {
        result = await fetchWeather({ data: { city } });
      } else {
        const pos = await currentPosition();
        if (!pos) {
          setWeatherError("I need a city name (or location access) to give you real weather.");
          return null;
        }
        result = await fetchWeather({ data: { lat: pos.lat, lon: pos.lon } });
      }
      setWeather(result);
      const days = result.daily
        .map((d) => `${d.date}: ${d.minC}–${d.maxC}°C, ${d.rainChance}% rain, ${describeWeather(d.code)}`)
        .join("; ");
      return [
        `LIVE WEATHER DATA (Open-Meteo, authoritative — do not invent or adjust any number):`,
        `Place: ${result.place}${result.country ? `, ${result.country}` : ""}`,
        `Now: ${result.tempC}°C (feels ${result.feelsLikeC}°C), ${result.condition}, humidity ${result.humidity}%, wind ${result.windKph} km/h, rain chance ${result.rainChance}%.`,
        `Next days: ${days}`,
        `Summarise this in 2–3 sentences with one practical tip. Never state numbers not listed above.`,
      ].join("\n");
    } catch (err) {
      setWeatherError((err as Error).message);
      return null;
    } finally {
      setWeatherLoading(false);
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    setInput("");
    if (WEATHER_RE.test(text)) {
      const context = await resolveWeather(text);
      await sendMessage({ text: context ? `${text}\n\n${context}` : text });
      return;
    }
    await sendMessage({ text });
  }


  function toggleMic() {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported in this browser."); return; }
    if (listening) {
      (recogRef.current as { stop?: () => void } | null)?.stop?.();
      setListening(false);
      return;
    }
    const r = new (SR as new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void; })();
    r.continuous = false; r.interimResults = true; r.lang = "en-US";
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    recogRef.current = r;
    setListening(true);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("File must be < 8MB"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const isImage = file.type.startsWith("image/");
      const parts: UIMessage["parts"] = isImage
        ? [
            { type: "text", text: input.trim() || "What's in this?" },
            { type: "file" as const, mediaType: file.type, url: dataUrl, filename: file.name },
          ]
        : [
            { type: "text", text: input.trim() || `Analyze this document: ${file.name}` },
            { type: "file" as const, mediaType: file.type, url: dataUrl, filename: file.name },
          ];
      setInput("");
      await sendMessage({ parts });
    };
    reader.readAsDataURL(file);
  }

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <HoloPanel className="h-full flex flex-col p-0 overflow-hidden">
      {/* Header */}
      <div className="px-3 sm:px-4 py-2.5 border-b border-[oklch(0.7_0.15_220/0.15)] flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenDrawer}
          className="md:hidden -ml-1 p-2 rounded text-[oklch(0.8_0.12_220)]"
          aria-label="Conversations"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <div className={cn("w-2 h-2 rounded-full bg-[oklch(0.85_0.2_200)] shrink-0", isLoading && "glow-pulse")} />
        <HudLabel>
          <span className="truncate">VIHAR // MENTOR · {model === "pro" ? "GEMINI 2.5 PRO" : "GEMINI FLASH"}</span>
        </HudLabel>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth px-3 sm:px-4 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-8 sm:mt-12 space-y-3">
            <div className="inline-block p-4 rounded-full bg-[oklch(0.85_0.2_200/0.12)] glow-pulse">
              <Cpu className="w-8 h-8 text-[oklch(0.85_0.2_200)]" />
            </div>
            <h2 className="font-display text-xl text-glow-cyan">VIHAR online</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Ask me anything — code, study plans, career advice, project ideas.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-lg mx-auto">
              {["Explain transformers simply", "Plan my CS final week", "Roast my resume", "Generate quiz on OS"].map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage({ text: p })}
                  className="text-xs px-3 py-2 min-h-[40px] rounded-full border border-[oklch(0.7_0.15_220/0.3)] hover:border-[oklch(0.85_0.2_200/0.6)] hover:text-glow-cyan transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {weatherLoading && (
          <div className="flex items-center gap-2 text-xs hud-text text-[oklch(0.85_0.18_200)]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="opacity-70">Fetching live weather...</span>
          </div>
        )}
        {weatherError && <ErrorState message={weatherError} />}
        {weather && <WeatherCard data={weather} />}



        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-xs hud-text text-[oklch(0.85_0.18_200)]"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="opacity-70">VIHAR is thinking...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="text-xs text-[oklch(0.75_0.22_25)] font-sans">⚠ {error.message}</div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="border-t border-[oklch(0.7_0.15_220/0.15)] p-2.5 sm:p-3 shrink-0 bg-[oklch(0.09_0.03_270/0.6)]"
      >
        <div className="flex items-end gap-2">
          <label className="cursor-pointer shrink-0 grid place-items-center w-11 h-11 rounded-lg border border-[oklch(0.7_0.15_220/0.25)] hover:border-[oklch(0.85_0.2_200/0.5)] text-[oklch(0.8_0.12_220)]" title="Attach">
            <input type="file" accept="image/*,application/pdf,.txt,.md" className="hidden" onChange={handleFile} />
            <ImageIcon className="w-4 h-4" />
          </label>
          <button
            type="button"
            onClick={toggleMic}
            className={cn(
              "shrink-0 grid place-items-center w-11 h-11 rounded-lg border transition",
              listening
                ? "border-[oklch(0.7_0.25_25/0.7)] text-[oklch(0.85_0.22_25)] bg-[oklch(0.7_0.25_25/0.15)] animate-pulse"
                : "border-[oklch(0.7_0.15_220/0.25)] text-[oklch(0.8_0.12_220)] hover:border-[oklch(0.85_0.2_200/0.5)]"
            )}
            title="Voice"
            aria-label="Voice input"
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            rows={1}
            placeholder="Transmit your query..."
            className="flex-1 min-w-0 resize-none max-h-32 min-h-[44px] px-3 py-3 rounded-lg bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-base sm:text-sm focus:outline-none focus:border-[oklch(0.85_0.2_200/0.7)] focus:shadow-[0_0_16px_oklch(0.85_0.2_200/0.3)] font-sans"
          />
          <HoloButton type="submit" disabled={isLoading || !input.trim()} className="!px-3 !py-0 !h-11 shrink-0">
            <Send className="w-4 h-4" />
          </HoloButton>
        </div>
      </form>
    </HoloPanel>
  );
}

const MessageBubble = memo(function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = (message.parts || []).map((p) => (p.type === "text" ? p.text : "")).join("\n");
  const fileParts = (message.parts || []).filter((p) => p.type === "file") as Array<{ type: "file"; mediaType?: string; url?: string; filename?: string }>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("flex gap-2 sm:gap-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-[oklch(0.85_0.2_200/0.15)] border border-[oklch(0.85_0.2_200/0.5)] flex items-center justify-center text-[oklch(0.85_0.2_200)]">
          <Cpu className="w-3.5 h-3.5" />
        </div>
      )}
      <div className={cn("min-w-0", isUser ? "max-w-[88%] sm:max-w-[80%]" : "max-w-[92%] sm:max-w-[80%]")}>
        {fileParts.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {fileParts.map((f, i) =>
              f.mediaType?.startsWith("image/") ? (
                <img key={i} src={f.url} alt={f.filename} loading="lazy" className="max-w-full sm:max-w-[200px] rounded-lg border border-[oklch(0.7_0.15_220/0.3)]" />
              ) : (
                <div key={i} className="text-xs px-2 py-1 rounded border border-[oklch(0.7_0.15_220/0.3)] flex items-center gap-1.5 max-w-full">
                  <FileIcon className="w-3 h-3 shrink-0" /> <span className="truncate">{f.filename}</span>
                </div>
              )
            )}
          </div>
        )}
        <div
          className={cn(
            "chat-prose rounded-2xl px-4 py-3 text-[15px] leading-[1.7] font-sans",
            isUser
              ? "bg-[oklch(0.85_0.2_200)] text-[oklch(0.08_0.05_270)] rounded-br-md font-medium"
              : "bg-[oklch(0.16_0.05_275/0.55)] border border-[oklch(0.7_0.15_220/0.18)] text-[oklch(0.95_0.03_220)] rounded-bl-md"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{text}</p>
          ) : (
            <AIResponse>{text}</AIResponse>
          )}

        </div>
        {!isUser && text && <SpeakButton id={message.id} text={text} label="AI MENTOR" className="mt-1.5" />}
      </div>
    </motion.div>
  );
});
