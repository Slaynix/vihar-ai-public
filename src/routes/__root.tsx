import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  ClientOnly,
} from "@tanstack/react-router";
import { useEffect, useMemo, lazy, Suspense, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
const HoloBackground = lazy(() =>
  import("@/components/holo/HoloBackground").then((m) => ({ default: m.HoloBackground })),
);
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="holo-panel neon-border-purple max-w-md text-center p-10">
        <h1 className="text-7xl font-display text-glow-cyan">404</h1>
        <h2 className="mt-4 hud-text text-sm">Signal lost</h2>
        <p className="mt-2 text-sm text-muted-foreground">This sector of VIHAR.AI is uncharted.</p>
        <Link to="/" className="mt-6 inline-block hud-text text-xs text-[oklch(0.85_0.2_200)] hover:text-glow-cyan">↳ Return to core</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="holo-panel neon-border max-w-md text-center p-10">
        <h1 className="hud-text text-lg text-glow-cyan">System anomaly detected</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message || "Unknown subsystem fault."}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="hud-text text-xs px-4 py-2 border border-[oklch(0.85_0.2_200/0.5)] rounded hover:bg-[oklch(0.85_0.2_200/0.1)]">Retry</button>
          <a href="/" className="hud-text text-xs px-4 py-2 border border-white/10 rounded hover:bg-white/5">Home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "VIHAR.AI — Enter the AI Student OS" },
      { name: "description", content: "Holographic AI mentor, smart planner, and a 12-module command center for students." },
      { name: "theme-color", content: "#04060d" },
      { property: "og:title", content: "VIHAR.AI — Enter the AI Student OS" },
      { property: "og:description", content: "Holographic AI mentor, smart planner, and a 12-module command center for students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "VIHAR.AI — Enter the AI Student OS" },
      { name: "twitter:description", content: "Holographic AI mentor, smart planner, and a 12-module command center for students." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/788321ec-dab8-4258-b75a-dd0e88e0a64b/id-preview-8d80476b--67b3fe3f-a3e8-4d0d-afd9-6d910af22787.lovable.app-1782309102610.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/788321ec-dab8-4258-b75a-dd0e88e0a64b/id-preview-8d80476b--67b3fe3f-a3e8-4d0d-afd9-6d910af22787.lovable.app-1782309102610.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Keep ONE variant for the whole signed-in app so switching modules never
  // rebuilds the particle buffers (that was the visible navigation stall).
  const { variant, intensity } = useMemo(() => {
    if (pathname === "/") return { variant: "galaxy" as const, intensity: 1 };
    if (pathname.startsWith("/auth") || pathname.startsWith("/reset-password"))
      return { variant: "nebula-violet" as const, intensity: 0.85 };
    return { variant: "nebula-cyan" as const, intensity: 0.75 };
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <ClientOnly fallback={null}>
        <Suspense fallback={null}>
          <HoloBackground variant={variant} intensity={intensity} />
        </Suspense>
      </ClientOnly>
      <Outlet />
      <Toaster theme="dark" position="top-right" />
    </QueryClientProvider>
  );
}
