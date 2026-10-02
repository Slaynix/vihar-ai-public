import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCalmWhile } from "@/lib/perf";

import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { Skeleton } from "@/components/holo/Skeleton";
import { SpeakButton } from "@/components/holo/ReadAloudPlayer";
import { supabase } from "@/integrations/supabase/client";
import { searchResources, type ResourceItem, type ResourceResults } from "@/lib/resources.functions";
import { awardXp } from "@/lib/xp";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Search, Star, Bookmark, BookmarkCheck, Library, Play, FileText, History, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/resources")({
  head: () => ({
    meta: [
      { title: "VIHAR // Resource Hub" },
      { name: "description", content: "Search any topic and get verified videos, articles and PDFs, plus your own saved library of study material." },
      { property: "og:title", content: "VIHAR // Resource Hub" },
      { property: "og:description", content: "Live-searched videos, notes, docs and PDFs for any study topic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResourcesPage,
});

type Res = { id: string; title: string; url: string | null; kind: string; subject: string | null; sem_no: number | null; notes: string | null };
type Mark = { id: string; title: string; url: string; kind: string; source: string | null; topic: string | null; thumbnail: string | null; description: string | null };

const KINDS = ["notes", "pdf", "docs", "youtube", "github", "course", "cheatsheet"] as const;
const TABS = ["discover", "bookmarks", "library"] as const;
type Tab = (typeof TABS)[number];

function favicon(host: string) {
  return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
}

function ResourcesPage() {
  const [tab, setTab] = useState<Tab>("discover");

  // discover
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [results, setResults] = useState<ResourceResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const run = useServerFn(searchResources);

  // Freeze the 3D background while a search is in flight — this is the fix for
  // the mobile lag, since the GPU loop and the network work no longer compete.
  useCalmWhile(searching);

  // bookmarks
  const [marks, setMarks] = useState<Mark[] | null>(null);

  // library
  const [items, setItems] = useState<Res[] | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("notes");
  const [subject, setSubject] = useState("");
  const [filter, setFilter] = useState<string>("all");

  async function loadLibrary() {
    const { data } = (await supabase
      .from("resources" as never)
      .select("id, title, url, kind, subject, sem_no, notes")
      .order("created_at", { ascending: false })) as unknown as { data: Res[] | null };
    setItems(data || []);
  }
  async function loadMarks() {
    const { data } = (await supabase
      .from("resource_bookmarks" as never)
      .select("id, title, url, kind, source, topic, thumbnail, description")
      .order("created_at", { ascending: false })) as unknown as { data: Mark[] | null };
    setMarks(data || []);
  }
  async function loadRecent() {
    const { data } = (await supabase
      .from("resource_search_history" as never)
      .select("topic, searched_at")
      .order("searched_at", { ascending: false })
      .limit(40)) as unknown as { data: { topic: string; searched_at: string }[] | null };
    setRecent(Array.from(new Set((data || []).map((r) => r.topic))).slice(0, 12));
  }

  useEffect(() => {
    loadLibrary();
    loadMarks();
    loadRecent();
  }, []);

  const lastSearched = useRef("");

  const search = useCallback(
    async (q: string, refresh = false) => {
      const t = q.trim();
      if (searching) return;
      if (t.length < 2) return toast.error("Please enter something to search");
      if (!refresh && t.toLowerCase() === lastSearched.current) return;
      setTopic(t);
      setQuery(t);
      setSearching(true);
      setError(null);
      setResults(null);
      try {
        const r = await run({ data: { topic: t, refresh } });
        setResults(r);
        lastSearched.current = t.toLowerCase();
        awardXp("resource", 5, { topic: t });
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
           await supabase.from("resource_search_history" as never).insert({ user_id: u.user.id, topic: t } as never);
        }
        loadRecent();
      } catch (e) {
        setError((e as Error).message || "Search service is unavailable right now.");
      } finally {
        setSearching(false);
      }
    },
     [run, searching],
  );

  const marked = useMemo(() => new Set((marks || []).map((m) => m.url)), [marks]);


  const toggleMark = useCallback(
    async (item: ResourceItem) => {
      const existing = (marks || []).find((m) => m.url === item.url);
      if (existing) {
        await supabase.from("resource_bookmarks" as never).delete().eq("id", existing.id);
        loadMarks();
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.from("resource_bookmarks" as never).insert({
        user_id: u.user.id,
        topic,
        title: item.title,
        url: item.url,
        source: item.source,
        kind: item.kind,
        thumbnail: item.thumbnail ?? null,
        description: item.description,
      } as never);
      toast.success("Bookmarked");
      loadMarks();
    },
    [marks, topic],
  );


  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("resources" as never).insert({
      user_id: u.user.id,
      title: title.trim(),
      url: url.trim() || null,
      kind,
      subject: subject.trim() || null,
    } as never);
    awardXp("resource", 10, { title: title.trim() });
    setTitle("");
    setUrl("");
    loadLibrary();
  }

  async function remove(id: string) {
    await supabase.from("resources" as never).delete().eq("id", id);
    loadLibrary();
  }

  const subjects = useMemo(() => Array.from(new Set((items || []).map((i) => i.subject).filter(Boolean) as string[])), [items]);
  const shown = (items || []).filter((i) => filter === "all" || i.subject === filter);

  return (
    <DashboardShell>
      <HudLabel>VIHAR // RESOURCE HUB</HudLabel>
      <h1 className="font-display text-2xl text-glow-cyan mt-1 mb-4">Resource Hub</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "hud-text text-[10px] px-3 py-2 min-h-[40px] rounded border transition",
              tab === t
                ? "text-glow-cyan border-[oklch(0.85_0.2_200/0.6)] bg-[oklch(0.85_0.2_200/0.1)]"
                : "text-[oklch(0.7_0.12_220)] border-[oklch(0.7_0.15_220/0.25)]",
            )}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "discover" && (
        <div className="space-y-4">
          <HoloPanel>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                search(query);
              }}
              className="flex flex-wrap gap-2"
            >
              <input
                value={query}
                onChange={(e) => {
                  const next = e.target.value;
                  setQuery(next);
                  if (!next.trim()) {
                    setTopic("");
                    setResults(null);
                    setError(null);
                    lastSearched.current = "";
                  }
                }}
                placeholder="Search a topic — Binary Trees, React Hooks, DBMS Normalization"
                className="flex-1 min-w-[12rem] px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setTopic("");
                    setResults(null);
                    setError(null);
                    lastSearched.current = "";
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[oklch(0.7_0.12_220)] hover:text-glow-cyan"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <HoloButton type="submit" disabled={searching}>
                <Search className="w-3.5 h-3.5" /> {searching ? "Scanning..." : "Search"}
              </HoloButton>
              {results && (
                <HoloButton variant="purple" type="button" onClick={() => search(topic, true)} disabled={searching}>
                  <RotateCcw className="w-3.5 h-3.5" /> Refresh
                </HoloButton>
              )}
            </form>

            {recent.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-3">
                <History className="w-3.5 h-3.5 text-[oklch(0.6_0.1_220)]" />
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => search(r)}
                    className="hud-text text-[9px] px-2.5 py-1.5 rounded-full border border-[oklch(0.7_0.15_220/0.25)] text-[oklch(0.7_0.12_220)] hover:text-glow-cyan transition"
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={async () => {
                    setRecent([]);
                    const { data: u } = await supabase.auth.getUser();
                    if (!u.user) return;
                    const { error: clearError } = await supabase
                      .from("resource_search_history" as never)
                      .delete()
                      .eq("user_id", u.user.id);
                    if (clearError) toast.error("Could not clear search history");
                    else toast.success("Search history cleared");
                  }}
                  className="hud-text text-[9px] px-2.5 py-1.5 rounded-full border border-[oklch(0.7_0.18_25/0.35)] text-[oklch(0.8_0.18_25)] hover:border-[oklch(0.8_0.18_25/0.6)] transition"
                >
                  CLEAR HISTORY
                </button>
              </div>
            )}
          </HoloPanel>

          {searching && <ResultSkeletons />}

          {!searching && error && (
            <HoloPanel>
              <p className="text-sm text-[oklch(0.8_0.16_25)] mb-3">{error}</p>
              <HoloButton onClick={() => search(topic, true)}>
                <RotateCcw className="w-3.5 h-3.5" /> Retry
              </HoloButton>
            </HoloPanel>
          )}

          {!searching && !error && results && (
            <>
              {results.top && (
                <HoloPanel glow="purple">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-[oklch(0.85_0.2_90)]" />
                    <HudLabel>TOP RECOMMENDATION</HudLabel>
                  </div>
                  <h2 className="font-sans text-base text-glow-cyan">{results.top.title}</h2>
                  {results.top.why && <p className="text-xs text-muted-foreground mt-1">{results.top.why}</p>}
                  <p className="text-sm mt-2 text-[oklch(0.85_0.03_220)] line-clamp-3">{results.top.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <a href={results.top.url} target="_blank" rel="noreferrer noopener">
                      <HoloButton type="button">
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </HoloButton>
                    </a>
                    {results.top.description && <SpeakButton id={`top-${results.top.url}`} text={`${results.top.title}. ${results.top.description}`} label="TOP PICK" />}
                  </div>
                </HoloPanel>
              )}

              <Section title="BEST YOUTUBE VIDEOS" items={results.videos} marked={marked} onMark={toggleMark} />
              <Section title="NOTES & ARTICLES" items={results.articles} marked={marked} onMark={toggleMark} />
              <Section title="PDFS & OFFICIAL DOCS" items={results.pdfs} marked={marked} onMark={toggleMark} />

              {!results.videos.length && !results.articles.length && !results.pdfs.length && (
                <HoloPanel>
                  <p className="text-sm text-muted-foreground mb-3">No resources found for “{results.topic}”. Try different wording.</p>
                  <HoloButton onClick={() => search(topic, true)}>
                    <RotateCcw className="w-3.5 h-3.5" /> Retry
                  </HoloButton>
                </HoloPanel>
              )}
            </>
          )}

          {!searching && !error && !results && (
            <HoloPanel>
              <p className="text-xs text-muted-foreground">Search any topic to pull live videos, articles and PDFs. Results are cached, so repeat topics load instantly.</p>
            </HoloPanel>
          )}
        </div>
      )}

      {tab === "bookmarks" && (
        <HoloPanel>
          {marks === null ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : marks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bookmarks yet — save any search result with the bookmark icon.</p>
          ) : (
            <ul className="space-y-2">
              {marks.map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-2.5 rounded border border-[oklch(0.7_0.15_220/0.2)] bg-[oklch(0.1_0.04_270/0.4)]">
                  <img src={favicon(m.source || "")} alt="" width={16} height={16} loading="lazy" className="w-4 h-4 shrink-0 rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-sans truncate">{m.title}</div>
                    <div className="hud-text text-[9px] text-[oklch(0.6_0.1_220)] truncate">
                      {m.kind.toUpperCase()} · {m.source}
                      {m.topic ? ` · ${m.topic}` : ""}
                    </div>
                  </div>
                  <a href={m.url} target="_blank" rel="noreferrer noopener" aria-label={`Open ${m.title}`} className="text-[oklch(0.85_0.2_200)] px-1 min-h-[44px] flex items-center">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={async () => {
                      await supabase.from("resource_bookmarks" as never).delete().eq("id", m.id);
                      loadMarks();
                    }}
                    aria-label={`Remove ${m.title}`}
                    className="text-[oklch(0.7_0.18_25)] px-1 min-h-[44px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </HoloPanel>
      )}

      {tab === "library" && (
        <HoloPanel>
          <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="col-span-2 px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional)" className="col-span-2 sm:col-span-1 px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
            <select value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])} className="px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm">
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="px-3 py-2 min-h-[44px] rounded bg-[oklch(0.12_0.05_280/0.5)] border border-[oklch(0.7_0.15_220/0.25)] text-sm" />
            <HoloButton type="submit" className="col-span-2 sm:col-span-5">
              <Plus className="w-3.5 h-3.5" /> Save resource
            </HoloButton>
          </form>

          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {["all", ...subjects].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={cn(
                    "hud-text text-[10px] px-3 py-2 rounded border transition",
                    filter === s
                      ? "text-glow-cyan border-[oklch(0.85_0.2_200/0.6)] bg-[oklch(0.85_0.2_200/0.1)]"
                      : "text-[oklch(0.7_0.12_220)] border-[oklch(0.7_0.15_220/0.25)]",
                  )}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {items === null ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : shown.length === 0 ? (
            <p className="text-xs text-muted-foreground">Your library is empty — save your first note, PDF or playlist above.</p>
          ) : (
            <ul className="space-y-2 max-h-[55vh] overflow-y-auto">
              {shown.map((r) => (
                <li key={r.id} className="flex items-center gap-2 p-2.5 rounded border border-[oklch(0.7_0.15_220/0.2)] bg-[oklch(0.1_0.04_270/0.4)]">
                  <Library className="w-4 h-4 shrink-0 text-[oklch(0.85_0.2_200)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-sans truncate">{r.title}</div>
                    <div className="hud-text text-[10px] text-[oklch(0.6_0.1_220)]">
                      {r.kind.toUpperCase()}
                      {r.subject ? ` · ${r.subject}` : ""}
                    </div>
                  </div>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer noopener" aria-label={`Open ${r.title}`} className="text-[oklch(0.85_0.2_200)] px-1 min-h-[44px] flex items-center">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button onClick={() => remove(r.id)} aria-label={`Delete ${r.title}`} className="text-[oklch(0.7_0.18_25)] px-1 min-h-[44px]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </HoloPanel>
      )}
    </DashboardShell>
  );
}

const ResourceCard = memo(function ResourceCard({
  it,
  isMarked,
  onMark,
}: {
  it: ResourceItem;
  isMarked: boolean;
  onMark: (i: ResourceItem) => void;
}) {
  return (
    <article className="rounded-xl border border-[oklch(0.7_0.15_220/0.2)] bg-[oklch(0.1_0.04_270/0.45)] overflow-hidden flex flex-col">
      {it.thumbnail && (
        <img src={it.thumbnail} alt="" loading="lazy" decoding="async" className="w-full aspect-video object-cover border-b border-[oklch(0.7_0.15_220/0.2)]" />
      )}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <h3 className="text-sm font-sans leading-snug flex-1 break-words">{it.title}</h3>
          <button
            onClick={() => onMark(it)}
            aria-label={isMarked ? `Remove bookmark ${it.title}` : `Bookmark ${it.title}`}
            className="shrink-0 text-[oklch(0.85_0.2_200)] p-1"
          >
            {isMarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
        </div>
        {it.description && <p className="text-xs text-muted-foreground line-clamp-3">{it.description}</p>}
        <div className="mt-auto flex items-center gap-2 hud-text text-[9px] text-[oklch(0.6_0.1_220)]">
          <img src={favicon(it.source)} alt="" width={14} height={14} loading="lazy" decoding="async" className="w-3.5 h-3.5 rounded" />
          <span className="truncate">{it.source}</span>
          {it.readTime && <span>· {it.readTime}</span>}
        </div>
        <a href={it.url} target="_blank" rel="noreferrer noopener" className="hud-text text-[10px] inline-flex items-center gap-1 text-glow-cyan min-h-[36px]">
          {it.kind === "video" ? <Play className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
          {it.kind === "video" ? "WATCH NOW" : "READ NOW"}
        </a>
      </div>
    </article>
  );
});

const Section = memo(function Section({
  title,
  items,
  marked,
  onMark,
}: {
  title: string;
  items: ResourceItem[];
  marked: Set<string>;
  onMark: (i: ResourceItem) => void;
}) {
  if (!items.length) return null;
  return (
    <HoloPanel>
      <HudLabel>{title}</HudLabel>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        {items.map((it) => (
          <ResourceCard key={it.url} it={it} isMarked={marked.has(it.url)} onMark={onMark} />
        ))}
      </div>
    </HoloPanel>
  );
});


function ResultSkeletons() {
  return (
    <div className="space-y-4">
      <HoloPanel>
        <Skeleton className="h-4 w-40 mb-3" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-8/12" />
      </HoloPanel>
      {[0, 1].map((s) => (
        <HoloPanel key={s}>
          <Skeleton className="h-3 w-32 mb-3" />
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-[oklch(0.7_0.15_220/0.2)] overflow-hidden">
                <Skeleton className="w-full aspect-video" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-10/12" />
                  <Skeleton className="h-3 w-7/12" />
                </div>
              </div>
            ))}
          </div>
        </HoloPanel>
      ))}
    </div>
  );
}
