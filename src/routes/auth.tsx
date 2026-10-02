import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowLeft } from "lucide-react";

type Mode = "signin" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { mode?: Mode } => {
    const m = search.mode;
    return { mode: m === "signup" || m === "forgot" || m === "signin" ? m : undefined };
  },
  head: () => ({ meta: [{ title: "VIHAR.AI · Authenticate" }, { name: "description", content: "Sign in to your VIHAR.AI student OS." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<Mode>(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { name } },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. Welcome to VIHAR.");
          navigate({ to: "/dashboard", replace: true });
        } else {
          toast.success("Check your inbox to confirm your email, then sign in.");
          setMode("signin");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Warm the session before navigating so the protected gate resolves
        // instantly instead of bouncing through the public landing route.
        await supabase.auth.getUser();
        toast.success("Identity confirmed.");
        navigate({ to: "/dashboard", replace: true });

      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Recovery link transmitted.");
        setMode("signin");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      // redirect_uri must stay a public same-origin URL; we only move to the
      // protected route once Supabase reports a hydrated session.
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) { toast.error(result.error.message); return; }
      if (result.redirected) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) { toast.error("Google sign-in did not complete. Please try again."); return; }
      toast.success("Identity confirmed.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-12">
      <Link to="/" className="absolute top-6 left-6 hud-text text-xs text-[oklch(0.8_0.12_220)] hover:text-glow-cyan flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Back
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <HoloPanel glow="cyan" className="p-8">
          <div className="text-center mb-6">
            <HudLabel>VIHAR // ACCESS PORTAL</HudLabel>
            <h1 className="font-display text-2xl mt-2 text-glow-cyan">
              {mode === "signup" ? "Initiate Identity" : mode === "forgot" ? "Recover Access" : "Authenticate"}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <Field icon={<User className="w-4 h-4" />} placeholder="Codename" value={name} onChange={setName} />
            )}
            <Field icon={<Mail className="w-4 h-4" />} type="email" required placeholder="neural.id@domain.net" value={email} onChange={setEmail} />
            {mode !== "forgot" && (
              <Field icon={<Lock className="w-4 h-4" />} type="password" required placeholder="Encryption key" value={password} onChange={setPassword} minLength={6} />
            )}
            <HoloButton disabled={loading} className="w-full" type="submit">
              {loading ? "Processing..." : mode === "signup" ? "Create identity" : mode === "forgot" ? "Send recovery link" : "Engage"}
            </HoloButton>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-4 flex items-center gap-2 text-[oklch(0.6_0.08_220)] text-[10px] hud-text">
                <div className="flex-1 h-px bg-[oklch(0.7_0.15_220/0.2)]" /> OR <div className="flex-1 h-px bg-[oklch(0.7_0.15_220/0.2)]" />
              </div>
              <HoloButton variant="ghost" disabled={loading} className="w-full" onClick={handleGoogle} type="button">
                <GoogleIcon /> Continue with Google
              </HoloButton>
            </>
          )}

          <div className="mt-6 text-center text-xs hud-text text-[oklch(0.7_0.1_220)] space-y-2">
            {mode === "signin" && (
              <>
                <div><button type="button" onClick={() => setMode("signup")} className="hover:text-glow-cyan">New here? Create identity →</button></div>
                <div><button type="button" onClick={() => setMode("forgot")} className="hover:text-glow-cyan opacity-70">Forgot encryption key?</button></div>
              </>
            )}
            {mode === "signup" && <button type="button" onClick={() => setMode("signin")} className="hover:text-glow-cyan">Already enrolled? Authenticate →</button>}
            {mode === "forgot" && <button type="button" onClick={() => setMode("signin")} className="hover:text-glow-cyan">← Back to authenticate</button>}
          </div>

        </HoloPanel>
      </motion.div>
    </main>
  );
}

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
};

function Field({ icon, value, onChange, ...rest }: FieldProps) {
  return (
    <label className="relative block">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(0.7_0.12_220)]">{icon}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-3 py-2.5 rounded-md bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm focus:outline-none focus:border-[oklch(0.85_0.2_200/0.7)] focus:shadow-[0_0_16px_oklch(0.85_0.2_200/0.3)] transition placeholder:text-[oklch(0.5_0.05_220)]"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
  );
}
