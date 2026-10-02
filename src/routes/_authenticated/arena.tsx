import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { Skeleton } from "@/components/holo/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { dailyChallenge, codingHint } from "@/lib/ai.functions";
import { awardXp } from "@/lib/xp";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Sparkles, Lightbulb, CheckCircle2, Flame, Terminal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/arena")({
  head: () => ({
    meta: [
      { title: "VIHAR // Coding Arena" },
      { name: "description", content: "Daily coding challenges, DSA practice, AI hints and code reviews with streak tracking." },
      { property: "og:title", content: "VIHAR // Coding Arena" },
      { property: "og:description", content: "Daily coding challenges, AI hints, code reviews and streaks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArenaPage,
});

type Attempt = { id: string; challenge_on: string; title: string; difficulty: string; topic: string | null; language: string; status: string };

const DIFFS = ["easy", "medium", "hard"] as const;

function ArenaPage() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [difficulty, setDifficulty] = useState<(typeof DIFFS)[number]>("medium");
  const [topic, setTopic] = useState("");
  const [problem, setProblem] = useState("");
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<null | "gen" | "hint" | "review">(null);

  const genFn = useServerFn(dailyChallenge);
  const hintFn = useServerFn(codingHint);

  async function load() {
    const { data } = (await supabase
      .from("coding_attempts" as never)
      .select("id, challenge_on, title, difficulty, topic, language, status")
      .order("challenge_on", { ascending: false })
      .limit(30)) as unknown as { data: Attempt[] | null };
    setAttempts(data || []);
  }
  useEffect(() => {
    load();
  }, []);

  const streak = computeStreak((attempts || []).filter((a) => a.status === "solved").map((a) => a.challenge_on));

  async function generate() {
    setBusy("gen");
    try {
      const text = await genFn({ data: { difficulty, topic } });
      setProblem(text);
      setFeedback("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function ask(mode: "hint" | "review") {
    if (!problem.trim()) return toast.error("Generate or paste a problem first.");
    if (mode === "review" && !code.trim()) return toast.error("Paste your solution to get a review.");
    setBusy(mode);
    try {
      setFeedback(await hintFn({ data: { problem, code, mode } }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function markSolved() {
    if (!problem.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const title = (problem.match(/^#\s*(.+)$/m)?.[1] || "Daily challenge").slice(0, 120);
    await supabase.from("coding_attempts" as never).insert({
      user_id: u.user.id,
      title,
      difficulty,
      topic: topic || null,
      solution: code || null,
      status: "solved",
    } as never);
    awardXp("coding", difficulty === "hard" ? 50 : difficulty === "medium" ? 30 : 20, { title });
    toast.success("Logged. XP awarded.");
    load();
  }

  return (
    <DashboardShell>
      <HudLabel>VIHAR // CODING ARENA</HudLabel>
      <h1 className="font-display text-2xl text-glow-cyan mt-1 mb-6">Coding Arena</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatTile label="STREAK" value={`${streak}d`} icon={<Flame className="w-4 h-4" />} />
        <StatTile label="SOLVED" value={String((attempts || []).filter((a) => a.status === "solved").length)} icon={<CheckCircle2 className="w-4 h-4" />} />
        <StatTile label="ATTEMPTS" value={String((attempts || []).length)} icon={<Terminal className="w-4 h-4" />} />
        <StatTile label="LEVEL" value={difficulty.toUpperCase()} icon={<Sparkles className="w-4 h-4" />} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <HoloPanel>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as (typeof DIFFS)[number])}
              className="px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm"
            >
              {DIFFS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic (graphs, DP...)"
              className="flex-1 min-w-[8rem] px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm"
            />
            <HoloButton onClick={generate} disabled={busy !== null}>
              <Sparkles className="w-3.5 h-3.5" /> {busy === "gen" ? "Forging..." : "Daily challenge"}
            </HoloButton>
          </div>

          {busy === "gen" ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : problem ? (
            <div className="chat-prose prose prose-sm prose-invert max-w-none max-h-[40vh] overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Pick a difficulty and forge today&apos;s challenge.</p>
          )}

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="// your solution"
            rows={8}
            className="mt-3 w-full px-3 py-2 rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm font-mono"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <HoloButton variant="ghost" onClick={() => ask("hint")} disabled={busy !== null}>
              <Lightbulb className="w-3.5 h-3.5" /> {busy === "hint" ? "Thinking..." : "Hints"}
            </HoloButton>
            <HoloButton variant="purple" onClick={() => ask("review")} disabled={busy !== null}>
              <Sparkles className="w-3.5 h-3.5" /> {busy === "review" ? "Reviewing..." : "AI review"}
            </HoloButton>
            <HoloButton onClick={markSolved} disabled={!problem}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark solved
            </HoloButton>
          </div>
        </HoloPanel>

        <div className="space-y-4">
          <HoloPanel glow="purple">
            <h2 className="hud-text text-xs mb-3">AI Coach</h2>
            {busy === "hint" || busy === "review" ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-10/12" />
                <Skeleton className="h-3 w-8/12" />
              </div>
            ) : feedback ? (
              <div className="chat-prose prose prose-sm prose-invert max-w-none max-h-[40vh] overflow-y-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{feedback}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Stuck? Ask for progressive hints — full solutions stay locked.</p>
            )}
          </HoloPanel>

          <HoloPanel>
            <h2 className="hud-text text-xs mb-3">Recent attempts</h2>
            {attempts === null ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : attempts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No attempts yet — your streak starts today.</p>
            ) : (
              <ul className="space-y-2 max-h-[32vh] overflow-y-auto">
                {attempts.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 p-2.5 rounded border border-[oklch(0.7_0.15_220/0.2)] bg-[oklch(0.1_0.04_270/0.4)]">
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${a.status === "solved" ? "text-[oklch(0.85_0.2_200)]" : "text-[oklch(0.6_0.1_220)]"}`} />
                    <span className="text-sm font-sans flex-1 min-w-0 truncate">{a.title}</span>
                    <span className="hud-text text-[10px] text-[oklch(0.6_0.1_220)]">{a.difficulty}</span>
                    <span className="hud-text text-[10px] text-[oklch(0.6_0.1_220)]">{a.challenge_on.slice(5)}</span>
                  </li>
                ))}
              </ul>
            )}
          </HoloPanel>
        </div>
      </div>
    </DashboardShell>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <HoloPanel className="p-3">
      <div className="hud-text text-[10px] text-[oklch(0.7_0.12_220)] flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="font-display text-xl text-glow-cyan mt-1">{value}</div>
    </HoloPanel>
  );
}

function computeStreak(dates: string[]) {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (set.has(key)) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else if (streak === 0 && key === new Date().toISOString().slice(0, 10)) {
      d.setDate(d.getDate() - 1);
      if (!set.has(d.toISOString().slice(0, 10))) break;
    } else break;
  }
  return streak;
}
