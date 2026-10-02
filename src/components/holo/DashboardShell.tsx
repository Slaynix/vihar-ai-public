import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { useSignOut } from "@/lib/use-sign-out";
import { Home, Brain, Calendar, LogOut, LayoutGrid, Database, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReadAloudBar } from "@/components/holo/ReadAloudPlayer";

const MOBILE_NAV = [
  { to: "/dashboard", label: "OS", icon: LayoutGrid },
  { to: "/mentor", label: "Mentor", icon: Brain },
  { to: "/memory", label: "Memory", icon: Database },
  { to: "/planner", label: "Plan", icon: Calendar },
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const signOut = useSignOut();

  return (
    <div className="relative min-h-screen w-full">
      {/* Top HUD */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/90 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-display text-base text-foreground">VIHAR<span className="text-primary">.AI</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavBtn to="/dashboard" current={pathname}>Home</NavBtn>
            <NavBtn to="/mentor" current={pathname}>Mentor</NavBtn>
            <NavBtn to="/memory" current={pathname}>Memory</NavBtn>
            <NavBtn to="/planner" current={pathname}>Plan</NavBtn>
            <NavBtn to="/resources" current={pathname}>Resources</NavBtn>
            <NavBtn to="/analytics" current={pathname}>Progress</NavBtn>
          </nav>
          <div className="flex items-center gap-2">
            <button aria-label="Open command search" className="hidden sm:flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50">
              <Search className="w-3.5 h-3.5" /> Search
              <span className="text-[10px] opacity-60">⌘K</span>
            </button>
            <button onClick={signOut} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[44px] px-1">
              <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10">
        {children}
      </main>

      <ReadAloudBar />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 backdrop-blur-md bg-background/95 border-t border-border grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        <Link to="/" className="flex flex-col items-center justify-center gap-1 min-h-[52px] py-2 hud-text text-[9px] text-[oklch(0.7_0.12_220)]">
          <Home className="w-5 h-5" /> HOME
        </Link>
        {MOBILE_NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-h-[52px] py-2 hud-text text-[9px]",
              pathname === n.to ? "text-glow-cyan" : "text-[oklch(0.7_0.12_220)]"
            )}
          >
            <n.icon className="w-5 h-5" /> {n.label.toUpperCase()}
          </Link>
        ))}
      </nav>

    </div>
  );
}

function NavBtn({ to, current, children }: { to: string; current: string; children: ReactNode }) {
  const active = current === to;
  return (
    <Link
      to={to}
        className={cn(
        "px-3 py-2 rounded-md transition",
        active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
