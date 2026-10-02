import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { explainCode } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { toast } from "sonner";
import { Sparkles, Wrench, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/code")({
  head: () => ({ meta: [{ title: "VIHAR // Code Assistant" }] }),
  component: CodePage,
});

function CodePage() {
  const [code, setCode] = useState("// Paste your code here\nfunction add(a, b) { return a + b }\n");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const fn = useServerFn(explainCode);

  async function run(mode: "explain" | "fix" | "optimize") {
    if (!code.trim()) return;
    setLoading(true);
    try { setOut(await fn({ data: { code, mode } })); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <DashboardShell>
      <HudLabel>VIHAR // CODE ASSISTANT</HudLabel>
      <h1 className="font-display text-2xl text-glow-cyan mt-1 mb-6">Coding Assistant</h1>
      <div className="grid lg:grid-cols-2 gap-4">
        <HoloPanel>
          <textarea value={code} onChange={(e) => setCode(e.target.value)} className="w-full h-[55vh] px-3 py-2 rounded bg-[oklch(0.06_0.04_280/0.7)] border border-[oklch(0.7_0.15_220/0.25)] text-sm font-mono resize-none" spellCheck={false} />
          <div className="mt-3 flex flex-wrap gap-2">
            <HoloButton onClick={() => run("explain")} disabled={loading}><Sparkles className="w-3.5 h-3.5" /> Explain</HoloButton>
            <HoloButton variant="purple" onClick={() => run("fix")} disabled={loading}><Wrench className="w-3.5 h-3.5" /> Fix</HoloButton>
            <HoloButton variant="ghost" onClick={() => run("optimize")} disabled={loading}><Zap className="w-3.5 h-3.5" /> Optimize</HoloButton>
          </div>
        </HoloPanel>
        <HoloPanel glow="purple" className="min-h-[60vh]">
          <h2 className="hud-text text-xs mb-3">VIHAR analysis</h2>
          {loading && <p className="text-xs text-muted-foreground">Analyzing...</p>}
          {out ? (
            <div className="prose prose-sm prose-invert max-w-none prose-pre:bg-[oklch(0.05_0.04_280/0.8)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{out}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Run a command above.</p>
          )}
        </HoloPanel>
      </div>
    </DashboardShell>
  );
}
