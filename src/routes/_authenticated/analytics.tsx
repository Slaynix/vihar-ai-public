import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { Skeleton } from "@/components/holo/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { dailyMissionsAI, studentInsights } from "@/lib/ai.functions";
import { levelFromXp, awardXp } from "@/lib/xp";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { Flame, Zap, Timer, Terminal, GraduationCap, Trophy, Sparkles, Target, CheckCircle2, Gift } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "VIHAR // Student Command Center" },
      { name: "description", content: "XP, levels, daily missions, achievements and cross-module analytics for your semester." },
      { property: "og:title", content: "VIHAR // Student Command Center" },
      { property: "og:description", content: "Gamified analytics: XP, missions, streaks, semester health and AI insights." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

type Mission = { id: string; title: string; detail: string | null; xp: number; done: boolean };

type Loaded = {
  xp: { points: number; source: string; created_at: string }[];
  focus: { duration_min: number; ended_at: string }[];
  tasks: { priority: string; status: string }[];
  coding: { challenge_on: string; status: string; difficulty: string }[];
  courses: { credits: number; grade_point: number }[];
  subjects: { total_classes: number; attended: number }[];
  goals: { progress_pct: number; status: string }[];
  achievements: { id: string; code: string; title: string; earned_at: string }[];
  missions: Mission[];
};

const BADGES = [
  { code: "first_steps", title: "First Steps", need: 50 },
  { code: "focused", title: "Focused Mind", need: 250 },
  { code: "grinder", title: "Grinder", need: 600 },
  { code: "scholar", title: "Scholar", need: 1200 },
  { code: "legend", title: "Campus Legend", need: 2500 },
];

const REWARDS = [
  { code: "theme_nebula", title: "Nebula Theme", level: 2 },
  { code: "theme_solar", title: "Solar Flare Theme", level: 4 },
  { code: "avatar_frame", title: "Holo Avatar Frame", level: 6 },
  { code: "hud_pro", title: "HUD Pro Layout", level: 9 },
];

function AnalyticsPage() {
  const [d, setD] = useState<Loaded | null>(null);
  const [insights, setInsights] = useState("");
  const [busy, setBusy] = useState<null | "insights" | "missions">(null);
  const missionsFn = useServerFn(dailyMissionsAI);
  const insightsFn = useServerFn(studentInsights);

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
    const q = <T,>(p: unknown) => p as unknown as Promise<{ data: T[] | null }>;
    const [xp, focus, tasks, coding, courses, subjects, goals, ach, miss] = await Promise.all([
      q<Loaded["xp"][number]>(supabase.from("xp_events" as never).select("points, source, created_at").order("created_at", { ascending: false }).limit(500)),
      q<Loaded["focus"][number]>(supabase.from("focus_sessions" as never).select("duration_min, ended_at").gte("ended_at", since14)),
      q<Loaded["tasks"][number]>(supabase.from("tasks" as never).select("priority, status")),
      q<Loaded["coding"][number]>(supabase.from("coding_attempts" as never).select("challenge_on, status, difficulty")),
      q<Loaded["courses"][number]>(supabase.from("semester_courses" as never).select("credits, grade_point")),
      q<Loaded["subjects"][number]>(supabase.from("subjects" as never).select("total_classes, attended")),
      q<Loaded["goals"][number]>(supabase.from("goals" as never).select("progress_pct, status")),
      q<Loaded["achievements"][number]>(supabase.from("achievements" as never).select("id, code, title, earned_at")),
      q<Mission>(supabase.from("daily_missions" as never).select("id, title, detail, xp, done").eq("mission_on", today)),
    ]);
    setD({
      xp: xp.data || [],
      focus: focus.data || [],
      tasks: tasks.data || [],
      coding: coding.data || [],
      courses: courses.data || [],
      subjects: subjects.data || [],
      goals: goals.data || [],
      achievements: ach.data || [],
      missions: miss.data || [],
    });
  }
  useEffect(() => {
    load();
  }, []);

  const totalXp = (d?.xp || []).reduce((s, e) => s + e.points, 0);
  const lvl = levelFromXp(totalXp);

  const focusMin = (d?.focus || []).reduce((s, f) => s + f.duration_min, 0);
  const solved = (d?.coding || []).filter((c) => c.status === "solved");
  const codingStreak = streakOf(solved.map((c) => c.challenge_on));
  const studyStreak = streakOf((d?.xp || []).map((e) => e.created_at.slice(0, 10)));

  const credits = (d?.courses || []).reduce((s, c) => s + Number(c.credits), 0);
  const cgpa = credits ? (d?.courses || []).reduce((s, c) => s + Number(c.credits) * Number(c.grade_point), 0) / credits : 0;

  const totalClasses = (d?.subjects || []).reduce((s, x) => s + x.total_classes, 0);
  const attendancePct = totalClasses ? Math.round(((d?.subjects || []).reduce((s, x) => s + x.attended, 0) / totalClasses) * 100) : 0;

  const openTasks = (d?.tasks || []).filter((t) => t.status === "open").length;
  const goalAvg = (d?.goals || []).length ? Math.round((d?.goals || []).reduce((s, g) => s + g.progress_pct, 0) / (d?.goals || []).length) : 0;

  const health = Math.round(
    clamp(attendancePct) * 0.2 +
      clamp(cgpa * 10) * 0.25 +
      clamp((focusMin / 600) * 100) * 0.2 +
      clamp((codingStreak / 7) * 100) * 0.15 +
      clamp(goalAvg) * 0.2,
  );

  const focusSeries = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) byDay[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = 0;
    (d?.focus || []).forEach((f) => {
      const k = f.ended_at.slice(0, 10);
      if (k in byDay) byDay[k] += f.duration_min;
    });
    return Object.entries(byDay).map(([day, minutes]) => ({ day: day.slice(5), minutes }));
  }, [d]);

  const xpBySource = useMemo(() => {
    const by: Record<string, number> = {};
    (d?.xp || []).forEach((e) => {
      by[e.source] = (by[e.source] || 0) + e.points;
    });
    const entries = Object.entries(by);
    return entries.length ? entries.map(([source, points]) => ({ source, points })) : [{ source: "start", points: 0 }];
  }, [d]);

  const heat = useMemo(() => {
    const days = Array.from({ length: 35 }, (_, i) => new Date(Date.now() - (34 - i) * 86400000).toISOString().slice(0, 10));
    const by: Record<string, number> = {};
    (d?.xp || []).forEach((e) => {
      const k = e.created_at.slice(0, 10);
      by[k] = (by[k] || 0) + e.points;
    });
    return days.map((day) => ({ day, points: by[day] || 0 }));
  }, [d]);

  async function generateMissions() {
    setBusy("missions");
    try {
      const ctx = `Level ${lvl.level}, ${totalXp} XP, ${focusMin} focus minutes in 14 days, ${solved.length} problems solved, coding streak ${codingStreak}, ${openTasks} open tasks, CGPA ${cgpa.toFixed(2)}, attendance ${attendancePct}%.`;
      const missions = await missionsFn({ data: { context: ctx } });
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.from("daily_missions" as never).insert(
        missions.map((m) => ({ user_id: u.user!.id, title: m.title, detail: m.detail, xp: m.xp })) as never,
      );
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function completeMission(m: Mission) {
    await supabase.from("daily_missions" as never).update({ done: true } as never).eq("id", m.id);
    await awardXp("mission", m.xp, { title: m.title });
    toast.success(`+${m.xp} XP`);
    load();
  }

  async function getInsights() {
    setBusy("insights");
    try {
      const summary = `CGPA ${cgpa ? cgpa.toFixed(2) : "unknown"} over ${credits} credits. Attendance ${attendancePct}%. Focus ${focusMin} min in 14 days. ${solved.length} coding problems solved, streak ${codingStreak}d. ${openTasks} open tasks. Goal progress ${goalAvg}%. Level ${lvl.level} with ${totalXp} XP.`;
      setInsights(await insightsFn({ data: { summary } }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const loading = d === null;

  return (
    <DashboardShell>
      <HudLabel>VIHAR // STUDENT COMMAND CENTER</HudLabel>
      <h1 className="font-display text-2xl text-glow-cyan mt-1 mb-6">Command Center</h1>

      {/* Level ring + stat cards */}
      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <HoloPanel className="lg:col-span-1 flex items-center gap-4">
          {loading ? (
            <>
              <Skeleton className="w-28 h-28 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            </>
          ) : (
            <>
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ v: lvl.pct }]} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="v" cornerRadius={12} fill="#22d3ee" background={{ fill: "rgba(34,211,238,0.12)" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0">
                <div className="hud-text text-[10px] text-[oklch(0.7_0.12_220)]">OPERATIVE LEVEL</div>
                <div className="font-display text-3xl text-glow-cyan leading-none mt-1">
                  <Counter value={lvl.level} />
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-sans">
                  {lvl.intoLevel} / {lvl.needed} XP to level {lvl.level + 1}
                </div>
                <div className="hud-text text-[10px] text-[oklch(0.75_0.22_295)] mt-1">TOTAL {totalXp} XP</div>
              </div>
            </>
          )}
        </HoloPanel>

        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat loading={loading} label="STUDY STREAK" value={`${studyStreak}d`} icon={<Flame className="w-4 h-4" />} />
          <Stat loading={loading} label="FOCUS (14D)" value={`${focusMin}m`} icon={<Timer className="w-4 h-4" />} />
          <Stat loading={loading} label="CODING" value={`${solved.length} solved`} icon={<Terminal className="w-4 h-4" />} purple />
          <Stat loading={loading} label="CGPA" value={cgpa ? cgpa.toFixed(2) : "—"} icon={<GraduationCap className="w-4 h-4" />} />
          <Stat loading={loading} label="ATTENDANCE" value={totalClasses ? `${attendancePct}%` : "—"} icon={<Target className="w-4 h-4" />} purple />
          <Stat loading={loading} label="PRODUCTIVITY" value={`${goalAvg}%`} icon={<Zap className="w-4 h-4" />} />
        </div>
      </div>

      {/* Semester health */}
      <HoloPanel glow="purple" className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <div className="hud-text text-[10px] text-[oklch(0.7_0.12_220)]">SEMESTER HEALTH SCORE</div>
            <div className="font-display text-4xl text-glow-purple mt-1">
              {loading ? <Skeleton className="h-9 w-24" /> : <Counter value={health} suffix="%" />}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="h-3 rounded-full bg-[oklch(0.2_0.05_280/0.6)] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[oklch(0.85_0.2_200)] to-[oklch(0.7_0.25_295)]"
                initial={{ width: 0 }}
                animate={{ width: `${health}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 font-sans">
              {health >= 75
                ? "Systems nominal — you're on a strong trajectory."
                : health >= 45
                  ? "Steady. One focused week lifts this score fast."
                  : "Low signal. Start with one mission below — momentum builds quickly."}
            </p>
          </div>
        </div>
      </HoloPanel>

      {/* Missions + insights */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <HoloPanel>
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="hud-text text-xs">Daily missions</h2>
            <HoloButton variant="ghost" onClick={generateMissions} disabled={busy !== null}>
              <Sparkles className="w-3.5 h-3.5" /> {busy === "missions" ? "Generating..." : "New missions"}
            </HoloButton>
          </div>
          {loading || busy === "missions" ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : d.missions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No missions yet today — generate three and start earning XP.</p>
          ) : (
            <ul className="space-y-2">
              {d.missions.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded border border-[oklch(0.7_0.15_220/0.2)] bg-[oklch(0.1_0.04_270/0.4)] transition hover:border-[oklch(0.85_0.2_200/0.5)]"
                >
                  <button
                    onClick={() => !m.done && completeMission(m)}
                    aria-label={m.done ? "Completed" : `Complete ${m.title}`}
                    className={`shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center ${m.done ? "text-[oklch(0.85_0.2_200)]" : "text-[oklch(0.6_0.1_220)] hover:text-glow-cyan"}`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-sans ${m.done ? "line-through opacity-60" : ""}`}>{m.title}</div>
                    {m.detail && <div className="text-xs text-muted-foreground truncate">{m.detail}</div>}
                  </div>
                  <span className="hud-text text-[10px] text-[oklch(0.75_0.22_295)]">+{m.xp} XP</span>
                </li>
              ))}
            </ul>
          )}
        </HoloPanel>

        <HoloPanel glow="purple">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="hud-text text-xs">AI insights</h2>
            <HoloButton variant="purple" onClick={getInsights} disabled={busy !== null}>
              <Sparkles className="w-3.5 h-3.5" /> {busy === "insights" ? "Analyzing..." : "Analyze"}
            </HoloButton>
          </div>
          {busy === "insights" ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-10/12" />
              <Skeleton className="h-3 w-9/12" />
            </div>
          ) : insights ? (
            <div className="chat-prose prose prose-sm prose-invert max-w-none max-h-[36vh] overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{insights}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Get a CGPA prediction, weak-area scan and your next best action based on everything you&apos;ve logged.
            </p>
          )}
        </HoloPanel>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <HoloPanel>
          <h2 className="hud-text text-xs mb-3">Focus minutes (14 days)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={focusSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.15 220 / 0.15)" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0a0e1a", border: "1px solid oklch(0.7 0.15 220 / 0.3)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="minutes" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </HoloPanel>

        <HoloPanel glow="purple">
          <h2 className="hud-text text-xs mb-3">XP by source</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={xpBySource}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.15 220 / 0.15)" />
              <XAxis dataKey="source" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0a0e1a", border: "1px solid oklch(0.7 0.15 220 / 0.3)", borderRadius: 8 }} />
              <Bar dataKey="points" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </HoloPanel>
      </div>

      {/* Heatmap + badges + rewards */}
      <div className="grid lg:grid-cols-3 gap-4">
        <HoloPanel className="lg:col-span-1">
          <h2 className="hud-text text-xs mb-3">Activity heatmap (5 weeks)</h2>
          <div className="grid grid-cols-7 gap-1.5">
            {heat.map((h) => (
              <div
                key={h.day}
                title={`${h.day} · ${h.points} XP`}
                className="aspect-square rounded-[3px] border border-[oklch(0.7_0.15_220/0.15)]"
                style={{ background: `oklch(0.85 0.2 200 / ${h.points === 0 ? 0.05 : Math.min(0.85, 0.15 + h.points / 120)})` }}
              />
            ))}
          </div>
        </HoloPanel>

        <HoloPanel glow="purple">
          <h2 className="hud-text text-xs mb-3 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Achievements
          </h2>
          <ul className="space-y-2">
            {BADGES.map((b) => {
              const unlocked = totalXp >= b.need;
              return (
                <li key={b.code} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                      unlocked ? "bg-[oklch(0.85_0.2_200/0.15)] text-[oklch(0.85_0.2_200)]" : "bg-[oklch(0.2_0.05_280/0.5)] text-[oklch(0.55_0.06_250)]"
                    }`}
                  >
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-sans truncate ${unlocked ? "" : "opacity-60"}`}>{b.title}</div>
                    <div className="hud-text text-[10px] text-[oklch(0.6_0.1_220)]">{unlocked ? "UNLOCKED" : `${b.need - totalXp} XP TO GO`}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </HoloPanel>

        <HoloPanel>
          <h2 className="hud-text text-xs mb-3 flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5" /> Rewards center
          </h2>
          <ul className="space-y-2">
            {REWARDS.map((r) => {
              const unlocked = lvl.level >= r.level;
              return (
                <li key={r.code} className="flex items-center gap-2 p-2 rounded border border-[oklch(0.7_0.15_220/0.2)]">
                  <span className={`text-sm font-sans flex-1 min-w-0 truncate ${unlocked ? "" : "opacity-60"}`}>{r.title}</span>
                  <span className="hud-text text-[10px] text-[oklch(0.75_0.22_295)]">{unlocked ? "READY" : `LVL ${r.level}`}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/arena">
              <HoloButton variant="ghost">Earn XP in Arena</HoloButton>
            </Link>
          </div>
        </HoloPanel>
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value, icon, purple, loading }: { label: string; value: string; icon: React.ReactNode; purple?: boolean; loading?: boolean }) {
  return (
    <HoloPanel glow={purple ? "purple" : "cyan"} className="p-3">
      <div className="hud-text text-[10px] text-[oklch(0.7_0.12_220)] flex items-center gap-1.5">
        {icon} {label}
      </div>
      {loading ? (
        <Skeleton className="h-6 w-16 mt-2" />
      ) : (
        <div className={`font-display text-xl mt-1 ${purple ? "text-glow-purple" : "text-glow-cyan"}`}>{value}</div>
      )}
    </HoloPanel>
  );
}

/** Animated count-up for hero numbers. */
function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const from = ref.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 600);
      const cur = Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      setN(cur);
      ref.current = cur;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <>
      {n}
      {suffix}
    </>
  );
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function streakOf(dates: string[]) {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
