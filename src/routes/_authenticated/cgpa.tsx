import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { Skeleton } from "@/components/holo/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { awardXp } from "@/lib/xp";
import { toast } from "sonner";
import { Plus, Trash2, GraduationCap, Target, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_authenticated/cgpa")({
  head: () => ({
    meta: [
      { title: "VIHAR // CGPA Predictor" },
      { name: "description", content: "Calculate SGPA and CGPA, plan target grades and visualise semester performance." },
      { property: "og:title", content: "VIHAR // CGPA Predictor" },
      { property: "og:description", content: "SGPA & CGPA calculator with target planner and semester analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CgpaPage,
});

type Sem = { id: string; sem_no: number; label: string | null };
type Course = { id: string; semester_id: string; name: string; credits: number; grade_point: number };

function CgpaPage() {
  const [sems, setSems] = useState<Sem[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSem, setActiveSem] = useState<string | null>(null);
  const [cname, setCname] = useState("");
  const [credits, setCredits] = useState("3");
  const [gp, setGp] = useState("9");
  const [target, setTarget] = useState("8.5");
  const [remainingSems, setRemainingSems] = useState("2");

  async function load() {
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from("semesters" as never).select("id, sem_no, label").order("sem_no") as unknown as Promise<{ data: Sem[] | null }>,
      supabase.from("semester_courses" as never).select("id, semester_id, name, credits, grade_point") as unknown as Promise<{ data: Course[] | null }>,
    ]);
    setSems(s || []);
    setCourses(c || []);
    setActiveSem((prev) => prev ?? (s && s[0] ? s[0].id : null));
  }
  useEffect(() => {
    load();
  }, []);

  async function addSem() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const next = ((sems || []).reduce((m, s) => Math.max(m, s.sem_no), 0) || 0) + 1;
    const { data } = (await supabase
      .from("semesters" as never)
      .insert({ user_id: u.user.id, sem_no: next, label: `Semester ${next}` } as never)
      .select("id, sem_no, label")
      .single()) as unknown as { data: Sem | null };
    if (data) setActiveSem(data.id);
    load();
  }

  async function addCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSem || !cname.trim()) return toast.error("Add a semester and course name first.");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("semester_courses" as never).insert({
      user_id: u.user.id,
      semester_id: activeSem,
      name: cname.trim(),
      credits: Number(credits) || 0,
      grade_point: Number(gp) || 0,
    } as never);
    awardXp("cgpa", 5, { course: cname.trim() });
    setCname("");
    load();
  }

  async function removeCourse(id: string) {
    await supabase.from("semester_courses" as never).delete().eq("id", id);
    load();
  }

  const semStats = useMemo(
    () =>
      (sems || []).map((s) => {
        const list = courses.filter((c) => c.semester_id === s.id);
        const cr = list.reduce((sum, c) => sum + Number(c.credits), 0);
        const pts = list.reduce((sum, c) => sum + Number(c.credits) * Number(c.grade_point), 0);
        return { ...s, credits: cr, sgpa: cr ? pts / cr : 0, points: pts, count: list.length };
      }),
    [sems, courses],
  );

  const totalCredits = semStats.reduce((s, x) => s + x.credits, 0);
  const cgpa = totalCredits ? semStats.reduce((s, x) => s + x.points, 0) / totalCredits : 0;

  const required = useMemo(() => {
    const t = Number(target) || 0;
    const n = Math.max(1, Number(remainingSems) || 1);
    const avgCredits = totalCredits && semStats.length ? totalCredits / semStats.length : 22;
    const future = avgCredits * n;
    const need = (t * (totalCredits + future) - cgpa * totalCredits) / future;
    return need;
  }, [target, remainingSems, totalCredits, cgpa, semStats.length]);

  const chart = semStats.filter((s) => s.count > 0).map((s) => ({ sem: `S${s.sem_no}`, sgpa: Number(s.sgpa.toFixed(2)) }));
  const activeCourses = courses.filter((c) => c.semester_id === activeSem);

  return (
    <DashboardShell>
      <HudLabel>VIHAR // CGPA PREDICTOR</HudLabel>
      <h1 className="font-display text-2xl text-glow-cyan mt-1 mb-6">CGPA Predictor</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Tile label="CGPA" value={cgpa ? cgpa.toFixed(2) : "—"} icon={<GraduationCap className="w-4 h-4" />} />
        <Tile label="CREDITS" value={String(totalCredits)} icon={<TrendingUp className="w-4 h-4" />} />
        <Tile label="SEMESTERS" value={String(semStats.filter((s) => s.count > 0).length)} icon={<GraduationCap className="w-4 h-4" />} />
        <Tile
          label="NEED / SEM"
          value={totalCredits ? (required > 10 ? ">10" : required < 0 ? "0.00" : required.toFixed(2)) : "—"}
          icon={<Target className="w-4 h-4" />}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <HoloPanel>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              value={activeSem ?? ""}
              onChange={(e) => setActiveSem(e.target.value || null)}
              className="px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm"
            >
              {(sems || []).length === 0 && <option value="">No semesters</option>}
              {(sems || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label || `Semester ${s.sem_no}`}
                </option>
              ))}
            </select>
            <HoloButton variant="ghost" onClick={addSem}>
              <Plus className="w-3.5 h-3.5" /> Semester
            </HoloButton>
          </div>

          <form onSubmit={addCourse} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <input value={cname} onChange={(e) => setCname(e.target.value)} placeholder="Course" className="col-span-2 sm:col-span-1 px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
            <input type="number" step="0.5" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="Credits" className="px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
            <input type="number" step="0.1" max="10" value={gp} onChange={(e) => setGp(e.target.value)} placeholder="Grade pt" className="px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
            <HoloButton type="submit">
              <Plus className="w-3.5 h-3.5" /> Add
            </HoloButton>
          </form>

          {sems === null ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : activeCourses.length === 0 ? (
            <p className="text-xs text-muted-foreground">Add your courses to compute SGPA for this semester.</p>
          ) : (
            <ul className="space-y-2 max-h-[40vh] overflow-y-auto">
              {activeCourses.map((c) => (
                <li key={c.id} className="flex items-center gap-2 p-2.5 rounded border border-[oklch(0.7_0.15_220/0.2)] bg-[oklch(0.1_0.04_270/0.4)]">
                  <span className="text-sm font-sans flex-1 min-w-0 truncate">{c.name}</span>
                  <span className="hud-text text-[10px] text-[oklch(0.6_0.1_220)]">{Number(c.credits)} cr</span>
                  <span className="font-display text-sm text-glow-cyan">{Number(c.grade_point)}</span>
                  <button onClick={() => removeCourse(c.id)} aria-label="Remove course" className="text-[oklch(0.7_0.18_25)] min-h-[44px] px-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 hud-text text-[10px] text-[oklch(0.7_0.12_220)]">
            SGPA THIS SEMESTER ·{" "}
            <span className="font-display text-base text-glow-purple">
              {(semStats.find((s) => s.id === activeSem)?.sgpa ?? 0).toFixed(2)}
            </span>
          </div>
        </HoloPanel>

        <div className="space-y-4">
          <HoloPanel glow="purple">
            <h2 className="hud-text text-xs mb-3">Target planner</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">
                Target CGPA
                <input type="number" step="0.1" max="10" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
              </label>
              <label className="text-xs text-muted-foreground">
                Semesters left
                <input type="number" min="1" value={remainingSems} onChange={(e) => setRemainingSems(e.target.value)} className="mt-1 w-full px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
              </label>
            </div>
            <p className="mt-3 text-sm font-sans text-muted-foreground">
              {totalCredits === 0
                ? "Add at least one graded semester to unlock the prediction."
                : required > 10
                  ? `A ${target} CGPA isn't reachable in ${remainingSems} semester(s) — aim for ${(cgpa + 0.3).toFixed(2)} instead.`
                  : `You need an average SGPA of ${Math.max(0, required).toFixed(2)} over the next ${remainingSems} semester(s).`}
            </p>
          </HoloPanel>

          <HoloPanel>
            <h2 className="hud-text text-xs mb-3">Semester progression</h2>
            {chart.length === 0 ? (
              <p className="text-xs text-muted-foreground">Your SGPA curve appears here once a semester is graded.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.7 0.15 220 / 0.15)" />
                  <XAxis dataKey="sem" stroke="#94a3b8" fontSize={11} />
                  <YAxis domain={[0, 10]} stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#0a0e1a", border: "1px solid oklch(0.7 0.15 220 / 0.3)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="sgpa" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </HoloPanel>
        </div>
      </div>
    </DashboardShell>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <HoloPanel className="p-3">
      <div className="hud-text text-[10px] text-[oklch(0.7_0.12_220)] flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="font-display text-xl text-glow-cyan mt-1">{value}</div>
    </HoloPanel>
  );
}
