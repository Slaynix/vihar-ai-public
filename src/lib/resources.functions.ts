import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export type ResourceItem = {
  title: string;
  url: string;
  description: string;
  source: string;
  kind: "video" | "article" | "pdf";
  thumbnail?: string | null;
  channel?: string | null;
  readTime?: string | null;
};

export type ResourceResults = {
  topic: string;
  top: (ResourceItem & { why?: string }) | null;
  videos: ResourceItem[];
  articles: ResourceItem[];
  pdfs: ResourceItem[];
};

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

type FcResult = { url?: string; title?: string; description?: string };

async function fcSearch(query: string, limit: number): Promise<FcResult[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const fcKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableKey || !fcKey) throw new Error("Search service is not connected.");

  const res = await fetch(`${GATEWAY}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": fcKey,
    },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Firecrawl search failed [${res.status}]: ${body}`);
    throw new Error(`Search failed (${res.status}). Please try again.`);
  }
  const json = (await res.json()) as { data?: FcResult[] | { web?: FcResult[] } };
  const data = json.data;
  if (Array.isArray(data)) return data;
  return data?.web ?? [];
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function ytThumb(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function toItems(raw: FcResult[], kind: ResourceItem["kind"]): ResourceItem[] {
  const seen = new Set<string>();
  const out: ResourceItem[] = [];
  for (const r of raw) {
    const url = r.url?.trim();
    if (!url || seen.has(url)) continue;
    if (kind === "video" && !/youtube\.com\/|youtu\.be\//.test(url)) continue;
    seen.add(url);
    out.push({
      title: (r.title || url).slice(0, 160),
      url,
      description: (r.description || "").slice(0, 240),
      source: hostOf(url),
      kind,
      thumbnail: kind === "video" ? ytThumb(url) : null,
      channel: null,
      readTime: null,
    });
  }
  return out;
}

async function enrich(topic: string, results: ResourceResults): Promise<ResourceResults> {
  const key = process.env["LOVABLE_API_KEY"];
  const pool = [...results.videos, ...results.articles, ...results.pdfs];
  if (!key || pool.length === 0) return results;
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const list = pool.map((r, i) => `${i}. [${r.kind}] ${r.title} — ${r.source}`).join("\n");
    const { text } = await generateText({
      model: gateway("openai/gpt-5.6-sol"),
      providerOptions: { lovable: { reasoningEffort: "none" } },
      system: "You output raw JSON only, no prose or code fences.",
      prompt: `Topic: "${topic}". Candidate learning resources:\n${list}\n\nReturn JSON: {"best": <index of the single best starting resource>, "why": "<max 18 words on why>", "readTimes": {"<index>": "<e.g. 8 min read>"}}. Give readTimes only for article/pdf entries.`,
    });
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      best?: number;
      why?: string;
      readTimes?: Record<string, string>;
    };
    for (const [i, t] of Object.entries(parsed.readTimes ?? {})) {
      const item = pool[Number(i)];
      if (item) item.readTime = String(t).slice(0, 24);
    }
    const best = pool[Number(parsed.best)];
    if (best) results.top = { ...best, why: parsed.why?.slice(0, 160) };
  } catch (e) {
    console.error("Resource ranking failed", e);
  }
  if (!results.top) results.top = pool[0] ?? null;
  return results;
}

export const searchResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ topic: z.string().min(2).max(120), refresh: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data }) => {
    const topic = data.topic.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.refresh) {
      const { data: cached } = await supabaseAdmin
        .from("resource_searches")
        .select("results")
        .eq("topic", topic)
        .maybeSingle();
      const hit = cached?.results as ResourceResults | undefined;
      if (hit && (hit.videos?.length || hit.articles?.length)) return hit;
    }

    const settled = await Promise.allSettled([
      fcSearch(`${data.topic} tutorial site:youtube.com`, 8),
      fcSearch(`${data.topic} tutorial explained notes`, 8),
      fcSearch(`${data.topic} filetype:pdf lecture notes OR documentation`, 5),
    ]);
    const [videos, articles, pdfs] = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
    const firstError = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;

    if (!videos.length && !articles.length && !pdfs.length) {
      if (firstError) {
        throw new Error(
          firstError.reason instanceof Error
            ? firstError.reason.message
            : "The search service is unavailable right now.",
        );
      }
      throw new Error("No resources found for that topic. Try a different wording.");
    }

    const results = await enrich(data.topic, {
      topic: data.topic,
      top: null,
      videos: toItems(videos, "video").slice(0, 6),
      articles: toItems(articles, "article").slice(0, 6),
      pdfs: toItems(pdfs, "pdf").slice(0, 5),
    });

    await supabaseAdmin
      .from("resource_searches")
      .upsert({ topic, results: JSON.parse(JSON.stringify(results)) }, { onConflict: "topic" });

    return results;
  });

export type InternshipListing = {
  title: string;
  company: string;
  url: string;
  location: string;
  description: string;
  source: string;
};

export const searchInternshipListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    roles: z.array(z.string().max(80)).max(8).default([]),
    skills: z.array(z.string().max(60)).max(20).default([]),
    location: z.string().max(120).default("India"),
    workMode: z.string().max(40).default("any"),
    employment: z.string().max(40).default("any"),
    domain: z.string().max(100).default(""),
  }).parse(d))
  .handler(async ({ data }) => {
    const role = data.roles.join(" OR ") || "software engineering intern";
    const skills = data.skills.slice(0, 8).join(" ");
    const terms = [role, "internship", skills, data.domain, data.location, data.workMode === "anywhere" ? "remote" : data.workMode, data.employment === "any" ? "" : data.employment, "apply"].filter(Boolean).join(" ");
    const found = await fcSearch(terms, 16);
    const seen = new Set<string>();
    return found.flatMap((entry) => {
      const url = entry.url?.trim();
      if (!url || seen.has(url)) return [];
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || !entry.title?.trim()) return [];
        seen.add(url);
        const source = parsed.hostname.replace(/^www\./, "");
        const title = entry.title.slice(0, 160);
        const company = title.split(/[|–—-]/)[0]?.trim() || source;
        return [{ title, company: company.slice(0, 100), url, location: data.location || "Not specified", description: (entry.description || "").slice(0, 420), source }];
      } catch {
        return [];
      }
    }).slice(0, 12) satisfies InternshipListing[];
  });
