import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DashboardShell } from "@/components/holo/DashboardShell";
import { HoloPanel, HudLabel } from "@/components/holo/HoloPanel";
import { HoloButton } from "@/components/holo/HoloButton";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  searchMemory,
  toggleMemoryFlag,
  trashMemoryItem,
  trashMemoryItems,
  deleteMemoryItemsPermanently,
  restoreMemoryItem,
  backfillEmbeddings,
} from "@/lib/memory.functions";
import { exportMemory, importMemory } from "@/lib/memory-export.functions";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  Pin,
  Star,
  Archive,
  Trash2,
  RotateCcw,
  Download,
  Upload,
  X,
  FileText,
  MessageSquare,
  Code2,
  Calendar,
  Wallet,
  Timer,
  Target,
  Bookmark,
  ImageIcon,
  Search,
  History,
  Database,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({ meta: [{ title: "VIHAR // Memory Center" }] }),
  component: MemoryPage,
});

type MemItem = {
  id: string;
  kind: string;
  category: string;
  title: string;
  summary: string | null;
  content: string | null;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const KIND_ICON: Record<string, typeof FileText> = {
  note: FileText,
  chat: MessageSquare,
  mentor_msg: Brain,
  task: Target,
  roadmap: Sparkles,
  focus: Timer,
  transaction: Wallet,
  goal: Target,
  bookmark: Bookmark,
  upload: Database,
  pdf: FileText,
  image: ImageIcon,
  code: Code2,
  calendar: Calendar,
  quiz: Sparkles,
  flashcard: Sparkles,
};

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "knowledge", label: "Knowledge" },
  { value: "learning", label: "Learning" },
  { value: "projects", label: "Projects" },
  { value: "notes", label: "Notes" },
  { value: "chats", label: "Chats" },
  { value: "study", label: "Study" },
  { value: "calendar", label: "Calendar" },
  { value: "goals", label: "Goals" },
  { value: "health", label: "Health" },
  { value: "uploads", label: "Uploads" },
  { value: "bookmarks", label: "Bookmarks" },
  { value: "activity", label: "Activity" },
] as const;

type View = "timeline" | "grid" | "category";
type Bucket = "all" | "favorites" | "pinned" | "archived" | "trash";

function MemoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("timeline");
  const [bucket, setBucket] = useState<Bucket>("all");
  const [category, setCategory] = useState<string>("all");
  const [active, setActive] = useState<MemItem | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<string[] | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const search = useServerFn(searchMemory);
  const toggle = useServerFn(toggleMemoryFlag);
  const trash = useServerFn(trashMemoryItem);
  const trashMany = useServerFn(trashMemoryItems);
  const deleteMany = useServerFn(deleteMemoryItemsPermanently);
  const restore = useServerFn(restoreMemoryItem);
  const exportFn = useServerFn(exportMemory);
  const importFn = useServerFn(importMemory);
  const backfill = useServerFn(backfillEmbeddings);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("memory_items" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (bucket === "trash") q = q.not("deleted_at", "is", null);
    else q = q.is("deleted_at", null);
    if (bucket === "favorites") q = q.eq("favorite", true);
    if (bucket === "pinned") q = q.eq("pinned", true);
    if (bucket === "archived") q = q.eq("archived", true);
    else if (bucket === "all") q = q.eq("archived", false);
    if (category !== "all") q = q.eq("category", category);
    const { data } = (await q) as unknown as { data: MemItem[] | null };
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    setSelected(new Set());
    load();
  }, [bucket, category]);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) {
      setSearchHits(null);
      setSelected(new Set());
      return;
    }
    setSelected(new Set());
    setSearching(true);
    try {
      const res = await search({ data: { query, limit: 30, useIntent: true } });
      setSearchHits(res.hits.map((h) => h.item_id));
      if (res.intent.kinds || res.intent.since || res.intent.until) {
        const bits = [
          res.intent.kinds?.length ? `kinds: ${res.intent.kinds.join(", ")}` : null,
          res.intent.since ? `since ${new Date(res.intent.since).toLocaleDateString()}` : null,
          res.intent.until ? `until ${new Date(res.intent.until).toLocaleDateString()}` : null,
        ].filter(Boolean);
        if (bits.length) toast.success(`Filtered → ${bits.join(" · ")}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  const filtered = useMemo(() => {
    if (!searchHits) return items;
    const set = new Set(searchHits);
    return items.filter((i) => set.has(i.id)).sort((a, b) => searchHits.indexOf(a.id) - searchHits.indexOf(b.id));
  }, [items, searchHits]);

  const grouped = useMemo(() => {
    const now = Date.now();
    const groups: Record<string, MemItem[]> = { Today: [], Yesterday: [], "This Week": [], "This Month": [], Earlier: [] };
    for (const it of filtered) {
      const d = new Date(it.created_at).getTime();
      const age = (now - d) / 1000 / 60 / 60 / 24;
      if (age < 1) groups.Today.push(it);
      else if (age < 2) groups.Yesterday.push(it);
      else if (age < 7) groups["This Week"].push(it);
      else if (age < 30) groups["This Month"].push(it);
      else groups.Earlier.push(it);
    }
    return groups;
  }, [filtered]);

  async function doToggle(it: MemItem, flag: "pinned" | "favorite" | "archived") {
    const value = !it[flag];
    await toggle({ data: { itemId: it.id, flag, value } });
    load();
  }

  async function doTrash(it: MemItem) {
    await trash({ data: { itemId: it.id } });
    if (active?.id === it.id) setActive(null);
    load();
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function selectAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const permanently = bucket === "trash";
    if (permanently && !window.confirm(`Permanently delete ${ids.length} memor${ids.length === 1 ? "y" : "ies"}? This cannot be undone.`)) return;
    setItems((current) => current.filter((item) => !selected.has(item.id)));
    setSelected(new Set());
    if (active && ids.includes(active.id)) setActive(null);
    try {
      if (permanently) await deleteMany({ data: { itemIds: ids } });
      else await trashMany({ data: { itemIds: ids } });
      toast.success(permanently ? `${ids.length} memories permanently deleted` : `${ids.length} memories moved to Trash`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
      await load();
    }
  }

  async function doRestore(it: MemItem) {
    await restore({ data: { itemId: it.id } });
    load();
  }

  async function handleExport(format: "json" | "markdown" | "txt" | "csv" | "pdf" | "docx") {
    setShowExport(false);
    const t = toast.loading(`Generating ${format.toUpperCase()} export...`);
    try {
      const res = await exportFn({ data: { format, kinds: null } });
      toast.success(`${res.count} items exported`, { id: t });
      window.open(res.url, "_blank");
    } catch (err) {
      toast.error((err as Error).message, { id: t });
    }
  }

  async function handleImport(file: File) {
    const text = await file.text();
    try {
      const res = await importFn({ data: { json: text } });
      toast.success(`Imported ${res.imported} items`);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function runBackfill() {
    const t = toast.loading("Indexing memories for semantic recall...");
    try {
      const res = await backfill({ data: { limit: 50 } });
      toast.success(`Indexed ${res.processed} memories`, { id: t });
    } catch (err) {
      toast.error((err as Error).message, { id: t });
    }
  }

  return (
    <DashboardShell>
      <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
        <div>
          <HudLabel>VIHAR // SECOND BRAIN</HudLabel>
          <h1 className="font-display text-2xl sm:text-3xl text-glow-cyan mt-1">AI Memory Center</h1>
          <p className="text-xs text-muted-foreground font-sans mt-1">
            Auto-captured · Semantically searchable · Yours alone.
          </p>
        </div>
        <div className="flex items-center gap-2 hud-text text-[10px]">
          <button onClick={runBackfill} className="px-3 py-1.5 rounded border border-[oklch(0.7_0.15_220/0.3)] hover:border-[oklch(0.85_0.2_200/0.6)] hover:text-glow-cyan">
            INDEX
          </button>
          <button onClick={() => setShowExport(true)} className="px-3 py-1.5 rounded border border-[oklch(0.7_0.15_220/0.3)] hover:border-[oklch(0.85_0.2_200/0.6)] hover:text-glow-cyan flex items-center gap-1">
            <Download className="w-3 h-3" /> EXPORT
          </button>
          <label className="px-3 py-1.5 rounded border border-[oklch(0.7_0.15_220/0.3)] hover:border-[oklch(0.85_0.2_200/0.6)] hover:text-glow-cyan flex items-center gap-1 cursor-pointer">
            <Upload className="w-3 h-3" /> IMPORT
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={runSearch} className="mb-4">
        <HoloPanel className="!p-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[oklch(0.85_0.2_200)] ml-2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Ask your memory... e.g. "AI mentor chats from last week about Python"'
              className="flex-1 bg-transparent text-sm px-2 py-2 outline-none font-sans"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSearchHits(null);
                }}
                className="text-[oklch(0.7_0.12_220)] hover:text-glow-cyan"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <HoloButton type="submit" disabled={searching}>
              {searching ? "..." : "Recall"}
            </HoloButton>
          </div>
        </HoloPanel>
      </form>

      <div className="flex items-center gap-2 mb-3 flex-wrap hud-text text-[10px]">
        <button
          type="button"
          onClick={selectAllVisible}
          disabled={visibleIds.length === 0}
          className="px-3 py-1.5 min-h-[40px] rounded border border-[oklch(0.7_0.15_220/0.3)] hover:border-[oklch(0.85_0.2_200/0.6)] hover:text-glow-cyan disabled:opacity-40"
        >
          {allVisibleSelected ? "CLEAR SELECTION" : "SELECT ALL"}
        </button>
        {selected.size > 0 && (
          <>
            <span className="text-[oklch(0.6_0.1_220)]">{selected.size} SELECTED</span>
            <HoloButton variant="purple" onClick={bulkDelete}>
              <Trash2 className="w-3 h-3" /> {bucket === "trash" ? "DELETE PERMANENTLY" : "MOVE TO TRASH"}
            </HoloButton>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-[200px_1fr] gap-4">
        {/* Left rail */}
        <aside className="space-y-3">
          <HoloPanel className="!p-3">
            <div className="hud-text text-[10px] mb-2 text-[oklch(0.7_0.12_220)]">BUCKETS</div>
            {([
              { v: "all", l: "All Items" },
              { v: "favorites", l: "Favorites" },
              { v: "pinned", l: "Pinned" },
              { v: "archived", l: "Archive" },
              { v: "trash", l: "Trash" },
            ] as Array<{ v: Bucket; l: string }>).map((b) => (
              <button
                key={b.v}
                onClick={() => setBucket(b.v)}
                className={cn(
                  "w-full text-left text-xs font-sans px-2 py-1.5 rounded transition",
                  bucket === b.v
                    ? "bg-[oklch(0.85_0.2_200/0.15)] text-glow-cyan"
                    : "text-[oklch(0.7_0.12_220)] hover:text-glow-cyan hover:bg-[oklch(0.85_0.2_200/0.05)]",
                )}
              >
                {b.l}
              </button>
            ))}
          </HoloPanel>

          <HoloPanel className="!p-3">
            <div className="hud-text text-[10px] mb-2 text-[oklch(0.7_0.12_220)]">CATEGORIES</div>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={cn(
                  "w-full text-left text-xs font-sans px-2 py-1.5 rounded transition",
                  category === c.value
                    ? "bg-[oklch(0.65_0.25_295/0.15)] text-glow-purple"
                    : "text-[oklch(0.7_0.12_220)] hover:text-glow-purple hover:bg-[oklch(0.65_0.25_295/0.06)]",
                )}
              >
                {c.label}
              </button>
            ))}
          </HoloPanel>

          {bucket === "trash" && (
            <HoloButton
              variant="purple"
              onClick={async () => {
                const ids = items.map((item) => item.id);
                if (!ids.length) return;
                if (!window.confirm(`Permanently delete all ${ids.length} trashed memories? This cannot be undone.`)) return;
                setItems([]);
                setSelected(new Set());
                setActive(null);
                try {
                  await deleteMany({ data: { itemIds: ids } });
                  toast.success(`${ids.length} memories permanently deleted`);
                } catch (err) {
                  toast.error((err as Error).message);
                  await load();
                }
              }}
            >
              <Trash2 className="w-3 h-3" /> Empty trash
            </HoloButton>
          )}
        </aside>

        {/* Main */}
        <div>
          <div className="flex items-center gap-1 mb-3 hud-text text-[10px]">
            {(["timeline", "grid", "category"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 rounded border",
                  view === v
                    ? "border-[oklch(0.85_0.2_200/0.6)] text-glow-cyan"
                    : "border-[oklch(0.7_0.15_220/0.25)] text-[oklch(0.7_0.12_220)]",
                )}
              >
                {v.toUpperCase()}
              </button>
            ))}
            <div className="ml-auto text-[oklch(0.6_0.1_220)]">{filtered.length} items</div>
          </div>

          {loading ? (
            <HoloPanel className="py-16 text-center text-xs text-muted-foreground">Loading memories...</HoloPanel>
          ) : filtered.length === 0 ? (
            <HoloPanel className="py-16 text-center">
              <p className="text-xs text-muted-foreground">No memories here yet. Use any module — everything is captured automatically.</p>
            </HoloPanel>
          ) : view === "timeline" ? (
            <div className="space-y-6">
              {Object.entries(grouped).map(([label, list]) =>
                list.length === 0 ? null : (
                  <div key={label}>
                    <HudLabel>{label}</HudLabel>
                    <div className="mt-2 space-y-2 border-l border-[oklch(0.85_0.2_200/0.25)] pl-4">
                      {list.map((it) => (
                        <TimelineRow key={it.id} item={it} onOpen={setActive} onToggle={doToggle} onTrash={doTrash} onRestore={doRestore} inTrash={bucket === "trash"} selected={selected.has(it.id)} onSelect={() => toggleSelected(it.id)} />
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : view === "grid" ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((it) => (
                <CardRow key={it.id} item={it} onOpen={setActive} onToggle={doToggle} onTrash={doTrash} onRestore={doRestore} inTrash={bucket === "trash"} selected={selected.has(it.id)} onSelect={() => toggleSelected(it.id)} />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {CATEGORIES.filter((c) => c.value !== "all").map((c) => {
                const list = filtered.filter((i) => i.category === c.value);
                if (!list.length) return null;
                return (
                  <div key={c.value}>
                    <HudLabel>{c.label.toUpperCase()} · {list.length}</HudLabel>
                    <div className="mt-2 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {list.map((it) => (
                        <CardRow key={it.id} item={it} onOpen={setActive} onToggle={doToggle} onTrash={doTrash} onRestore={doRestore} inTrash={bucket === "trash"} selected={selected.has(it.id)} onSelect={() => toggleSelected(it.id)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-stretch justify-end"
          onClick={() => setActive(null)}
        >
          <motion.div
            initial={{ x: 50 }}
            animate={{ x: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl h-full overflow-y-auto bg-[oklch(0.06_0.03_270/0.95)] border-l border-[oklch(0.7_0.15_220/0.3)] p-6"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <HudLabel>{active.kind.toUpperCase()} · {active.category.toUpperCase()}</HudLabel>
                <h2 className="font-display text-xl text-glow-cyan mt-1">{active.title}</h2>
                <div className="hud-text text-[10px] text-[oklch(0.6_0.1_220)] mt-1">
                  {new Date(active.created_at).toLocaleString()}
                </div>
              </div>
              <button onClick={() => setActive(null)} className="text-[oklch(0.7_0.12_220)] hover:text-glow-cyan">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2 mb-4 hud-text text-[10px]">
              <button onClick={() => doToggle(active, "pinned")} className={cn("px-2 py-1 rounded border", active.pinned ? "border-[oklch(0.85_0.2_200/0.6)] text-glow-cyan" : "border-[oklch(0.7_0.15_220/0.3)]")}>
                <Pin className="w-3 h-3 inline" /> Pin
              </button>
              <button onClick={() => doToggle(active, "favorite")} className={cn("px-2 py-1 rounded border", active.favorite ? "border-[oklch(0.65_0.25_295/0.6)] text-glow-purple" : "border-[oklch(0.7_0.15_220/0.3)]")}>
                <Star className="w-3 h-3 inline" /> Fav
              </button>
              <button onClick={() => doToggle(active, "archived")} className="px-2 py-1 rounded border border-[oklch(0.7_0.15_220/0.3)]">
                <Archive className="w-3 h-3 inline" /> Archive
              </button>
              <button onClick={() => doTrash(active)} className="px-2 py-1 rounded border border-[oklch(0.7_0.18_25/0.5)] text-[oklch(0.85_0.22_25)] ml-auto">
                <Trash2 className="w-3 h-3 inline" /> Trash
              </button>
            </div>
            {active.summary && <p className="text-sm text-muted-foreground italic mb-3">{active.summary}</p>}
            {active.content && (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.content}</ReactMarkdown>
              </div>
            )}
            {active.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {active.tags.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[oklch(0.85_0.2_200/0.12)] text-[oklch(0.85_0.2_200)]">{t}</span>
                ))}
              </div>
            )}
            <VersionHistory item={active} />
          </motion.div>
        </motion.div>
      )}

      {/* Export modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowExport(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <HoloPanel>
              <HudLabel>EXPORT FORMAT</HudLabel>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {(["json", "markdown", "txt", "csv", "pdf", "docx"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => handleExport(f)}
                    className="p-3 rounded border border-[oklch(0.7_0.15_220/0.3)] hover:border-[oklch(0.85_0.2_200/0.6)] hover:text-glow-cyan font-display text-sm uppercase"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </HoloPanel>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function TimelineRow({ item, onOpen, onToggle, onTrash, onRestore, inTrash, selected, onSelect }: {
  item: MemItem;
  onOpen: (it: MemItem) => void;
  onToggle: (it: MemItem, flag: "pinned" | "favorite" | "archived") => void;
  onTrash: (it: MemItem) => void;
  onRestore: (it: MemItem) => void;
  inTrash: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = KIND_ICON[item.kind] ?? FileText;
  return (
    <div className="relative group">
      <div className="absolute -left-[1.05rem] top-3 w-2 h-2 rounded-full bg-[oklch(0.85_0.2_200)] glow-pulse" />
      <div onClick={() => onOpen(item)} className="p-3 rounded border border-[oklch(0.7_0.15_220/0.2)] bg-[oklch(0.1_0.04_270/0.4)] hover:border-[oklch(0.85_0.2_200/0.5)] cursor-pointer transition flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={(e) => { e.stopPropagation(); onSelect(); }} onClick={(e) => e.stopPropagation()} aria-label={`Select ${item.title}`} className="mt-1 h-4 w-4 accent-cyan-400 shrink-0" />
        <Icon className="w-4 h-4 text-[oklch(0.85_0.2_200)] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-sans text-sm text-glow-cyan truncate">{item.title}</span>
            {item.pinned && <Pin className="w-3 h-3 text-[oklch(0.85_0.2_200)]" />}
            {item.favorite && <Star className="w-3 h-3 text-[oklch(0.75_0.22_295)]" />}
          </div>
          {item.summary && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 font-sans">{item.summary}</p>}
          <div className="hud-text text-[9px] mt-1 text-[oklch(0.6_0.1_220)]">
            {item.kind.toUpperCase()} · {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div className="hidden group-hover:flex flex-col gap-1">
          {inTrash ? (
            <button onClick={(e) => { e.stopPropagation(); onRestore(item); }} className="text-[oklch(0.85_0.2_200)]" title="Restore">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <button onClick={(e) => { e.stopPropagation(); onToggle(item, "favorite"); }} className={cn(item.favorite ? "text-[oklch(0.75_0.22_295)]" : "text-[oklch(0.7_0.12_220)]")}>
                <Star className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onTrash(item); }} className="text-[oklch(0.85_0.22_25)]">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CardRow(props: React.ComponentProps<typeof TimelineRow>) {
  const { item, onOpen, selected, onSelect } = props;
  const Icon = KIND_ICON[item.kind] ?? FileText;
  return (
    <HoloPanel className="scanline cursor-pointer hover:-translate-y-0.5 transition" onClick={() => onOpen(item)}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onSelect} onClick={(e) => e.stopPropagation()} aria-label={`Select ${item.title}`} className="mt-1 h-4 w-4 accent-cyan-400 shrink-0" />
        <Icon className="w-4 h-4 text-[oklch(0.85_0.2_200)] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-sm text-glow-cyan truncate">{item.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-3 mt-1 font-sans">{item.summary || item.content?.slice(0, 160)}</p>
          <div className="hud-text text-[9px] mt-2 text-[oklch(0.6_0.1_220)]">{item.kind.toUpperCase()} · {new Date(item.created_at).toLocaleDateString()}</div>
        </div>
      </div>
    </HoloPanel>
  );
}

function VersionHistory({ item }: { item: MemItem }) {
  const [versions, setVersions] = useState<Array<{ id: string; version_no: number; snapshot: Record<string, unknown>; created_at: string }>>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("memory_versions" as never)
        .select("*")
        .eq("source_id", (item.metadata as { source_id?: string })?.source_id ?? item.id)
        .order("version_no", { ascending: false })
        .limit(20) as unknown as { data: Array<{ id: string; version_no: number; snapshot: Record<string, unknown>; created_at: string }> | null };
      setVersions(data ?? []);
    })();
  }, [item.id]);
  if (!versions.length) return null;
  return (
    <div className="mt-6 pt-4 border-t border-[oklch(0.7_0.15_220/0.2)]">
      <div className="hud-text text-[10px] mb-2 text-[oklch(0.7_0.12_220)] flex items-center gap-2">
        <History className="w-3 h-3" /> VERSION HISTORY · {versions.length}
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {versions.map((v) => (
          <details key={v.id} className="p-2 rounded border border-[oklch(0.7_0.15_220/0.2)] bg-[oklch(0.08_0.04_270/0.4)]">
            <summary className="cursor-pointer text-xs font-sans">v{v.version_no} · {new Date(v.created_at).toLocaleString()}</summary>
            <pre className="mt-2 text-[10px] text-muted-foreground overflow-x-auto">{JSON.stringify(v.snapshot, null, 2).slice(0, 1500)}</pre>
          </details>
        ))}
      </div>
    </div>
  );
}
