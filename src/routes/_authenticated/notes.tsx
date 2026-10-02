import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { supabase } from "@/integrations/supabase/client";
import { generateNotes } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { SpeakButton } from "@/components/holo/ReadAloudPlayer";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Sparkles, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "VIHAR // AI Notes" }] }),
  component: NotesPage,
});

type Note = { id: string; topic: string; content: string; created_at: string };

function NotesPage() {
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const gen = useServerFn(generateNotes);

  async function load() {
    const { data } = await supabase.from("notes" as never).select("*").order("created_at", { ascending: false }) as unknown as { data: Note[] | null };
    setNotes(data || []);
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const text = await gen({ data: { prompt: topic, model: "flash" } });
      setContent(text);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  async function save() {
    if (!topic.trim() || !content.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("notes" as never).insert({ user_id: u.user.id, topic, content } as never);
    toast.success("Notes archived.");
    setTopic(""); setContent("");
    load();
  }

  async function del(id: string) { await supabase.from("notes" as never).delete().eq("id", id); load(); }

  return (
    <DashboardShell>
      <HudLabel>VIHAR // AI NOTES</HudLabel>
      <h1 className="font-display text-2xl text-glow-cyan mt-1 mb-6">AI Notes Generator</h1>

      <div className="grid lg:grid-cols-2 gap-4">
        <HoloPanel>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (e.g. 'Operating Systems: Process scheduling')" className="w-full px-3 py-2 rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm mb-2" />
          <div className="flex gap-2 mb-3">
            <HoloButton onClick={generate} disabled={loading}><Sparkles className="w-3.5 h-3.5" /> {loading ? "Synthesizing..." : "Generate"}</HoloButton>
            <HoloButton variant="purple" onClick={save} disabled={!content}><Save className="w-3.5 h-3.5" /> Save</HoloButton>
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Generated notes will appear here, editable..." className="w-full h-[55vh] px-3 py-2 rounded bg-[oklch(0.08_0.04_280/0.6)] border border-[oklch(0.7_0.15_220/0.25)] text-sm font-mono resize-none" />
        </HoloPanel>

        <HoloPanel glow="purple">
          <h2 className="hud-text text-xs mb-3">Archive</h2>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes archived yet.</p>}
            {notes.map((n) => (
              <details key={n.id} className="p-3 rounded border border-[oklch(0.7_0.15_220/0.2)] bg-[oklch(0.1_0.04_270/0.4)]">
                <summary className="cursor-pointer flex justify-between items-center text-sm font-sans">
                  <span>{n.topic}</span>
                  <button onClick={(e) => { e.preventDefault(); del(n.id); }} className="text-[oklch(0.7_0.18_25)]"><Trash2 className="w-3.5 h-3.5" /></button>
                </summary>
                <div className="prose prose-sm prose-invert max-w-none mt-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.content}</ReactMarkdown>
                </div>
                <SpeakButton id={n.id} text={n.content} label={n.topic} />
              </details>
            ))}
          </div>
        </HoloPanel>
      </div>
    </DashboardShell>
  );
}
