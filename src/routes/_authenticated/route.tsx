import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useLayoutEffect, memo } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const OutletMemo = memo(Outlet);

function AuthenticatedLayout() {
  // Strip lingering hash fragments (e.g. leftover "#" after OAuth token
  // consumption or form-submit artifacts) BEFORE first paint so the URL
  // is clean on initial render.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, []);
  return <OutletMemo />;
}
