# Backlog

Mirrors [docs/PRD.md](../docs/PRD.md) §3. Update status here as rounds move; keep the
detailed spec in the round's own `docs/FEATURE_UPGRADE_N.md` once it starts.

| # | Round | Status |
|---|-------|--------|
| 2 | Frontend build tooling (Vite, ES modules, zero behavior change) | Merged (PR #9, regular merge into `development`) |
| 3 | Dashboard + Applications workspace (info hierarchy + quick filters; most of the draft prompt's search/filter/sort/export wishlist turned out already implemented — see `docs/FEATURE_UPGRADE_3.md`) | Merged (PR #10) |
| 4 | Application checklist — full CRUD (edit/delete/reorder), validation, lifecycle-phase display grouping; stage-aware *generation* deferred — see `docs/FEATURE_UPGRADE_4.md` | Merged (PR #11) |
| 5 | Contacts/networking — fixed the broken application-linkage flow, added Edit UI, surfaced contacts on application detail; backend CRUD/security was already solid — see `docs/FEATURE_UPGRADE_5.md` | Merged (PR #12) |
| 6 | Import/export hardening — fixed CSV formula-injection (every CSV export), job_url unsafe-protocol gap, added CSV import, batch row-detail viewing; preview/validation/duplicate/transaction logic was already solid — see `docs/FEATURE_UPGRADE_6.md` | Merged (PR #13) |
| 7 | Task management — genuinely net-new `tasks` table, distinct from the pre-existing (and much closer than expected) `reminders` domain; Today/Upcoming/Backlog/Completed views, priority, optional due date, optional application link, simple recurrence — see `docs/FEATURE_UPGRADE_7.md` | Merged (PR #14) |
| 8 | Habit tracker — genuinely net-new `habits`/`habit_logs`; daily/weekdays/weekly frequency, unified boolean+count completion model, idempotent progress writes, derived streaks — see `docs/FEATURE_UPGRADE_8.md` | Merged (PR #15) |
| 9 | Journal / notes — genuinely net-new `notes` table, distinct from the 8 existing domain-specific notes fields (left untouched); search, type/pinned filters, optional application link, safe plain-text rendering — see `docs/FEATURE_UPGRADE_9.md` | Implemented locally; PR pending |
| 10 | Analytics module | Not started |
| 11 | Responsive/design-system capstone pass | Not started |

Not sequenced, on request only: `docs/design/STITCH_PROMPT.md` (Google Stitch prompt
package, plan-only).

## Smaller items discovered during Round 3 (not yet sequenced into a round)

- "Interviews This Week" / "Follow-ups Due" quick filters (need `interviews`/
  `follow_ups` joins — bigger than a params-only quick filter). See
  `docs/FEATURE_UPGRADE_3.md` Known Debt.
- Salary-range filter UI — blocked on a product decision about currency/period
  normalization, not just a UI gap. See same doc.
- Decide whether to deprecate `GET /api/applications` (the pre-Feature-Upgrade-1 listing
  endpoint) now that its only frontend caller was removed as dead code.

## Smaller items discovered during Round 4 (not yet sequenced into a round)

- Note "add/edit" UI control for checklist items (backend field + PATCH support exist;
  no frontend control reaches it beyond the initial completion toggle). See
  `docs/FEATURE_UPGRADE_4.md` Known Debt.
- Stage-aware checklist *generation* (today's display-only lifecycle grouping is safe;
  actually varying which defaults get created per stage needs either fragile
  label-matching or a schema change, deferred pending real product need).
- Configurable checklist templates — no verified need yet beyond the one fixed set.
- Dashboard integration of checklist completion/progress — deferred to avoid an N+1
  query pattern across the application list; needs a deliberate efficient query shape
  if pursued.
- **`#detail-stage` (application detail page's stage-change dropdown) has no accessible
  name** — real, critical-impact, pre-existing WCAG violation, found while scoping
  Round 4's new E2E test but left unfixed (unrelated to checklists; the rest of the
  detail page likely has more of the same pattern and deserves a dedicated audit, not a
  one-off fix here). Cheap to fix whenever someone picks it up.
- Cross-group checklist reordering has no visible effect in the grouped display (group
  membership is decided by label, not `position`) — not a bug, but worth knowing if the
  grouping/reorder interaction is ever revisited. See `docs/FEATURE_UPGRADE_4.md`.

## Smaller items discovered during Round 5 (not yet sequenced into a round)

- **Edit UI gap for interviews/rejections/follow_ups/daily_goals/weekly_goals** — same
  "no edit control in the UI, backend already supports PATCH" gap this round closed for
  networking_contacts, identically present for every other type sharing the generic
  `renderTracker` view. See `docs/FEATURE_UPGRADE_5.md`.
- No accessibility audit of the other `renderTracker`-based pages (interviews,
  rejections, follow_ups, goals, resumes, reminders) — only Networking and the
  application-detail page were scanned this round.
- Contact search/filter/sort and duplicate-contact detection — deferred, no evidence of
  need at current scale.
- ~~`job_url` on the application detail page has the same unvalidated-external-link-
  protocol pattern `linkedin_url` had before this round~~ — **fixed in Round 6**
  (`docs/FEATURE_UPGRADE_6.md`).

## Smaller items discovered during Round 6 (not yet sequenced into a round)

- No restore path for the full-workspace JSON export (`/api/exports/json`) — the
  export itself is comprehensive (14 tables) and already backup-labeled, but a safe
  restore across that many FK-related tables is real, separate, higher-risk feature
  work. See `docs/FEATURE_UPGRADE_6.md` Known Debt.
- No downloadable error-report CSV for a bulk-import batch — row-level detail is now
  viewable in the UI (this round); exporting it is a small, separate follow-up.
- `import_rows` has no dedicated index on `batch_id` — fine at current scale, worth
  adding if import volume ever grows.
- The Edit-UI gap noted in Round 5 (interviews/rejections/follow_ups/goals sharing
  `renderTracker` still have no Edit control) is still open — unrelated to this round.
- A non-reproducible, coincidental PIN-hash test flake was observed once during this
  round's testing (`PIN validation accepts leading zero...` — a substring-coincidence
  assertion, not a real bug). Not fixed; noted for whoever next sees it.

## Smaller items discovered during Round 7 (not yet sequenced into a round)

- Task tagging (`task_tags` join table) — deferred, `tags`/`application_tags` exist but
  are applications-only; not required by MVP acceptance criteria. See
  `docs/FEATURE_UPGRADE_7.md` Known Debt.
- Subtasks — deferred, no strong evidence they'd materially improve the MVP yet.
- "Tasks due today" dashboard widget — deferred in favor of the (explicitly
  prioritized) application-detail integration, to avoid touching three separate
  dashboard-widget registration points for a small win.
- Completed-tasks view has no "load more"/pagination UI — server-capped at 100 rows,
  fine at current scale.
- `docs/PRD.md`'s top status line was stale since Round 2 (still said "no
  implementation has started" through Round 6) — corrected in Round 7. Worth a habit:
  keep it current per round rather than letting it drift again.

## Smaller items discovered during Round 8 (not yet sequenced into a round)

- `habits_due_today` nav badge counts `daily`-frequency habits only — no cross-dialect
  weekday function exists in the shared query layer for `weekdays`/`weekly` habits.
  Minor, documented undercount in a secondary nav affordance only. See
  `docs/FEATURE_UPGRADE_8.md` Known Debt.
- `users.week_start` was a stored-but-unused setting before this round; Habits is the
  first feature to actually honor it. The calendar's week view (hardcoded
  Monday-first) and the goal-snapshot weekly walker still don't — worth a consistency
  pass later, not done this round.
- Habit editing uses a `prompt()`-sequence flow, matching the existing reminder-
  category-rename pattern, rather than a richer inline form — fine for occasional
  edits, worth revisiting if that turns out to undersell the feature.
- Streak lookback is bounded at 365 days (a documented, currently-irrelevant trade-off
  — see `docs/FEATURE_UPGRADE_8.md` Streak Semantics).

## Smaller items discovered during Round 9 (not yet sequenced into a round)

- **A real, pre-existing, previously-undiscovered accessibility issue on the shared
  `#toast` component** (used on every page) — a serious color-contrast violation,
  reproduced deterministically, not resolved by waiting for the toast's `.show`
  class to clear. Not caused by this round; excluded from this round's E2E scan
  (`.exclude("#toast")`) rather than fixed. See `docs/FEATURE_UPGRADE_9.md` Known
  Debt for the investigation notes — worth a dedicated look in a future round or
  polish pass.
- No "load more"/pagination past Notes' 100-row cap — same pattern as Tasks/Habits.
- Note tags, contact/task/habit linking, and archive were all explicitly deferred
  per the round's own instructions; consolidating the 8 existing embedded notes
  fields into the new table was considered and explicitly rejected.
- Round 8's `frontend/src/features/habits/format.js` pure functions
  (`frequencyLabel`/`progressLabel`/`streakLabel`/`emptyStateMessage`) were never
  unit-tested (only the backend `habits.js` functions were) — noticed while adding
  Round 9's own frontend unit tests. Minor, zero-risk gap; not fixed here since it's
  out of Round 9's scope, noted for whoever next touches that file.
