# Cross-project decisions

## 2026-09-14 — Stack direction: build step, not React

**Decision**: keep the vanilla JS frontend; introduce a build step (Vite, Round 2)
rather than migrating to React + shadcn/ui + Radix + Framer Motion.

**Why**: the initial revamp brief assumed a React/shadcn stack, but the real codebase is
a mature, no-build vanilla JS app with strong existing CI/test/security coverage. A full
framework migration would be a ground-up rewrite, high risk to a working production app,
and directly conflicts with "preserve all working behavior." A build step gets the
maintainability win (modules instead of one 2726-line file) without that risk.
**Rejected alternative**: full React migration — kept as a documented option in
`docs/PRD.md` history if ever revisited, not pursued now.

## 2026-09-14 — Documentation: hybrid lightweight scaffolding, not full Spec Kit

**Decision**: keep one `docs/FEATURE_UPGRADE_0N.md` per round (existing repo style)
instead of a `SPEC.md`/`PLAN.md`/`TASKS.md`/`TESTS.md`/`DECISIONS.md` folder per feature.
Add only `AGENTS.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`,
`docs/TEST_PLAN.md`, `tasks/{CURRENT_TASK,BACKLOG}.md`,
`brain/{PROJECT_STATE,DECISIONS,AGENT_HANDOFF_LOG}.md` as the cross-agent layer.

**Why**: user's explicit call — "agent continuity without documentation bureaucracy."
Spec Kit is evaluated selectively per round, not forced repo-wide.

## 2026-09-14 — Branching: use `development` as the integration branch, not `revamp/v2-platform`

**Decision**: feature branches for each round are `feature/<round>-<slug>` off
`development`, merged back via PR — matching the repo's existing, already-working
convention (`feature/dashboard-applications-reskin`,
`feature/upgrade-lovable-ui-reference`, etc., all merged through `development` → `main`).
No separate `revamp/v2-platform` branch was created.

**Why**: the original brief's `revamp/v2-platform` instruction assumed no integration
branch existed yet; this repo already has one, actively used, with CI wired to it. Adding
a second long-lived integration branch would fragment history and CI coverage for no
benefit. **This is a deviation from the literal brief — flagged here for the user to
override if they actually want the extra branch layer.**

## 2026-09-14 — Round ordering: build tooling before the already-spec'd dashboard/applications round

**Decision**: Round 2 (build tooling) ships before Round 3 (dashboard/applications
redesign), even though Round 3 is already fully specified and "ready."

**Why**: Round 3 is a large rewrite of the dashboard/applications UI. Doing it once,
on the new module structure, is cheaper than doing it on the old monolith and then
refactoring the same code into modules immediately after.

## 2026-09-14 — Merge PR #9 as a regular merge, not squash (correcting PR #8)

**Decision**: PR #9 (Round 2) was merged into `development` with a regular merge commit.
PR #8 (planning foundation) had been squash-merged, which turns out to be a deviation
from this repo's actual established convention — its own git history (PRs #1-#7) uses
regular merge commits throughout ("Merge pull request #N from ..."), never squash.

**Why the correction**: the Round 3 brief explicitly said "use the repository's normal
merge strategy... do not squash/rewrite history unless that is the repository's
established policy," which prompted re-checking — the policy is regular merges. Left
PR #8's already-merged squash commit as-is (rewriting merged history is a much bigger,
separate decision, not undertaken here) but every merge from here on follows the real
convention.

## 2026-09-14 — Several "new" product-brief features already exist; scope only the gap

**Decision**: Rounds 4 (checklist), 5 (contacts), 6 (import/export) are scoped as
audit-then-gap-close, not net-new builds.

**Why**: the migrations already define `checklist_items`, `networking_contacts`,
`import_batches`/`import_rows`/`export_preferences`, and the backend already wires them
up (confirmed in `service.js`/`advanced.js`/`feature-upgrade.js`). Building these "from
scratch" per the original brief would duplicate real, working functionality.

## 2026-09-14 — Round 3: most of Feature_Upgrade_2_Codex_Prompt.md's wishlist already shipped

**Decision**: Round 3 implemented only two genuinely new things (dashboard information
hierarchy, Applications quick filters) plus one `status_group` backend addition and one
dead-code removal, instead of building out the full search/filter/sort/dashboard-redesign
scope the draft prompt describes.

