# Phase 1 — Intelligent Resource Hub + Audiobook Read Aloud

Two functional rebuilds this phase. Typography system and the global UI/spacing polish come in Phase 2 (unchanged for now).

## 1. Intelligent Resource Hub (real web results)

Search any topic ("Binary Trees", "React Hooks", "DBMS Normalization") and get live, verified results grouped into sections.

**Sourcing:** connect Firecrawl (I'll open the connect card). Searches run server-side; results are cached in the database so repeat topics load instantly and cost nothing.

**Layout (glassmorphism cards, existing neon/HUD style):**
- Top Recommendation — one AI-picked best starting resource, highlighted.
- Best YouTube Videos — thumbnail, title, channel, duration when available, short description, "Watch Now" (new tab).
- Notes & Articles — title, preview snippet, source site + favicon, estimated read time, "Read Now".
- PDFs & Official Docs — official documentation, lecture notes, ebooks.
- Bookmarks — save any result; own tab.
- Recent Searches / History — chips of past topics, one tap to re-open (from cache).
- My Library — the existing manual "save a resource" form and list stay, moved into their own tab so nothing is lost.

**States:** premium shimmer skeletons matching the final card shapes while fetching; a friendly "No resources found" panel with Retry; clear error message if the search service is unavailable.

## 2. Audiobook-style Read Aloud

Replaces the current speak/cancel toggle, which always restarts from the top.

- Sentence-level engine: the response is split into sentences and spoken one at a time, so exact position is always known.
- Controls: Play, Pause, Stop, Restart, Skip Back, Skip Forward (by sentence).
- Draggable progress bar with elapsed / remaining / total estimated time.
- The sentence being spoken is highlighted and auto-scrolled into view.
- Voice picker (all browser voices) and speed 0.75× / 1× / 1.25× / 1.5× / 2×.
- Position is remembered per response and survives pause, module switching and navigation until Restart or a new response.
- Keyboard: Space play/pause, ←/→ skip, R restart (only while the player is focused/active, so typing in chat is unaffected).
- Cross-browser: Chrome/Edge/Firefox/Safari/Android/iOS, including the Chrome long-utterance stall workaround; cleanup on unmount to avoid leaks.

**Where it goes:** built once as a shared player component and wired into AI Mentor first, then the other long-AI-text surfaces that already render responses — Notes, Roadmap, Placement, Internships, Code, Arena and the Resource Hub recommendation.

## Technical notes

- Firecrawl connector linked to the project; a `searchResources` server function calls Firecrawl search (site-scoped queries for YouTube, docs/article domains, and PDF filetype), then one AI pass to rank, tag read time, and choose the top recommendation.
- New tables: `resource_searches` (cached results per topic, shared) and `resource_bookmarks` (per user, RLS scoped to `auth.uid()`); the existing `resources` table and page behaviour are untouched.
- `src/components/holo/ReadAloudPlayer.tsx` — self-contained `speechSynthesis` state machine (sentence queue, index, rate, voice), plus a small store so position persists across route changes.
- Existing shimmer `Skeleton` primitives are reused for the new card skeletons.
- No design-token, layout or auth changes in this phase.

## Not in this phase

Typography hierarchy rework, global spacing/whitespace pass, and the module-wide UI polish — planned next once these two land.
