import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { supabase } from "@/integrations/supabase/client";
import { planMyWeek } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, Check, Clock3, CalendarDays, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({ meta: [
    { title: "VIHAR // Student Plan" },
    { name: "description", content: "A saved daily and weekly study plan." },
    { property: "og:title", content: "VIHAR Student Plan" },
    { property: "og:description", content: "Plan study sessions, coding practice, and project work." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PlannerPage,
});

type Task = { id: string; title: string; notes: string | null; due_date: string | null; priority: "low" | "medium" | "high"; status: "open" | "done"; category: string; duration_min: number };
type Category = "study" | "coding" | "project" | "placement" | "revision" | "break";
const categories: { value: Category; label: string }[] = [
  { value: "study", label: "Study session" }, { value: "coding", label: "Coding practice" },
  { value: "project", label: "Project work" }, { value: "placement", label: "Placement prep" },
  { value: "revision", label: "Revision" }, { value: "break", label: "Break" },
];
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = () => isoDate(new Date());

function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState(today());
  const [duration, setDuration] = useState(30);
  const [category, setCategory] = useState<Category>("study");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [aiPlan, setAiPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const planFn = useServerFn(planMyWeek);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("tasks").select("id,title,notes,due_date,priority,status,category,duration_min").order("due_date", { ascending: true });
    if (error) toast.error("Your saved plan could not be loaded.");
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const weekDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date: isoDate(date), day: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date), dayNumber: date.getDate() };
    });
  }, []);
  const todaysTasks = tasks.filter((task) => task.due_date === today());
  const weekTasks = tasks.filter((task) => task.due_date && task.due_date >= weekDays[0].date && task.due_date <= weekDays[6].date);
  const minutesPlanned = todaysTasks.filter((task) => task.status !== "done").reduce((sum, task) => sum + task.duration_min, 0);
  const recommendation = useMemo(() => {
    const overdue = tasks.find((task) => task.status !== "done" && task.due_date && task.due_date < today());
    if (overdue) return `Reschedule “${overdue.title}” — it’s past its due date.`;
    const top = todaysTasks.find((task) => task.status !== "done" && task.priority === "high");
    if (top) return `Start with “${top.title}”, your highest-priority task today.`;
    if (todaysTasks.length === 0) return "Add one focused session to give today a clear first step.";
    return "Your top priorities are in place. Keep sessions focused and take breaks.";
  }, [tasks, todaysTasks]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const optimistic: Task = { id: crypto.randomUUID(), title: title.trim(), notes: notes.trim() || null, due_date: due || null, priority, status: "open", category, duration_min: duration };
    setTasks((current) => [...current, optimistic].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")));
    setTitle(""); setNotes("");
    const { error } = await supabase.from("tasks").insert({ user_id: auth.user.id, title: optimistic.title, notes: optimistic.notes, due_date: optimistic.due_date, priority, category, duration_min: duration });
    if (error) { setTasks((current) => current.filter((task) => task.id !== optimistic.id)); toast.error("Could not save that session."); }
    else void load();
  }

  async function toggle(task: Task) {
    const nextStatus = task.status === "done" ? "open" : "done";
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
    const { error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", task.id);
    if (error) { toast.error("Progress couldn’t be saved."); void load(); }
  }
  async function remove(id: string) {
    const before = tasks;
    setTasks((current) => current.filter((task) => task.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { setTasks(before); toast.error("Could not remove that session."); }
  }
  async function autoPlan() {
    setGenerating(true);
    try {
      const context = tasks.map((task) => `- ${task.title}; ${task.category}; ${task.duration_min} minutes; ${task.due_date ?? "unscheduled"}; ${task.priority}; ${task.status}`).join("\n");
      setAiPlan(await planFn({ data: { context: context || "No tasks saved yet; plan a balanced student week." } }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "The plan could not be generated."); }
    finally { setGenerating(false); }
  }

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><HudLabel>VIHAR // YOUR PLAN</HudLabel><h1 className="mt-1 text-2xl text-glow-cyan">Make progress, one session at a time.</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">A living plan for classes, practice, projects, and the next step in your career.</p></div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4 text-primary" /><span>{Math.floor(minutesPlanned / 60)}h {minutesPlanned % 60}m planned today</span></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.8fr)]">
        <div className="space-y-4">
          <HoloPanel>
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg">Today</h2><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p></div><span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{todaysTasks.filter((task) => task.status === "done").length}/{todaysTasks.length} complete</span></div>
            {loading ? <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-14 animate-pulse rounded-md bg-muted" />)}</div> : todaysTasks.length ? <ul className="space-y-2">{todaysTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={toggle} onRemove={remove} />)}</ul> : <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">Nothing scheduled today yet. Add a study block or move a task here.</p>}
          </HoloPanel>

          <HoloPanel glow="none">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg">This week</h2><p className="mt-1 text-xs text-muted-foreground">Monday to Sunday · {weekTasks.filter((task) => task.status === "done").length} sessions completed</p></div><CalendarDays className="h-5 w-5 text-primary" /></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{weekDays.map((day) => { const dayTasks = weekTasks.filter((task) => task.due_date === day.date); const done = dayTasks.filter((task) => task.status === "done").length; return <div key={day.date} className={cn("min-h-24 rounded-md border p-2.5", day.date === today() ? "border-primary/60 bg-primary/10" : "border-border bg-background/40")}><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{day.day}</span><span className="font-medium">{day.dayNumber}</span></div><div className="mt-2 space-y-1">{dayTasks.length ? dayTasks.slice(0, 3).map((task) => <div key={task.id} className={cn("truncate rounded px-1.5 py-1 text-[11px]", task.status === "done" ? "bg-primary/10 text-muted-foreground line-through" : "bg-muted text-foreground")}>{task.title}</div>) : <span className="text-[11px] text-muted-foreground/70">—</span>}</div>{dayTasks.length > 3 && <div className="mt-1 text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</div>}{dayTasks.length > 0 && <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(done / dayTasks.length) * 100}%` }} /></div>}</div>; })}</div>
          </HoloPanel>

          <HoloPanel glow="purple">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg">Build a balanced week</h2><p className="mt-1 text-xs text-muted-foreground">Use your saved tasks to draft a realistic study rhythm.</p></div><HoloButton variant="purple" onClick={autoPlan} disabled={generating}><Sparkles className="h-4 w-4" />{generating ? "Planning…" : "Build my week"}</HoloButton></div>
            {aiPlan ? <div className="prose prose-sm prose-invert max-h-[45vh] max-w-none overflow-y-auto"><ReactMarkdown remarkPlugins={[remarkGfm]}>{aiPlan}</ReactMarkdown></div> : <p className="text-sm text-muted-foreground">Your generated weekly outline appears here alongside your saved schedule.</p>}
          </HoloPanel>
        </div>

        <div className="space-y-4">
          <HoloPanel glow="purple"><HudLabel>SMART NUDGE</HudLabel><p className="mt-3 text-base leading-relaxed">{recommendation}</p><p className="mt-2 text-xs text-muted-foreground">Based on your saved deadlines and priorities.</p></HoloPanel>
          <HoloPanel glow="none">
            <h2 className="mb-1 text-lg">Add to your plan</h2><p className="mb-4 text-xs text-muted-foreground">Save a session to see it in your day and week.</p>
            <form onSubmit={add} className="space-y-3">
              <label className="sr-only" htmlFor="session-title">Session name</label><input id="session-title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Review data structures" className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm" />
              <label className="sr-only" htmlFor="session-notes">Session description</label><textarea id="session-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What will you work on? (optional)" rows={2} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm" />
              <div className="grid grid-cols-2 gap-2"><label className="text-xs text-muted-foreground">Session type<select value={category} onChange={(event) => setCategory(event.target.value as Category)} className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground">{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="text-xs text-muted-foreground">Time<select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground">{[15, 25, 30, 45, 60, 90, 120].map((min) => <option key={min} value={min}>{min} min</option>)}</select></label></div>
              <div className="grid grid-cols-2 gap-2"><label className="text-xs text-muted-foreground">Due date<input type="date" value={due} onChange={(event) => setDue(event.target.value)} className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label><label className="text-xs text-muted-foreground">Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Task["priority"])} className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
              <HoloButton type="submit" className="w-full"><Plus className="h-4 w-4" />Add session</HoloButton>
            </form>
          </HoloPanel>
          <HoloPanel glow="none"><HudLabel>CAREER DIRECTION</HudLabel><p className="mt-2 text-sm text-muted-foreground">Keep your saved goal and next steps in your career roadmap.</p><a href="/roadmap" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline">Open career roadmap <ArrowUpRight className="h-4 w-4" /></a></HoloPanel>
        </div>
      </div>
    </DashboardShell>
  );
}

function TaskRow({ task, onToggle, onRemove }: { task: Task; onToggle: (task: Task) => void; onRemove: (id: string) => void }) {
  return <li className={cn("flex min-w-0 items-center gap-3 rounded-md border border-border bg-background/40 p-3", task.status === "done" && "opacity-65")}>
    <button type="button" aria-label={task.status === "done" ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} onClick={() => onToggle(task)} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md border", task.status === "done" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary")}><Check className="h-4 w-4" /></button>
    <div className="min-w-0 flex-1"><div className={cn("truncate text-sm font-medium", task.status === "done" && "line-through")}>{task.title}</div><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{categories.find((entry) => entry.value === task.category)?.label ?? task.category}</span><span>·</span><span>{task.duration_min} min</span><span>·</span><span className={task.priority === "high" ? "text-destructive" : ""}>{task.priority}</span>{task.notes && <span className="basis-full truncate">{task.notes}</span>}</div></div>
    <button type="button" aria-label={`Remove ${task.title}`} onClick={() => onRemove(task.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
  </li>;
}