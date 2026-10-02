# VIHAR.AI — Module Swap, Login Flow Fix, Gamified Analytics

## 1. Module lineup change

Remove Finance Manager, Productivity and Survival Mode entirely (cards, routes and page files). Add three new modules with the exact same card treatment on the dashboard — same panel, glow alternation, MODULE label, STATUS · READY / ENGAGE → footer, hover lift, stagger animation and grid breakpoints. Only the entries in the module list change.

| Module | Subtitle | Icon | Glow |
| --- | --- | --- | --- |
| Coding Arena | Daily coding • AI hints | Terminal | cyan |
| CGPA Predictor | GPA calculator • Target planner | GraduationCap | purple |
| Resource Hub | Notes • Docs • Courses | Library | cyan |

Each gets a real working page in the existing holographic style (same header pattern, HoloPanel, HoloButton, skeleton loaders):

**Coding Arena** — daily challenge card (AI-generated prompt of the day), an editor/answer box with "Get AI hint" and "AI code review" via the existing AI gateway, a coding streak ring with day dots, a DSA roadmap checklist, and a saved-solutions list. Solved days feed the streak and XP.

**CGPA Predictor** — subject/credit rows with grade selectors, live SGPA, running CGPA across saved semesters, a target-CGPA planner that computes required SGPA per remaining semester, required-marks calculator, and a progress line chart of SGPA by semester (recharts, already installed).

**Resource Hub** — saved resource library with type (notes, PDF, docs, video, repo, course), subject and semester tags, search + filter chips, add/edit/delete, and an "AI recommend resources" action that suggests links for a chosen subject.

## 2. Login redirect flash

Reported: after email sign-in the app briefly shows the landing page before the dashboard. Cause is not yet confirmed, so step one is reproducing it with an instrumented sign-in and logging the actual route sequence. Likely candidates to check: the `SIGNED_IN` listener invalidating the router while `/auth` navigates, and the protected layout's `getUser()` network round-trip rendering a gap. Fix once confirmed — the intended end state is sign-in → dashboard with no intermediate landing frame, using a holographic "Authenticating…" transition while the session hydrates.

## 3. Analytics Center → Student Command Center

Rebuilt as a gamified command center, same cyberpunk shell, no empty states — every panel shows motivational placeholder copy and seeded visuals when data is thin.

Sections:
- **Hero HUD**: animated Level ring + XP bar to next level, Study Streak, Focus Time, Coding Progress, Semester Health, Productivity — animated counters, glowing borders.
- **Daily Missions**: 3 AI-generated missions per day with XP rewards, checkable, refreshed daily.
- **Achievements**: unlockable badges grid (locked ones dimmed with the unlock condition).
- **Goal progress cards** from existing goals.
- **Rewards Center**: XP-unlockable dashboard accent themes applied via existing CSS tokens.
- **Analytics tabs**: Study (focus line chart + 12-week heatmap), Coding (streak + solved bars), CGPA (SGPA trend + prediction), Resources (usage by type).
- **AI Insights**: one panel that reads the user's real activity and returns predicted CGPA, weak subjects, exam readiness and next best action.
- **Semester Health Score**: radial gauge combining attendance, CGPA, study time, coding consistency, tasks and goal completion.

## Technical notes

New tables (all RLS-scoped to `auth.uid()`, with grants):
- `xp_events` — source, points, earned_at (append-only ledger; level and totals derived)
- `daily_missions` — mission_date, title, xp, done
- `rewards` — code, unlocked_at (achievements table already exists and will be reused)
- `coding_attempts` — challenge date, title, difficulty, status, solution, language
- `semesters` + `semester_courses` — semester no, course name, credits, grade point
- `resources` — title, url, type, subject, semester, tags, notes

XP is awarded from existing app actions (focus session, task done, note created, mentor message, coding attempt solved, mission completed) by writing an `xp_events` row from the places those actions already happen; totals, level and streaks are computed with SQL aggregates so the panels are always real. AI missions/insights/hints reuse the existing AI gateway server functions pattern (`src/lib/ai.functions.ts`) — no new provider or key.

Deleting `finance.tsx`, `productivity.tsx` and `survival.tsx` also removes the transactions/pomodoro UI; the `transactions` and `focus_sessions` tables stay, and focus data continues to power study analytics.

Verified end state: no horizontal scroll or overlap at 360/390/768/1280, all nav links resolve, dashboard grid unchanged in look and feel.
