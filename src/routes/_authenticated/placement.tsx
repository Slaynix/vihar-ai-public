import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { interviewQuestions } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/placement")({
  head: () => ({ meta: [{ title: "VIHAR // Placement Hub" }] }),
  component: PlacementPage,
});

const COMPANIES = ["Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix", "Stripe", "Uber", "Goldman Sachs", "Adobe", "Salesforce", "OpenAI"];

function PlacementPage() {
  const [company, setCompany] = useState("Google");
  const [role, setRole] = useState("SDE Intern");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const fn = useServerFn(interviewQuestions);

  async function gen() {
    setLoading(true);
    try { setOut(await fn({ data: { company, role } })); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <DashboardShell>
      <HudLabel>VIHAR // PLACEMENT HUB</HudLabel>
      <h1 className="font-display text-2xl text-glow-cyan mt-1 mb-6">Placement Hub</h1>
      <div className="grid lg:grid-cols-3 gap-4">
        <HoloPanel className="lg:col-span-1">
          <h2 className="hud-text text-xs mb-3">Target companies</h2>
          <div className="flex flex-wrap gap-2">
            {COMPANIES.map((c) => (
              <button key={c} onClick={() => setCompany(c)} className={`text-xs px-3 py-1.5 rounded-full border ${company === c ? "border-[oklch(0.85_0.2_200/0.7)] text-glow-cyan bg-[oklch(0.85_0.2_200/0.1)]" : "border-[oklch(0.7_0.15_220/0.3)] text-muted-foreground hover:border-[oklch(0.85_0.2_200/0.5)]"}`}>{c}</button>
            ))}
          </div>
        </HoloPanel>
        <HoloPanel glow="purple" className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" className="flex-1 px-3 py-2 rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
            <HoloButton variant="purple" onClick={gen} disabled={loading}><Sparkles className="w-3.5 h-3.5" /> {loading ? "Forging..." : `Generate for ${company}`}</HoloButton>
          </div>
          {out ? (
            <div className="prose prose-sm prose-invert max-w-none max-h-[55vh] overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{out}</ReactMarkdown>
            </div>
          ) : <p className="text-xs text-muted-foreground">Select a company and generate likely interview questions.</p>}
        </HoloPanel>
      </div>
    </DashboardShell>
  );
}
