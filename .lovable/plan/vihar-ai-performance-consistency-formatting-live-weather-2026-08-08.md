# VIHAR.AI — Performance, Consistency, Formatting & Live Weather

No functionality, auth, database, AI integration, module or route is removed. This is an optimization + consistency pass, plus one new capability (live weather).

## 1. Resource Hub search lag (real fix, not cosmetic)

The 3D background is a full WebGL galaxy that keeps rendering at full rate while a search runs, and the Hub re-renders large result grids on every keystroke.

- Add a shared performance context so any screen can request "calm mode". While a search is in flight (and permanently on low-power/mobile devices) the background drops particle counts, lowers DPR, and pauses the render loop instead of animating.
- Pause the galaxy render loop entirely while the Resource Hub search is running or the tab is hidden, and on `prefers-reduced-motion`.
- Debounce the search input (~450ms), cancel superseded requests with an `AbortController`, and skip duplicate queries so repeated typing never fires extra calls.
- Memoize result cards and the result lists (`memo` + stable callbacks) so typing in the search box does not re-render the whole grid.
- Lazy-load result thumbnails (`loading="lazy"`, `decoding="async"`) and drop heavy backdrop-blur on mobile in favour of a flat translucent surface.

## 2. Consistent, cleaner UI across all 12 modules

Build a small shared design-system layer and adopt it in every module page:

- `ModuleHeader` — title, one-line description, optional action slot. Same spacing everywhere.
- `Card` / `Section` — one border radius, one border weight, one padding scale, restrained glow (glow reserved for a single primary element per screen).
- `LoadingState`, `EmptyState`, `ErrorState` (with retry), `SkeletonCard` — reusable, matching final layout.
- Shared button and input styling built on the existing Holo components so nothing looks foreign.

Then pass through all 12 module routes (Dashboard, Mentor, Memory, Planner, Notes, Code, Analytics, Arena, CGPA, Resources, Placement, Roadmap, Attendance, Internships) replacing ad-hoc headers/cards/spacing with these components. Layouts stay recognisably the same — spacing, hierarchy and density get normalised, excess icons/borders/animations removed, vertical stacking verified on mobile with no horizontal scroll.

## 3. AI response formatting everywhere

- One shared `AIResponse` renderer (Markdown + GFM) with proper typography: readable line-height, spaced paragraphs, styled headings, lists, tables and code blocks with language labels. No raw `##` or `**` anywhere.
- Question and answer visually separated in Mentor; answers stay scannable.
- Prompt updates per tool so structure is requested at the source:
  - **Mentor**: conversational, with Answer / Why / What You Should Do / Next Step when the question warrants it; short answers stay short.
  - **AI Notes**: fixed sections — Definition, Key Points, Example, Quick Revision, Important Questions.
  - **Planner / Placement / Coding / Roadmap / Resource Hub**: short paragraphs, bullets, numbered steps, bold key terms, tables for comparisons, fenced code blocks.

## 4. Live weather (no hallucination)

- New server function calling a live weather API (Open-Meteo — free, no API key, includes geocoding), returning current conditions plus hourly/daily forecast.
- Mentor detects weather intent: uses browser geolocation when the user allows it, otherwise asks for a city. The AI only summarises the fetched numbers — it is explicitly forbidden from inventing weather values.
- If the fetch fails, the UI says live weather data is unavailable. No guessed numbers.
- A `WeatherCard` renders temperature, condition, feels-like, rain probability, humidity, wind, and a compact hourly/daily strip.

## 5. Verification

Headless-browser pass over all 12 modules at 360px, 768px and 1280px: no horizontal scroll, no overlap, consistent spacing, loading/empty/error states render, Resource Hub search stays smooth while typing, and the weather card shows real fetched values.

## Technical notes

- Background adaptivity via a lightweight React context + the existing `HoloBackground` memo; particle counts and `dpr` become inputs, and `frameloop` flips to `never` during search/hidden/reduced-motion.
- Search uses debounce + `AbortController`; the existing Firecrawl server function and DB cache are untouched.
- New shared components live under `src/components/ui-system/`; existing Holo components are reused, not replaced.
- Weather via a new `src/lib/weather.functions.ts` server function (auth-protected, same pattern as `resources.functions.ts`); no new secret required.
