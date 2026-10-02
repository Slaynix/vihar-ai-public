import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { generateRoadmap } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Sparkles, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/roadmap")({
  head: () => ({ meta: [{ title: "VIHAR // Career Roadmap" }] }),
  component: RoadmapPage,
});

type Saved = { id: string; goal: string; steps: { content: string } };

function RoadmapPage() {
  const [goal, setGoal] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const fn = useServerFn(generateRoadmap);

  async function load() {
    const { data } = await supabase.from("roadmaps" as never).select("id, goal, steps").order("created_at", { ascending: false }) as unknown as { data: Saved[] | null };
    setSaved(data || []);
  }
  useEffect(() => { load(); }, []);

  async function gen() {
    if (!goal.trim()) return;
    setLoading(true);
    try { setOut(await fn({ data: { prompt: goal, model: "flash" } })); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  async function save() {
    if (!out) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("roadmaps" as never).insert({ user_id: u.user.id, goal, steps: { content: out } } as never);
    toast.success("Roadmap archived.");
    load();
  }

  return (
    <DashboardShell>
      <HudLabel>VIHAR // CAREER ROADMAP</HudLabel>
      <h1 className="font-display text-2xl text-glow-cyan mt-1 mb-6">Career Roadmap Generator</h1>
      <HoloPanel className="mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal (e.g. Become a Machine Learning Engineer in 12 months)" className="flex-1 px-3 py-2 rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
          <HoloButton onClick={gen} disabled={loading}><Sparkles className="w-3.5 h-3.5" /> {loading ? "Charting..." : "Generate"}</HoloButton>
          {out && <HoloButton variant="purple" onClick={save}><Save className="w-3.5 h-3.5" /> Save</HoloButton>}
        </div>
      </HoloPanel>

      {out && (
        <HoloPanel glow="purple" className="mb-4">
          <div className="prose prose-sm prose-invert max-w-none max-h-[55vh] overflow-y-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{out}</ReactMarkdown>
          </div>
        </HoloPanel>
      )}

      <h2 className="hud-text text-xs mb-2">Archive</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {saved.map((s) => (
          <HoloPanel key={s.id}>
            <h3 className="font-display text-sm text-glow-cyan mb-2">{s.goal}</h3>
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">View roadmap</summary>
              <div className="prose prose-sm prose-invert max-w-none mt-2 max-h-80 overflow-y-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.steps?.content || ""}</ReactMarkdown>
              </div>
            </details>
          </HoloPanel>
        ))}
      </div>
    </DashboardShell>
  );
}
