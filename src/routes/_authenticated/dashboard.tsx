import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useSignOut } from "@/lib/use-sign-out";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { Skeleton } from "@/components/holo/Skeleton";
import {
  Brain, Calendar, ClipboardCheck, FileText, Code2, Briefcase,
  Route as RouteIcon, Search, Terminal, GraduationCap, Library, BarChart3, Database,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "VIHAR // Command Center" }] }),
  component: Dashboard,
});

const MODULES = [
  { to: "/mentor", label: "AI Mentor", desc: "Holographic AI conversations", icon: Brain, glow: "cyan" as const },
  { to: "/memory", label: "Memory Center", desc: "Your AI second brain", icon: Database, glow: "purple" as const },
  { to: "/planner", label: "Study Planner", desc: "Smart auto-planned weeks", icon: Calendar, glow: "cyan" as const },
  { to: "/attendance", label: "Attendance", desc: "Bunk calculator + tracker", icon: ClipboardCheck, glow: "purple" as const },
  { to: "/notes", label: "AI Notes", desc: "Generate structured notes", icon: FileText, glow: "cyan" as const },
  { to: "/code", label: "Code Assistant", desc: "Explain · fix · optimize", icon: Code2, glow: "purple" as const },
  { to: "/placement", label: "Placement Hub", desc: "Interview question forge", icon: Briefcase, glow: "cyan" as const },
  { to: "/roadmap", label: "Career Roadmap", desc: "Goal → step-by-step path", icon: RouteIcon, glow: "purple" as const },
  { to: "/internships", label: "Internship Finder", desc: "AI-matched opportunities", icon: Search, glow: "cyan" as const },
  { to: "/arena", label: "Coding Arena", desc: "Daily coding • AI hints", icon: Terminal, glow: "purple" as const },
  { to: "/cgpa", label: "CGPA Predictor", desc: "GPA calculator • Target planner", icon: GraduationCap, glow: "cyan" as const },
  { to: "/resources", label: "Resource Hub", desc: "Notes • Docs • Courses", icon: Library, glow: "purple" as const },
  { to: "/analytics", label: "Analytics", desc: "Insights across modules", icon: BarChart3, glow: "cyan" as const },
] as const;


function Dashboard() {
  const signOut = useSignOut();
  const [name, setName] = useState<string | null>(null);
  const [clock, setClock] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { name?: string } | undefined;
      setName(meta?.name || data.user?.email?.split("@")[0] || "Operative");
    });
    const t = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);


  return (
    <DashboardShell>
      {/* Welcome bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3"
      >
        <div className="min-w-0">
          <HudLabel>VIHAR // COMMAND CENTER</HudLabel>
          {name === null ? (
            <div className="mt-2 space-y-2">
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl sm:text-4xl mt-1 text-glow-cyan break-words">
                Welcome back, <span className="text-glow-purple">{name}</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-sans">All systems nominal. Select a module to engage.</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 hud-text text-xs text-[oklch(0.7_0.12_220)]">
          <span>{clock}</span>
          <button onClick={signOut} className="hover:text-glow-cyan min-h-[44px] px-1">Sign out →</button>
        </div>
      </motion.div>


      {/* Grid floor BG */}
      <div className="absolute inset-x-0 top-32 bottom-0 grid-floor opacity-30 pointer-events-none" aria-hidden />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative">
        {MODULES.map((m, i) => (
          <motion.div
            key={m.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.015 }}
          >
            <Link to={m.to} className="block group">
              <HoloPanel
                glow={m.glow}
                className="scanline cursor-pointer transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_0_36px_oklch(0.85_0.2_200/0.5)] h-full"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-md ${m.glow === "cyan" ? "bg-[oklch(0.85_0.2_200/0.12)] text-[oklch(0.85_0.2_200)]" : "bg-[oklch(0.65_0.25_295/0.12)] text-[oklch(0.75_0.22_295)]"}`}>
                    <m.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="hud-text text-[10px] text-[oklch(0.7_0.12_220)]">MODULE</div>
                    <div className="font-display text-base mt-0.5">{m.label}</div>
                    <div className="text-xs text-muted-foreground mt-1 font-sans">{m.desc}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-[10px] hud-text text-[oklch(0.6_0.1_220)]">
                  <span>STATUS · READY</span>
                  <span className="group-hover:text-glow-cyan">ENGAGE →</span>
                </div>
              </HoloPanel>
            </Link>
          </motion.div>
        ))}
      </div>
    </DashboardShell>
  );
}
