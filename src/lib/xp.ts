import { supabase } from "@/integrations/supabase/client";

/** Award XP for an action. Fire-and-forget; never blocks the UI. */
export async function awardXp(source: string, points: number, metadata: Record<string, unknown> = {}) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("xp_events" as never).insert({ user_id: data.user.id, source, points, metadata } as never);
  } catch {
    /* XP is cosmetic — never surface failures */
  }
}

/** Level curve: each level costs 100 more XP than the previous one. */
export function levelFromXp(totalXp: number) {
  let level = 1;
  let need = 100;
  let remaining = totalXp;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need += 100;
  }
  return { level, intoLevel: remaining, needed: need, pct: Math.round((remaining / need) * 100) };
}
