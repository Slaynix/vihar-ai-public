import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createClient } from "@supabase/supabase-js";

const SYSTEM_PROMPT = `You are VIHAR — Virtual Interactive Human-AI Advisor & Resource.
You are an elite AI mentor for students: coding, study, careers, productivity, life advice.

RESPONSE LENGTH (default):
- Answer the question directly in 2-4 short sentences. Nothing more.
- No preamble, no restating the question, no "great question", no closing summary or offer to elaborate.
- Do not repeat information already given earlier in the conversation.
- Do not add lists, headings, steps, examples, notes or code unless asked.

EXPAND ONLY WHEN:
- The user explicitly asks for detail, steps, examples, notes, a guide, or code.
- The request is inherently a code/debug task — then give the code with a one-line explanation.

FORMATTING (always markdown, never a wall of text):
- Keep every paragraph to 2-4 sentences, with a blank line between paragraphs.
- When you do expand: use "## " subheadings, "- " bullets for lists, numbered lists for ordered steps.
- Bold the key term or verdict in a line with **bold**; never bold whole paragraphs.
- Use a markdown table when comparing 3+ items across attributes.
- Code always in fenced blocks with a language tag. Inline identifiers in backticks.

FACTUAL DATA:
- Never invent live data (weather, prices, scores, dates). If a LIVE ... DATA block is supplied in the message, summarise only those exact numbers. If no such block exists, say you need live data or a location instead of guessing.

Speak with calm confidence.
You exist inside a holographic operating system; never mention being a generic LLM.
When <memory> context is provided, use it naturally to ground your reply in what the user has actually done; cite the memory titles inline like "(from your note on …)" when relevant.`;


async function embedQuery(text: string, key: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text.slice(0, 4000) }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { data: { embedding: number[] }[] };
    return j.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Require authenticated caller to protect the AI budget from public abuse.
          const authHeaderCheck = request.headers.get("authorization");
          const bearer = authHeaderCheck?.startsWith("Bearer ") ? authHeaderCheck.slice(7) : "";
          if (!bearer || bearer.split(".").length !== 3) {
            return new Response("Unauthorized", { status: 401 });
          }
          {
            const authSupa = createClient(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_PUBLISHABLE_KEY!,
              { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false, autoRefreshToken: false } },
            );
            const { data: claims, error: claimsErr } = await authSupa.auth.getClaims(bearer);
            if (claimsErr || !claims?.claims?.sub) {
              return new Response("Unauthorized", { status: 401 });
            }
          }

          const body = (await request.json()) as { messages?: UIMessage[]; model?: string; useMemory?: boolean };
          if (!Array.isArray(body.messages)) return new Response("messages required", { status: 400 });

          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          // RAG: pull memory context from the latest user turn
          let memoryBlock = "";
          if (body.useMemory !== false) {
            const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
            const lastText = lastUser
              ? (lastUser.parts || []).map((p) => (p.type === "text" ? p.text : "")).join(" ").trim()
              : "";
            const authHeader = request.headers.get("authorization");
            const token = authHeader?.replace("Bearer ", "");
            if (lastText && token) {
              try {
                const supa = createClient(
                  process.env.SUPABASE_URL!,
                  process.env.SUPABASE_PUBLISHABLE_KEY!,
                  { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } },
                );
                const { data: userData } = await supa.auth.getUser();
                if (userData.user) {
                  const emb = await embedQuery(lastText, key);
                  if (emb) {
                    const { data: hits } = await supa.rpc("match_memories", {
                      _user_id: userData.user.id,
                      _query_embedding: emb as never,
                      _kinds: null as never,
                      _since: undefined,
                      _until: undefined,
                      _limit: 6,
                    });
                    const arr = hits as Array<{ title: string; chunk: string; kind: string; created_at: string }> | null;
                    if (arr && arr.length > 0) {
                      memoryBlock =
                        "\n\n<memory>\n" +
                        arr
                          .map(
                            (h, i) =>
                              `[${i + 1}] (${h.kind} · ${new Date(h.created_at).toLocaleDateString()}) ${h.title}\n${h.chunk.slice(0, 500)}`,
                          )
                          .join("\n\n") +
                        "\n</memory>";
                    }
                  }
                }
              } catch {
                // RAG failure is non-fatal
              }
            }
          }

          const modelId =
            body.model === "pro" ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview";

          const gateway = createLovableAiGatewayProvider(key);
          const result = streamText({
            model: gateway(modelId),
            system: SYSTEM_PROMPT + memoryBlock,
            messages: await convertToModelMessages(body.messages),
          });

          return result.toUIMessageStreamResponse({ originalMessages: body.messages });
        } catch (e) {
          console.error("chat error", e);
          return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
