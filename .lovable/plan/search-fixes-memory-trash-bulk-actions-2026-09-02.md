# Search fixes + Memory/Trash bulk actions

## 1. Resource Hub search — only fire on intent

Current behaviour: a debounced effect auto-runs the search whenever the typed text is 3+ characters, so editing or backspacing a query fires extra requests (and surfaces the provider's 429 rate-limit error).

Changes in the Resource Hub page:
- Remove the debounced auto-search effect entirely. Search runs only on Search button click, Enter, or clicking a history chip.
- Empty/short input on submit: show "Please enter something to search" as a toast and make no API call.
- Clearing the input resets results and the error state without any request.
- Guard against duplicate submits: ignore a submit while a search is in flight, and skip re-running the exact same topic unless Refresh is pressed.
- Add a small clear (x) button in the input that resets query, results and error.

## 2. Clear Search History

Recent chips currently come from the shared results cache, which no user can delete. Add a per-user history table so history is private and clearable:
- New table `resource_search_history` (user_id, topic, searched_at) with RLS scoped to `auth.uid()` and grants; the page writes a row on each successful search and reads the last 12 distinct topics from it.
- "Clear history" control next to the chips: deletes all of the user's rows and clears the chips from the UI immediately (optimistic), with a confirm toast.
- The shared results cache stays as-is (it's just cached web results, no personal data).

## 3. Memory Center — Select All + bulk delete

- Add a selection mode to the item lists: a checkbox on each row/card plus a header bar with "Select all" / "Clear selection" and a live count.
- Selecting all applies to the currently filtered/visible set (respects bucket, category and search results).
- Bulk action in normal buckets: "Move to Trash" for all selected, in one request.
- Selection state resets when bucket, category, or search results change.
- UI updates instantly: items are removed from local state optimistically, then reconciled with a background reload; no page refresh needed.

## 4. Trash — Select All + permanent delete

- Same selection UI in the Trash bucket, with "Delete permanently" for selected items and the existing "Empty trash" for everything.
- A confirm step before any permanent delete.
- Permanent delete removes the rows from the database; linked embedding and version rows are already removed automatically by the database's cascade rules, so deleted memories cannot reappear in search, recall, or any module list.
- After deletion the item disappears from all views immediately (local state update + reload), and any open detail drawer for a deleted item closes.

## Technical notes

- New server functions in `src/lib/memory.functions.ts`: `trashMemoryItems({ itemIds })` and `deleteMemoryItemsPermanently({ itemIds })`, both `requireSupabaseAuth`, validated with Zod (uuid array, capped length), scoped with `.eq("user_id", context.userId)` and `.in("id", ids)`.
- Memory search-hit filtering and grouping stay unchanged; selection is a `Set<string>` of ids held in page state.
- Resource Hub keeps its existing markup, tabs, skeletons and calm-mode behaviour; only the trigger logic and the history source change.
- One migration: create `resource_search_history` with RLS policies (select/insert/delete for the owner) and grants for `authenticated`/`service_role`.
