import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Minus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "VIHAR // Attendance" }] }),
  component: AttendancePage,
});

type Subject = { id: string; name: string; required_pct: number; total_classes: number; attended: number };

function AttendancePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [req, setReq] = useState(75);

  async function load() {
    const { data } = await supabase.from("subjects" as never).select("*").order("name") as unknown as { data: Subject[] | null };
    setSubjects(data || []);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("subjects" as never).insert({ user_id: u.user.id, name, required_pct: req } as never);
    setName(""); load();
  }

  async function update(s: Subject, attendedDelta: number, totalDelta: number) {
    await supabase.from("subjects" as never).update({
      attended: Math.max(0, s.attended + attendedDelta),
      total_classes: Math.max(0, s.total_classes + totalDelta),
    } as never).eq("id", s.id);
    load();
  }

  async function remove(id: string) { await supabase.from("subjects" as never).delete().eq("id", id); load(); }

  return (
    <DashboardShell>
      <HudLabel>VIHAR // ATTENDANCE</HudLabel>
      <h1 className="font-display text-2xl text-glow-cyan mt-1 mb-6">Attendance Manager</h1>

      <HoloPanel className="mb-4">
        <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Subject name" className="flex-1 px-3 py-2 rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
          <input type="number" value={req} onChange={(e) => setReq(Number(e.target.value))} min={50} max={100} className="w-24 px-3 py-2 rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
          <HoloButton type="submit"><Plus className="w-4 h-4" /> Add subject</HoloButton>
        </form>
      </HoloPanel>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.length === 0 && <p className="text-xs text-muted-foreground col-span-full">Add your first subject above.</p>}
        {subjects.map((s) => {
          const pct = s.total_classes === 0 ? 0 : (s.attended / s.total_classes) * 100;
          const safe = pct >= s.required_pct;
          // can skip how many more in a row keeping required pct
          const canSkip = Math.max(0, Math.floor((s.attended * 100) / s.required_pct) - s.total_classes);
          const mustAttend = (() => {
            if (safe) return 0;
            const needed = Math.ceil((s.required_pct * s.total_classes - 100 * s.attended) / (100 - s.required_pct));
            return Math.max(0, needed);
          })();
          return (
            <HoloPanel key={s.id} glow={safe ? "cyan" : "purple"}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-display text-lg">{s.name}</h3>
                <button onClick={() => remove(s.id)} className="text-[oklch(0.7_0.18_25)]"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="text-3xl font-display text-glow-cyan">{pct.toFixed(1)}%</div>
              <div className="hud-text text-[10px] text-[oklch(0.7_0.12_220)] mt-1">
                {s.attended}/{s.total_classes} · need {s.required_pct}%
              </div>
              <div className="w-full h-1.5 bg-[oklch(0.2_0.05_270)] rounded mt-3 overflow-hidden">
                <div className={`h-full ${safe ? "bg-[oklch(0.85_0.2_200)]" : "bg-[oklch(0.7_0.2_25)]"}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="text-xs text-muted-foreground mt-3 font-sans">
                {safe ? `You can skip the next ${canSkip} classes.` : `Attend the next ${mustAttend} classes to recover.`}
              </div>
              <div className="flex gap-2 mt-4">
                <HoloButton onClick={() => update(s, 1, 1)} className="!px-3 !py-1.5 text-[10px]">+ Present</HoloButton>
                <HoloButton variant="purple" onClick={() => update(s, 0, 1)} className="!px-3 !py-1.5 text-[10px]">+ Absent</HoloButton>
                <button onClick={() => update(s, -1, -1)} className="ml-auto p-1.5 rounded border border-[oklch(0.7_0.15_220/0.3)]"><Minus className="w-3 h-3" /></button>
              </div>
            </HoloPanel>
          );
        })}
      </div>
    </DashboardShell>
  );
}
