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
| 9 | Journal / notes — genuinely net-new `notes` table, distinct from the 8 existing domain-specific notes fields (left untouched); search, type/pinned filters, optional application link, safe plain-text rendering — see `docs/FEATURE_UPGRADE_9.md` | Merged (PR #16) |
| 10 (FINAL) | Analytics + Capstone Hardening — Analytics page, full backlog reconciliation, UI/UX + design-system capstone, accessibility root-fix, formal security audit, performance audit, refactor/dead-code pass, full regression validation, `development`-vs-`main` integration plan + release notes — see `docs/FEATURE_UPGRADE_10_FINAL.md` | Implemented locally; PR pending |
| 11 | Browser Capture Extension — Manifest V3 extension, token management, duplicate detection, generic career page heuristics, canonical workflow actions alignment, deep-linking — see `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md` | Pre-merge stabilization complete; PR #20 open |

Not sequenced, on request only: `docs/design/STITCH_PROMPT.md` (Google Stitch prompt
package, plan-only).

## Smaller items discovered during Round 3 (not yet sequenced into a round)

- "Interviews This Week" / "Follow-ups Due" quick filters (need `interviews`/
  `follow_ups` joins — bigger than a params-only quick filter). See
  `docs/FEATURE_UPGRADE_3.md` Known Debt.
- Salary-range filter UI — blocked on a product decision about currency/period
  normalization, not just a UI gap. See same doc.
- ~~Decide whether to deprecate `GET /api/applications`...~~ — **re-verified in Round
  10 (Phase 10G) and found false**: it has three live frontend callers (the tracker,
  tasks, and note editors' application picker) plus the entire backend/E2E test
  suite. Not deprecated.

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
- ~~`#detail-stage` has no accessible name~~ — **fixed in Round 10** (Phase 10D:
  `aria-label="Change application stage"`).
- Cross-group checklist reordering has no visible effect in the grouped display (group
  membership is decided by label, not `position`) — not a bug, but worth knowing if the
  grouping/reorder interaction is ever revisited. See `docs/FEATURE_UPGRADE_4.md`.

## Smaller items discovered during Round 5 (not yet sequenced into a round)

- ~~Edit UI gap for interviews/rejections/follow_ups/daily_goals/weekly_goals~~ —
  **fixed in Round 10** (Phase 10B: `renderTracker`'s `editable` flag is now always
  `true`; also fixed two real bugs this surfaced — checkbox handling and the
  generic tracker API's response shape).
- No accessibility audit of the other `renderTracker`-based pages (interviews,
  rejections, follow_ups, goals, resumes, reminders) — partially addressed by
  Round 10's broader Phase 10D sweep; not every one was individually, exhaustively
  scanned. Remaining gap accepted as V2 debt.
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
- ~~`import_rows` has no dedicated index on `batch_id`~~ — **fixed in Round 10**
  (Phase 10F: composite `(batch_id, row_number)` index, migration `012`).
- The Edit-UI gap noted in Round 5 — **fixed in Round 10**, see above.
- ~~A non-reproducible, coincidental PIN-hash test flake...~~ — **fixed in Round 10**
  (Phase 10H/10I: root-caused as a flawed assertion testing a non-security-relevant
  property; removed).

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
  category-rename pattern, rather than a richer inline form — evaluated app-wide in
  Round 10 (Phase 10G: this pattern is used consistently in 11 places, not just
  habits); kept as-is, a shared modal component is a real V2.1+ candidate, not a
  defect.
- Streak lookback is bounded at 365 days (a documented, currently-irrelevant trade-off
  — see `docs/FEATURE_UPGRADE_8.md` Streak Semantics).

## Smaller items discovered during Round 9 (not yet sequenced into a round)

- ~~A real, pre-existing, previously-undiscovered accessibility issue on the shared
  `#toast` component...~~ — **fixed in Round 10** (Phase 10D: a `visibility`-
  transition CSS fix, at the root, not an exclusion).
- No "load more"/pagination past Notes' 100-row cap — same pattern as Tasks/Habits.
  Accepted as V2 debt (Round 10 triage).
- Note tags, contact/task/habit linking, and archive were all explicitly deferred
  per the round's own instructions; consolidating the 8 existing embedded notes
  fields into the new table was considered and explicitly rejected.
- ~~Round 8's `frontend/src/features/habits/format.js` pure functions... were never
  unit-tested~~ — **fixed in Round 10** (Phase 10I prep).

## Smaller items discovered during Round 10 (FINAL) (not yet sequenced into a round)

- **Several `toast(); render*();` call sites in `app.js` don't `await` the
  re-render** (e.g. the Tasks page's "Add task" submit handler) — real, confirmed
  application-level debt, not just a test artifact; caused a genuine, reproducible
  E2E failure this round (fixed at the test level). A full audit of every such call
  site is separate, larger work than this round's validation phase. See
  `docs/FEATURE_UPGRADE_10_FINAL.md` Known Deferred Debt.
- `users.week_start` inconsistency (calendar week view and the goal-snapshot weekly
  walker still don't honor it, only Habits does) — evaluated in Phase 10C,
  deliberately not changed this round; touches two other mature features' date
  math.
- JSON restore for the full-workspace backup export, and a downloadable
  error-report CSV for import batches — both real, both small-to-medium, neither
  sequenced into any round yet.
- Dashboard checklist-progress integration — deferred again (real N+1 risk without
  a deliberate query shape; no measured user need yet).
- Two latent, unconfirmed E2E locator issues were surfaced (not caused) while
  investigating an unrelated test fix and are flagged, not chased further, since
  the specific test line that could trigger either was reverted — see Phase 10H
  notes in `docs/FEATURE_UPGRADE_10_FINAL.md`.

## Items discovered / deferred during Round 11 (Browser Extension)

- **Deferred: JobRight.ai dedicated capture adapter and SPA validation.**
  Reason: Pre-merge stabilization is focused on duplicate correctness, resume handling, authentication/error-state separation, stale-state prevention, and existing supported extraction paths. Future work should first inspect JobRight's rendered DOM/structured data using Playwright/DevTools before deciding whether a dedicated adapter is required.

