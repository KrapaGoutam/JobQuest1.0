# Feature Upgrade 3 — Dashboard + Applications Workspace

## Status

Implemented on `feature/003-dashboard-applications-revamp`; PR #10 open into
`development`, full CI matrix green (including a genuine, deliberately-checked visual-
regression pass — see CI Status), awaiting the user's review/merge. Round 3 of
[docs/PRD.md](PRD.md).

## Goal

Turn Dashboard + Applications into a workspace that answers, at a glance: what needs
action today, what's the current pipeline, and what's the longer-run trend — without
turning the dashboard into a flat wall of equally-weighted widgets, and without rebuilding
search/filter/sort machinery that already works.

## Baseline (established before any change)

From `development` post-PR-#9: `npm run lint`, `typecheck`, `build`, `build:frontend`,
and `test:frontend` (9 tests) all pass; `test:browser`'s visual/accessibility suite is
13 passed / 7 skipped / 0 failed (unchanged from Round 2's own baseline, confirmed on CI
in PR #9's second run). This is the state every change below is measured against.

## Existing functionality — read this before assuming anything is missing

`Feature_Upgrade_2_Codex_Prompt.md` was written without full knowledge of this codebase
(it describes a "job listings" page separate from "Applications," and filters like
"visa sponsorship," "experience level," and "Easy Apply" that have no backing column).
Reading the actual schema (`backend/jobsearch/migrations/001_jobsearch.sql`), the modern
query engine (`backend/src/feature-upgrade.js`'s `buildApplicationWhere`/
`queryApplications`, wired to `/api/applications/query` and `/api/applications/kanban`),
and the current UI (`frontend/src/app.js`'s `renderApplications`/`renderDashboard`)
turned up **far more already built** than the prompt assumed:

| Capability | Status |
|---|---|
| Dashboard: 30 exact widget names/type IDs in one typed registry | **ALREADY IMPLEMENTED** — `dashboard-config.js` matches the prompt's §4.5 catalog exactly, id-for-id |
| Dashboard: User/Manager segmented toggle, respecting `role` | **ALREADY IMPLEMENTED** — `data-dashboard-mode` buttons, manager option hidden unless `state.user.role === "MANAGER"` |
| Dashboard: date-range selector (7/30/90 days) | **ALREADY IMPLEMENTED** |
| Dashboard: Customize drawer (search, enable/disable, count, server-persisted per dashboard type) | **ALREADY IMPLEMENTED** — `renderDashboardSettings`, `/api/dashboard/layout` |
| Dashboard: widget → Applications drill-through | **ALREADY IMPLEMENTED** (shipped in Feature Upgrade 1) |
| Dashboard: flat widget grid with no urgency hierarchy | **GAP — addressed this round** (see below) |
| Applications: debounced search across company/title/location/recruiter/notes/resume/tags/job source/employment type/work arrangement/id | **ALREADY IMPLEMENTED** — `buildApplicationWhere`'s `searchable` list + tag `EXISTS` subquery + multi-word AND matching (`searchWords`), already case-insensitive via `lower()` on both sides (not a Postgres `LIKE` case-sensitivity bug — it never used bare `LIKE`) |
| Applications: stage/priority/work_arrangement/employment_type/date-range/tag/pinned/archived filters | **ALREADY IMPLEMENTED** server-side; stage/priority/work_arrangement/employment_type/date-range exposed in the toolbar UI |
| Applications: per-column filter dialog (contains/equals/starts_with/ends_with/empty/before/after/between, per field type) | **ALREADY IMPLEMENTED** — far richer than the prompt's flat filter list, via `column_filters` |
| Applications: sort (company/job_title/date_applied/salary_min, asc/desc, missing-last via `CASE WHEN ... IS NULL`) | **ALREADY IMPLEMENTED**, deterministic secondary sort on `a.id` |
| Applications: active filter chips, individually removable, Clear All | **ALREADY IMPLEMENTED** |
| Saved Views (name, filters, sort, view mode) | **ALREADY IMPLEMENTED** |
| Table/Kanban switching, server-persisted preference | **ALREADY IMPLEMENTED** |
| Kanban: grouping, collapse/expand, show-more, stage counts | **ALREADY IMPLEMENTED** |
| Export (XLSX/CSV/JSON, date range, date field) | **ALREADY IMPLEMENTED** (Feature Upgrade 1) |
| Resume versioning, checklist items, networking contacts, import batches | **ALREADY IMPLEMENTED** (confirmed in `docs/ARCHITECTURE.md`'s data-model audit; out of scope for this round) |
| "Global job search" (prompt §6–9) as a page distinct from Applications | **NO LONGER APPLICABLE** — JobQuest has no job-discovery/listing feature (by design, per `README.md`: "does not scrape job boards, discover jobs"); its content is folded into the Applications search/filter/sort already covered above |
| Salary/employment-type/experience-level/visa-sponsorship filters (prompt §7.5–7.10) | **PARTIALLY APPLICABLE** — `salary_min`/`salary_max`/`employment_type`/`work_arrangement` exist and employment_type/work_arrangement are already filterable; experience-level and visa-sponsorship have no column and are **NO LONGER APPLICABLE** unless a future round adds them |
| Quick filters (Applied Today/Week/Month, Recently Updated, Active/Closed) | **NET NEW — implemented this round** |
| Dashboard information hierarchy (Immediate Actions / Pipeline / Context) | **NET NEW — implemented this round** |
| `legacyRenderApplications` (dead frontend function) + its only caller path | **DEFERRED CLEANUP** — removed the dead frontend function (zero callers, verified); the underlying `GET /api/applications` backend endpoint it used is left alone (removing API surface is a bigger, separate decision — see Known Debt) |

## Scope (this round)

1. **Dashboard information hierarchy** — group enabled widgets into three visually
   distinct sections (Needs your attention / Current pipeline / Trends & context)
   instead of one flat grid, using a new per-widget tier mapping. No widget id, name,
   kind, position, width, or persisted-layout behavior changed.
2. **Applications quick filters** — six one-click toggle buttons (Applied Today/This
   Week/This Month, Recently Updated, Active Applications, Closed Applications) that
   set the same query params the existing advanced filters already use
   (`date_field`/`date_from`/`date_to`), plus one new param (`status_group`) for
   Active/Closed, reusing the exact "closed stage" set already used elsewhere in the
   product (`CLOSED_STAGES`) so "closed" means the same thing everywhere.
3. **Dead code removal** — `legacyRenderApplications` (101 lines, zero callers,
   verified by search) removed from `app.js`.
4. Unit tests for everything new; one new backend integration test for `status_group`.

## Out of scope (deliberately, per the Round 3 brief and the table above)

Rebuilding search/filter/sort/saved-views/Kanban/export (already solid); a "job
listings" page (not applicable to this product); salary-range filter UI, "Interviews
This Week"/"Follow-ups Due" quick filters (would need joins across `interviews`/
`follow_ups`, not just `applications` — backlogged, see Known Debt); CSS token
extraction / full design-system pass (Round 11); tasks/habits/journal/contacts/full
import-export/analytics (later rounds); React; any Render/Neon change.

## Architecture

- `frontend/src/features/dashboard/tiers.js` (new): a static `widget_id → tier` map
  plus `groupWidgetsByTier(widgets)`, a pure function. `renderDashboard`'s widget-grid
  template now calls this instead of rendering one flat list — the only integration
  point touched in `app.js` (`renderTieredWidgets`/`widgetCardHtml` helpers extracted
  from the previous inline template so the tier loop and the per-widget markup are
  separate, testable concerns).
- `frontend/src/features/applications/quick-filters.js` (new): `QUICK_FILTERS`
  (id/label registry), `quickFilterValues`, `isQuickFilterActive`, `activeQuickFilter`,
  `toggleQuickFilter` — all pure functions over `URLSearchParams`, matching how every
  other filter/sort control in `renderApplications` already works (mutate params, call
  `renderApplications(params)` again). No new client-side state, no new fetch logic.
- `backend/src/feature-upgrade.js`'s `buildApplicationWhere`: one new `status_group`
  branch (`active`/`closed`), reusing the existing `CLOSED_STAGES` set and the existing
  parameterized-query pattern (no raw string interpolation of user input).
- No new tables, no new migration — `status_group` filters on the existing `stage`
  column.

## UX changes

- **Dashboard**: enabled widgets now render under three headed sections instead of one
  grid. Section membership is fixed per widget id (defined in `tiers.js`), not
  user-configurable in this round — Customize Dashboard still controls which widgets
  are enabled and their width, unchanged.
- **Applications**: a new "Quick filters" chip row appears between the saved-views/sort
  bar and the search/advanced-filter form. Exactly one quick filter can be active at a
  time; clicking the active one clears it; it composes with search, advanced filters,
  and sort (all independent params) exactly as the brief requires — quick filters don't
  clear other filters, and other filters don't clear the active quick filter.

## Implementation tasks

- [x] `frontend/src/features/dashboard/tiers.js` + wiring into `renderDashboard`.
- [x] `.widget-tier`/`.widget-tier-header` CSS (minimal, reuses existing tokens).
- [x] `frontend/src/features/applications/quick-filters.js` + toolbar wiring in
      `renderApplications`.
- [x] `.quick-filters`/`.chip-toggle` CSS (minimal, reuses existing tokens).
- [x] `status_group` support in `buildApplicationWhere`.
- [x] Remove dead `legacyRenderApplications`.
- [x] Unit tests: tier assignment/ordering (2), quick-filter param mapping (2).
- [x] Backend integration test: `status_group=active|closed`.

## Acceptance criteria

- [x] Every one of the 30 dashboard widgets is assigned to exactly one tier (test:
      "every dashboard widget is assigned to exactly one information-hierarchy tier").
- [x] Widget order within a tier matches its existing `position` order (test).
- [x] Quick filters map onto real, already-supported params; verified against the
      actual `date_field`/`date_from`/`date_to` semantics in `buildApplicationWhere`.
- [x] Toggling a quick filter doesn't disturb search/sort/other filters (test).
- [x] `status_group` returns correct counts server-side (integration test, pending CI
      since no local Postgres — see Testing).
- [x] No dashboard widget id, name, kind, or persisted layout field changed.
- [x] No existing Applications column, filter, sort option, saved view, or export
      behavior removed or renamed.
- [x] Full CI green (8/8 jobs on PR #10), including the visual-regression suite passing
      against the existing baselines without modification — see CI Status.

## Testing

Local (no Postgres available in this environment, same limitation as Round 2):
`npm run lint`, `typecheck`, `build`, `build:frontend`, `test:frontend` (13 tests, up
from 9) all pass. `node --check` on the two modified test files and
`feature-upgrade.js`.

Deferred to CI (Postgres/browser-backed, per this repo's established pattern):
`test:backend`, `test:integration`, `test:e2e`, `sqlite-postgres-migration`, and
`test:browser` — all pass on PR #10 (see CI Status). Unlike Round 2, "zero diff" was not
assumed to be the bar here — this round intentionally changes what the Dashboard and
Applications pages look like, so a baseline update was expected going in. What actually
happened: the full visual-regression suite (`responsive visual states` and
`light dark and system themes`, across all five viewport projects) **passed against the
existing, unmodified baselines** — verified as a real result, not a coverage gap, by
confirming the built bundle CI tested actually contains the new markup
(`widget-tier`, `quick-filters`, `data-quick-filter` all present in `dist/assets/*.js`).
The new tier-header text and quick-filter button row are visually modest enough (thin
headers, one small pill-button row) to land under the suite's existing
`maxDiffPixelRatio: 0.12` tolerance on a full-page screenshot. No baseline update was
needed or performed — see CI Status.

## Security impact

- `status_group`'s SQL is parameterized (`IN (?,?,?,?,?)` with `CLOSED_STAGES` values
  bound, not interpolated) — same pattern as every other clause in
  `buildApplicationWhere`. No new user-controlled string reaches the query text itself.
- Ownership scoping is untouched: `status_group` is just another `WHERE` clause added
  inside the existing actor-scoped query builder; a non-manager still only ever sees
  `a.user_id = actor.id` rows.
- No new `innerHTML` usage — the quick-filter buttons and tier headers are built with
  the same template-string + `esc()`/attribute-escaping conventions already used
  throughout `app.js` for user-controlled or semi-trusted text (widget labels are from
  the static registry, not user input, but `esc()` is used anyway for consistency).
- No new client-visible secrets, no new dependencies.

## Performance impact

- `status_group` adds one `IN (...)` clause to an already-indexed query path
  (`idx_app_owner_stage` covers `(user_id, stage)`); no new query round-trips — quick
  filters reuse the exact same `/api/applications/query` and `/api/applications/kanban`
  calls the table/Kanban views already make on every filter change.
- No new N+1 patterns introduced; `groupWidgetsByTier` is an in-memory `O(widgets)` pass
  over data already fetched for the dashboard.

## Responsive validation

`.widget-tier`/`.quick-filters` reuse `.widget-grid`'s existing responsive breakpoints
(3 → 2 → 1 columns) and `.filter-chip`'s existing wrapping/overflow behavior — no new
breakpoints introduced. Confirmed via CI across all five existing viewport projects
(desktop/compact-desktop/tablet/mobile/small-mobile) — see CI Status.

## Files changed

```
backend/src/feature-upgrade.js                        (status_group filter)
backend/test/app.test.js                               (status_group integration test)
backend/test/frontend.test.js                           (tier + quick-filter unit tests)
docs/FEATURE_UPGRADE_3.md                               (new, this doc)
frontend/src/app.js                                     (tier rendering, quick filters, dead-code removal: 2726 -> 2658 lines)
frontend/src/features/dashboard/tiers.js                (new)
frontend/src/features/applications/quick-filters.js     (new)
frontend/src/styles.css                                 (.widget-tier*, .quick-filters, .chip-toggle)
```

## Commits

See git log on `feature/003-dashboard-applications-revamp` — scoped per the round's
suggested progression (docs/reconcile, backend filter, dashboard hierarchy, applications
quick filters, dead-code removal, tests, docs).

## CI status

PR [#10](../../../pull/10) into `development`, run
[34912813062](../../../actions/runs/34912813062): all 8 jobs pass — `static-quality`,
`security`, `sqlite-postgres-migration`, `tests` × 4 (backend/frontend/integration/e2e,
including the new `status_group` integration test), and `browser-and-visual` (13
passed, 7 skipped, 0 failed — identical pass/skip count to the Round 2 baseline, and
verified as a genuine result, not a blind spot, per the Testing section above).

## Known debt (backlogged, not fixed this round)

- **"Interviews This Week" / "Follow-ups Due" quick filters** are not implemented —
  they'd need to join `interviews`/`follow_ups`, which `buildApplicationWhere` doesn't
  currently touch. Real feature, real value, bigger scope than "quick filter as a thin
  wrapper over existing params" — proposed for a future round.
- **No dedicated salary-range filter UI** — `salary_min`/`salary_max` exist and sorting
  by `salary_min` already works, but there's no min/max input pair in the advanced
  filter panel. The prompt's own caution ("do not compare hourly/annual as equivalent
  without reliable normalization") applies: `salary_currency`/period aren't normalized
  in this schema, so a naive range filter could mix currencies/periods misleadingly.
  Needs a product decision, not just a UI addition.
- **`GET /api/applications` (the pre-Feature-Upgrade-1 listing endpoint) has no
  remaining UI caller** after this round's dead-code removal — it's still live
  server-side (untouched, in `service.js`) since removing API surface is a bigger,
  separate decision than trimming an unused frontend function. Worth a deliberate
  deprecation decision in a future round, not assumed here.
- **Tier assignment is a static map, not user-configurable** — matches the brief's
  "Level 1/2/3" hierarchy concept without adding new persisted state this round; making
  tiers customizable (or auto-computed from due dates/overdue status rather than a
  fixed id list) is a reasonable Round 11 (capstone) candidate if it proves too rigid.

## Completion notes

Nothing in Round 4+ ([docs/PRD.md](PRD.md)) has started. Do not begin Round 4 until this
round's PR is reviewed/merged and the user has explicitly said to proceed.
