import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "VIHAR.AI · Reset Password" }, { name: "description", content: "Reset your VIHAR.AI access key." }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Encryption key updated.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <HoloPanel className="w-full max-w-md p-8">
        <HudLabel>VIHAR // KEY RESET</HudLabel>
        <h1 className="font-display text-xl mt-2 text-glow-cyan">Set new encryption key</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="relative block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(0.7_0.12_220)]"><Lock className="w-4 h-4" /></span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New encryption key"
              className="w-full pl-10 pr-3 py-2.5 rounded-md bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm focus:outline-none focus:border-[oklch(0.85_0.2_200/0.7)]"
            />
          </label>
          <HoloButton type="submit" disabled={loading} className="w-full">{loading ? "Updating..." : "Update key"}</HoloButton>
        </form>
      </HoloPanel>
    </main>
  );
}
