import { createFileRoute, Link, useNavigate, ClientOnly } from "@tanstack/react-router";
import { useEffect, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { HoloButton } from "@/components/holo/HoloButton";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, UserPlus, Zap } from "lucide-react";

// Landing-only 3D core: loaded lazily in the browser so signed-in navigation
// never downloads or mounts it.
const AICoreScene = lazy(() =>
  import("@/components/holo/AICoreScene").then((m) => ({ default: m.AICoreScene })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VIHAR.AI — Enter the AI Student OS" },
      { name: "description", content: "Holographic AI mentor, smart planner, and a 12-module command center for students." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);
  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-clip flex flex-col">
      {/* 3D Core (galaxy background mounted once in __root) */}
      <div className="absolute inset-0 overflow-hidden">
        <ClientOnly
          fallback={
            <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <div className="holo-skeleton w-56 h-56 sm:w-72 sm:h-72 rounded-full opacity-40" />
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
                <div className="holo-skeleton w-56 h-56 sm:w-72 sm:h-72 rounded-full opacity-40" />
              </div>
            }
          >
            <AICoreScene />
          </Suspense>
        </ClientOnly>
      </div>


      {/* Top HUD */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[oklch(0.85_0.2_200)] glow-pulse" />
          <span className="hud-text text-xs text-[oklch(0.85_0.18_200)]">VIHAR // ONLINE</span>
        </div>
        <Link to="/auth" className="hud-text text-xs text-[oklch(0.85_0.18_200)] hover:text-glow-cyan transition">
          Authenticate →
        </Link>
      </motion.header>

      {/* Center Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-8 sm:pt-16 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.2 }}
          className="hud-text text-[10px] sm:text-xs text-[oklch(0.8_0.15_200)] mb-2"
        >
          Virtual · Interactive · Human-AI Advisor & Resource
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="font-display font-extrabold tracking-[0.15em] sm:tracking-[0.2em] text-glow-cyan text-4xl sm:text-7xl md:text-8xl"
        >
          VIHAR<span className="text-glow-purple">.AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="mt-4 max-w-xl text-base sm:text-lg text-[oklch(0.85_0.05_220)] font-sans"
        >
          Learn smarter. Build faster. Grow further.
        </motion.p>
      </div>

      {/* Bottom CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.3 }}
        className="relative z-10 mt-auto pt-12 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:mt-0 sm:pb-0 sm:absolute sm:bottom-16 left-0 right-0 flex flex-col sm:flex-row items-center justify-center gap-4 px-6"
      >

        <Link to="/auth" search={{ mode: "signup" }} className="pointer-events-auto">
          <HoloButton variant="primary">
            <UserPlus className="w-3.5 h-3.5" /> Sign Up
          </HoloButton>
        </Link>
        <Link to="/auth" search={{ mode: "signin" }} className="pointer-events-auto">
          <HoloButton variant="purple">
            <LogIn className="w-3.5 h-3.5" /> Sign In
          </HoloButton>
        </Link>
      </motion.div>

      {/* Side HUD elements */}
      <div className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 z-10 flex-col gap-3 hud-text text-[10px] text-[oklch(0.7_0.1_220)]">
        <div className="flex items-center gap-2"><Zap className="w-3 h-3" /> NEURAL_CORE</div>
        <div className="opacity-70">↳ STATUS: STABLE</div>
        <div className="opacity-70">↳ LATENCY: 12ms</div>
        <div className="opacity-70">↳ MODEL: GEMINI 2.5</div>
      </div>
      <div className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-10 flex-col gap-3 hud-text text-[10px] text-[oklch(0.7_0.1_220)] text-right">
        <div>SYS // V1.0</div>
        <div className="opacity-70">12 MODULES READY</div>
        <div className="opacity-70">UPLINK SECURE</div>
      </div>
    </main>
  );
}