**Why**: reading the actual schema and the current query engine
(`feature-upgrade.js`'s `buildApplicationWhere`/`queryApplications`) showed search,
filters (including a rich per-column operator system well beyond the draft's ask),
sort, saved views, Kanban, and export are already built and working — see the full
reconciliation table in `docs/FEATURE_UPGRADE_3.md`. The draft prompt also describes a
"global job search" / "job listings" page as distinct from "Applications" — JobQuest has
no such page (by design: it doesn't discover or scrape jobs), so that entire section
(§6-9 of the draft) is marked NO LONGER APPLICABLE rather than built as a duplicate
feature. Building any of the already-working pieces again would have been wasted,
regression-risking effort for no product benefit.

## 2026-09-14 — Round 3: quick filters as thin param wrappers, not a new query layer

**Decision**: `frontend/src/features/applications/quick-filters.js` only computes
`date_field`/`date_from`/`date_to`/`status_group` values and hands them to the exact
same `URLSearchParams` → `renderApplications(params)` flow every other filter already
uses. No new client-side filtering, no new fetch call, no parallel state store.

**Why**: four of the six quick filters (Applied Today/Week/Month, Recently Updated)
needed zero backend changes — `date_field=updated_at` was already a supported value.
Only "Active"/"Closed" needed one new `status_group` branch in `buildApplicationWhere`,
reusing the existing `CLOSED_STAGES` set. Treating quick filters as "just another way to
set the params the server already understands" kept the change small and impossible to
drift out of sync with the advanced filter panel.

## 2026-09-14 — Round 4: stage-aware checklist *display* now, *generation* deferred

**Decision**: group the existing flat, one-shot-generated default checklist items by
lifecycle phase for display (`frontend/src/features/checklist/groups.js`, a pure
read-time transform, no schema change). Did **not** make item *generation* stage-aware
(e.g. only creating "Interview prepared" once an application reaches Interview stage).

**Why**: the current architecture never touches `checklist_items` after creation —
no hook exists on stage change. Making generation stage-aware safely would need either
fragile label-string matching or a schema change (e.g. a `stage_hint` column) to track
which stage a default belongs to, plus careful handling to never duplicate an item a
stage-change handler had already inserted and never delete a user's completed work.
That's real, separable scope with real duplicate-generation risk — exactly the
"document and defer" case the Round 4 brief describes for cases that can't be done
cleanly with the current schema. The display-only grouping captures most of the
organizational value with none of that risk.

## 2026-09-14 — Round 4: checklist reorder is a position swap, not free-form drag-and-drop

**Decision**: `PATCH /api/applications/:id/checklist/:itemId/move` takes
`{direction: "up"|"down"}` and swaps `position` with the adjacent item server-side —
mirroring `ui-utils.js`'s existing `moveWidget` pattern for dashboard widgets — rather
than accepting a client-computed target position or introducing drag-and-drop.

**Why**: the Round 4 brief explicitly suggested simple ordering controls may be
preferable to drag-and-drop for this feature, and a server-side adjacent swap can never
produce a colliding/duplicate position value (a client-sent arbitrary position could).
No new dependency, no new interaction pattern to learn — reuses one already in the
codebase.

## 2026-09-17 — Round 7: Tasks is a distinct domain from the pre-existing Reminders, not an extension of it

**Decision**: build a genuinely new `tasks` table/API/UI rather than extending the
existing `reminders`/`reminder_categories` feature (Feature Upgrade 1) to also cover
undated backlog work. Made with the user's explicit input mid-round, after the audit
surfaced the overlap (see `docs/FEATURE_UPGRADE_7.md` "Domain Boundaries" and "Existing
Related Functionality" for the full reconciliation).

**Why**: the Round 7 brief's premise ("genuinely net-new, no `tasks` table exists") was
correct about the table, but the brief was written without visibility into `reminders`,
which already covers most of the same surface — due date, priority, status, completion,
a derived Overdue/Due Today/Upcoming state, and even automatic application-linking (a
follow-up's creation already auto-creates a reminder). The one thing `reminders`
structurally cannot do is represent an undated task: its `due_date` column is `NOT
NULL`, by design, because reminders exist to notify you of something at a specific
time — extending that column to nullable and bolting Backlog/Inbox semantics onto a
mature, tested, nav-visible, dashboard-integrated feature would have been a riskier,
larger change than standing up one new table, for a smaller net simplification. Two
small, single-purpose features stay easier to reason about than one feature doing two
jobs. No data migrates between the two; they remain independent going forward unless a
future round finds a concrete reason to unify them.

**Rejected alternative**: extend `reminders` (nullable `due_date`, dual-purpose
"Reminder Center" as the Tasks workspace) — considered, rejected for the reasons above.
