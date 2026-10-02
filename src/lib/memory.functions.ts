import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// ----------------- embedding helper -----------------
async function embedText(text: string): Promise<number[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

function chunkText(s: string, size = 1200, overlap = 150): string[] {
  const out: string[] = [];
  if (!s) return out;
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return [clean];
  let i = 0;
  while (i < clean.length) {
    out.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

// ----------------- embed a single memory item -----------------
export const embedMemoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: item, error } = await supabase
      .from("memory_items")
      .select("id, user_id, title, summary, content")
      .eq("id", data.itemId)
      .single();
    if (error || !item) throw new Error("item not found");
    if (item.user_id !== userId) throw new Error("forbidden");
    const text = [item.title, item.summary, item.content].filter(Boolean).join("\n");
    if (!text.trim()) return { ok: true, chunks: 0 };
    // delete old chunks for this item
    await supabase.from("memory_embeddings").delete().eq("item_id", item.id);
    const chunks = chunkText(text);
    const rows: Array<{ user_id: string; item_id: string; chunk_index: number; chunk_text: string; embedding: number[] }> = [];
    for (let i = 0; i < chunks.length; i++) {
      const emb = await embedText(chunks[i]);
      rows.push({ user_id: userId, item_id: item.id, chunk_index: i, chunk_text: chunks[i], embedding: emb });
    }
    if (rows.length) {
      const { error: insErr } = await supabase.from("memory_embeddings").insert(rows as never);
      if (insErr) throw insErr;
    }
    return { ok: true, chunks: rows.length };
  });

// ----------------- backfill embeddings for any item without them -----------------
export const backfillEmbeddings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(100).default(25) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: items } = await supabase
      .from("memory_items")
      .select("id, title, summary, content")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (!items?.length) return { ok: true, processed: 0 };
    let count = 0;
    for (const it of items) {
      const { count: existing } = await supabase
        .from("memory_embeddings")
        .select("id", { count: "exact", head: true })
        .eq("item_id", it.id);
      if ((existing ?? 0) > 0) continue;
      const text = [it.title, it.summary, it.content].filter(Boolean).join("\n");
      if (!text.trim()) continue;
      const chunks = chunkText(text);
      const rows = await Promise.all(
        chunks.map(async (chunk, i) => ({
          user_id: userId,
          item_id: it.id,
          chunk_index: i,
          chunk_text: chunk,
          embedding: await embedText(chunk),
        })),
      );
      if (rows.length) await supabase.from("memory_embeddings").insert(rows as never);
      count++;
    }
    return { ok: true, processed: count };
  });

// ----------------- intent parsing -----------------
const INTENT_SYSTEM = `You parse a user's natural language search of their personal knowledge base.
Return strict JSON: { "kinds": string[] | null, "since": string | null, "until": string | null, "freeText": string }
- kinds may include any of: chat, mentor_msg, note, task, roadmap, focus, transaction, goal, bookmark, upload, pdf, image, calendar, quiz, flashcard
- since/until are ISO timestamps if a time range is implied (today, yesterday, last week, this month, this year). Otherwise null.
- freeText is the cleaned search query.
Today is ${new Date().toISOString()}.`;

export const parseSearchIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: INTENT_SYSTEM,
      prompt: `Query: ${data.query}\nRespond with only JSON.`,
    });
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    try {
      return JSON.parse(cleaned) as { kinds: string[] | null; since: string | null; until: string | null; freeText: string };
    } catch {
      return { kinds: null, since: null, until: null, freeText: data.query };
    }
  });

// ----------------- search memory (hybrid) -----------------
const SearchInput = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(30).default(10),
  useIntent: z.boolean().default(true),
});

export const searchMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let kinds: string[] | null = null;
    let since: string | null = null;
    let until: string | null = null;
    let freeText = data.query;

    if (data.useIntent) {
      try {
        const key = process.env.LOVABLE_API_KEY!;
        const gateway = createLovableAiGatewayProvider(key);
        const { text } = await generateText({
          model: gateway("google/gemini-3-flash-preview"),
          system: INTENT_SYSTEM,
          prompt: `Query: ${data.query}\nRespond with only JSON.`,
        });
        const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        kinds = parsed.kinds ?? null;
        since = parsed.since ?? null;
        until = parsed.until ?? null;
        freeText = parsed.freeText || data.query;
      } catch {
        // fall back silently
      }
    }

    const emb = await embedText(freeText);
    const rpcArgs: Record<string, unknown> = {
      _user_id: userId,
      _query_embedding: emb,
      _kinds: kinds,
      _since: since ?? undefined,
      _until: until ?? undefined,
      _limit: data.limit,
    };
    const { data: hits, error } = await supabase.rpc("match_memories", rpcArgs as never);
    if (error) throw error;
    return { hits: (hits ?? []) as Array<{ item_id: string; title: string; summary: string | null; kind: string; category: string; created_at: string; similarity: number; chunk: string }>, intent: { kinds, since, until, freeText } };
  });

// ----------------- delete / restore / trash empty -----------------
export const trashMemoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("memory_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.itemId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const restoreMemoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("memory_items")
      .update({ deleted_at: null })
      .eq("id", data.itemId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const emptyTrash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("memory_items")
      .delete()
      .not("deleted_at", "is", null)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const trashMemoryItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemIds: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memory_items")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", data.itemIds)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteMemoryItemsPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemIds: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: memories, error: readError } = await context.supabase
      .from("memory_items")
      .select("id, source_table, source_id, metadata")
      .in("id", data.itemIds)
      .not("deleted_at", "is", null)
      .eq("user_id", context.userId);
    if (readError) throw readError;

    const sourceTables = new Set([
      "bookmarks",
      "calendar_events",
      "flashcards",
      "focus_sessions",
      "goals",
      "messages",
      "notes",
      "quizzes",
      "roadmaps",
      "tasks",
      "transactions",
      "uploads",
    ]);

    for (const memory of (memories ?? []) as Array<{
      source_table: string | null;
      source_id: string | null;
      metadata: Record<string, unknown>;
    }>) {
      if (memory.source_table && memory.source_id && sourceTables.has(memory.source_table)) {
        const { error: sourceError } = await context.supabase
          .from(memory.source_table as never)
          .delete()
          .eq("id", memory.source_id)
          .eq("user_id", context.userId);
        if (sourceError) throw sourceError;
      }
      if (memory.source_table === "uploads") {
        const storagePath = memory.metadata?.storage_path;
        if (typeof storagePath === "string" && storagePath) {
          const { error: storageError } = await context.supabase.storage.from("memory-uploads").remove([storagePath]);
          if (storageError) throw storageError;
        }
      }
    }

    const { error } = await context.supabase
      .from("memory_items")
      .delete()
      .in("id", data.itemIds)
      .not("deleted_at", "is", null)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ----------------- toggle pin / favorite / archive -----------------
export const toggleMemoryFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        itemId: z.string().uuid(),
        flag: z.enum(["pinned", "favorite", "archived"]),
        value: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, boolean> = {};
    patch[data.flag] = data.value;
    await context.supabase
      .from("memory_items")
      .update(patch as never)
      .eq("id", data.itemId)
      .eq("user_id", context.userId);
    return { ok: true };
  });
