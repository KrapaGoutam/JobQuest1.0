# Agent handoff log

Only meaningful handoffs go here — not routine work.

## 2026-09-14 — Claude Code (Claude Sonnet 5) — planning foundation established

Ran Phase 0 discovery (read-only) against a large multi-phase revamp brief pasted by the
user, found a significant mismatch between the brief's assumed stack (React/shadcn/
Radix/Framer Motion, full Spec Kit multi-agent scaffolding) and the real repo (mature
vanilla JS + Node + Neon/Render app with real CI/security/testing). Surfaced that via
three clarifying questions before writing anything beyond the audit. User decisions:
build step instead of React, hybrid-lightweight docs instead of full Spec Kit, full
phased roadmap before any implementation. Produced: `CURRENT_STATE_AUDIT.md`,
`AGENTS.md`, `docs/PRD.md` (Rounds 2–11), `docs/ARCHITECTURE.md`, `docs/SECURITY.md`,
`docs/TEST_PLAN.md`, `tasks/`, `brain/`. All on branch `docs/v2-planning-foundation`,
not yet committed/pushed at end of this session's work.

**For the next agent**: nothing has been implemented yet. Read
`tasks/CURRENT_TASK.md` first. Do not assume checklist/contacts/import-export are
net-new — they already exist; see `brain/DECISIONS.md`.

## 2026-09-14 (same day, continued session) — Claude Code (Claude Sonnet 5) — Round 2 implemented

Merged the planning-foundation PR (#8) into `development` after fixing a self-inflicted
CI failure (`docs/SECURITY.md` quoted the repo's own secret-detection regex verbatim,
tripping it). Then implemented Round 2 (frontend build tooling) on
`feature/002-frontend-build-tooling`: Vite build for the existing vanilla-JS frontend,
`frontend/src`+`frontend/public` layout, backend now serves `frontend/dist`, Render
build command and CI updated, no React/HMR introduced. Full detail and rationale in
`docs/FEATURE_UPGRADE_2.md`.

**For the next agent**: the branch is implemented and locally verified but **not yet
pushed, no PR open, CI has not run on it**. Do that first (push, open PR into
`development`, confirm all 8 jobs green including zero visual-regression diffs) before
trusting this round is actually done. Do not start Round 3 without the user's explicit
go-ahead — see the stop condition recorded in `tasks/CURRENT_TASK.md`.

## 2026-09-14 (same day, continued session) — Claude Code (Claude Sonnet 5) — Round 3 implemented

Merged PR #9 (regular merge, correcting PR #8's squash — see `brain/DECISIONS.md`).
Reconciled `Feature_Upgrade_2_Codex_Prompt.md` against the real codebase: most of its
search/filter/sort/export/saved-views wishlist was already implemented (full table in
`docs/FEATURE_UPGRADE_3.md`). Implemented the two real gaps — dashboard 3-tier
information hierarchy and Applications quick filters (with one new `status_group`
backend param) — plus removed one dead frontend function. On
`feature/003-dashboard-applications-revamp`, off `development`.

Pushed, PR #10 opened into `development`, full CI matrix green — including the
visual-regression suite, which passed against the **existing, unmodified baselines**
(verified as genuine by confirming the tested bundle contains the new markup, not a
coverage gap: the tier headers/quick-filter row are visually modest enough to land
under the suite's 12% pixel-diff tolerance). No baseline update was needed.

**For the next agent**: PR #10 is ready and green but **not merged** — left for the
user's review, per the Round 3 stop condition. Do not start Round 4 without the user's
explicit go-ahead.

## 2026-09-14 (same day, continued session) — Claude Code (Claude Sonnet 5) — Round 4 implemented

Merged PR #10 (regular merge, per convention). Audited the checklist feature end-to-end
before writing anything: schema/create/complete/progress/ownership were already solid;
edit, delete, reorder, and input validation genuinely did not exist (no DELETE route at
all). Closed those gaps, added a read-time-only lifecycle-phase grouping module
(deliberately not stage-aware *generation* — real duplicate-generation risk, deferred),
and added the checklist test coverage that didn't previously exist. On
`feature/004-application-checklist-gap-close`, off `development`.

Pushed; first CI run failed on Postgres (a real dialect bug in the new `completed_at`
`CASE` — fixed, verified against a local throwaway Postgres container). Added real
Playwright E2E coverage for checklists (none existed), run locally (Chromium install
worked fine in this environment) across all 5 viewports before trusting CI with it —
which surfaced and got fixed: one real new a11y violation from this round's own Delete
button, and two pre-existing unrelated ones on the same page (one-line fixes, done in
passing); a third pre-existing one (`#detail-stage`) was deliberately left alone and
backlogged rather than expanding into an unrelated page audit. Also corrected a wrong
assumption carried from Rounds 2/3: Docker (and Playwright browser installs) are
available in this environment — use them to verify locally rather than only trusting CI
round-trips. PR #11 opened into `development`, full CI matrix green (8/8 jobs, 18
passed/7 skipped/0 failed across 25 browser tests).

**For the next agent**: PR #11 is ready and green but **not merged** — left for the
user's review, per the Round 4 stop condition. Do not start Round 5 without the user's
explicit go-ahead.

## 2026-09-14 (same day, continued session) — Claude Code (Claude Sonnet 5) — Round 5 implemented

Merged PR #11 (regular merge, per convention). Audited `networking_contacts`
end-to-end: backend CRUD/ownership/IDOR/mass-assignment protection was already fully
correct - zero backend changes needed. The real gap was frontend: the "Link Contact"
button on an application's detail page navigated to a form with no application field at
all (a select-rendering branch already existed for it, just never triggered - the field
was missing from the type's field list), so links could never actually be completed;
there was also no Edit UI, no contacts shown on the application detail page, and
LinkedIn/email rendered as inert text. Closed all of that, plus fixed one real
pre-existing shared a11y bug (table() wrapper not keyboard-focusable) found while
testing. On `feature/005-contacts-networking-gap-close`, off `development`.

Pushed; PR #12 opened into `development`, **all 8 CI jobs green on the first push** —
no fix round needed this time, because the real local Postgres/Chromium validation
established in Round 4 and reused here caught the one real bug (the focusability issue)
before it ever reached CI. Docker (real Postgres) and a local Chromium install are both
confirmed available in this environment - use them for any SQL- or browser-UI-touching
round rather than relying on CI alone.

**For the next agent**: PR #12 is ready and green but **not merged** — left for the
user's review, per the Round 5 stop condition. Do not start Round 6 without the user's
explicit go-ahead.

## 2026-09-16 — Claude Code (Claude Sonnet 5) — Round 6 implemented

Merged PR #12 (regular merge, per convention). Audited import/export end-to-end: the
preview/validation/duplicate-detection/transaction pipeline was already exceptionally
solid (both partial-failure models already implemented and tested, XLSX already had
formula-injection protection). Found and fixed two real security gaps - every CSV
export had zero formula-injection protection (only XLSX did), and job_url accepted
javascript:/data: as "valid" on both manual entry and import, rendered as a clickable
link with no further check - plus closed one real missing capability (CSV import
didn't exist at all) and surfaced one existing-but-invisible one (import batch
row-level detail was written but never read back; "Import History" was manager-only in
the nav despite the API already working for everyone). On
`feature/006-import-export-hardening`, off `development`.

Note: Docker Desktop wasn't running at the start of this session - `docker ps` failed
until the process was started and the daemon polled for readiness. Worth checking
before assuming Docker is unavailable in a future round.

Pushed; PR #13 opened into `development`. First two CI pushes both failed
`browser-and-visual` on a *different, random* viewport each time - the same error, a
pre-existing (Round 5) non-exact `getByRole("heading", {name:"Networking"})` assertion
ambiguous against two headings on one page. Never reproduced locally (4/4, then 5/5
across all viewports). Fixed with `exact: true`; CI went green on the very next push.
Full CI matrix green (8/8 jobs, 28 passed/7 skipped/0 failed across 35 browser tests).

**For the next agent**: PR #13 is ready and green but **not merged** — left for the
user's review, per the Round 6 stop condition. Worth remembering: a Playwright locator
that "usually" resolves an ambiguous match to one element isn't safe - prefer `exact:
true` whenever two elements could plausibly share a substring, rather than relying on
it never mattering in practice (see `brain/PROJECT_STATE.md` for the fuller note). Do
not start Round 7 without the user's explicit go-ahead.

## 2026-09-17 — Claude Code (Claude Sonnet 5) — Round 7 implemented

Merged PR #13 (regular merge, per convention). Audited every task-like domain before
writing any schema, per the round's own instruction. The real finding: `reminders`
(Feature Upgrade 1) already covers most of what "Task management" was scoped to build
- due date, priority, status, completion, a derived Overdue/Due Today/Upcoming state,
even automatic application-linking. The round's own PRD brief said "genuinely net-new,
no `tasks` table exists" - true about the table, but written without visibility into
how close `reminders` already was. This was a real product-direction fork (not a
routine implementation detail), so it was surfaced to the user mid-round rather than
guessed at. Decision: Tasks stays a **distinct** domain, because `reminders.due_date`
is `NOT NULL` by design (it's a notification system) and cannot represent an
unscheduled Backlog item without changing a mature, tested, already-shipped feature -
see `brain/DECISIONS.md` for the full reasoning.

Implemented: new `tasks` table (`009_task_management.sql`), `backend/src/tasks.js`
(CRUD, ownership + application-linking ownership checks, recurrence), four views
(deliberately merged the brief's separate Inbox/Backlog into one - both resolve to the
identical "no due date" predicate, and splitting them would have added a distinction
with no real difference), a "Linked Tasks" panel on the application detail page, a nav
entry + badge count, and CSV/JSON export inclusion. On `feature/007-task-management`,
off `development`.

Verified with the same rigor as every prior round: real Postgres (Docker was already
running this session, unlike Round 6) - 26/26 backend tests including 3 new; real
Chromium - new E2E spec 5/5 viewports. Found and fixed one real bug while writing the
E2E spec (introduced and fixed within this same round, not pre-existing): clicking a
task-view tab triggers an async re-render, and interacting with the form immediately
after could land on the old, about-to-be-replaced DOM (both renders share a field
label, so Playwright doesn't need to wait). Fixed with `aria-pressed` on the tab
buttons, used as a real settle point - a genuine accessibility improvement, not only a
test hook. Also fixed, in passing: `docs/PRD.md`'s top status line had been stale
since Round 2 (still said "no implementation has started" through Round 6).

**For the next agent**: PR #14 was reviewed and merged (regular merge) at the start of
the Round 8 session. Worth remembering: a locator that resolves without a strict-mode
error still isn't automatically safe if it can resolve to a *stale* element from an
async-render race, not just an *ambiguous* one (the Round 6 lesson was specifically
about ambiguity) - wait for a real signal the new render landed, e.g. `aria-pressed`.
Also: nav buttons with a pending-count badge change their accessible name once the
badge appears ("Tasks" -> "Tasks 1 pending") - don't use `exact: true` on one after
triggering its badge condition.

## 2026-09-17 (same day, continued session) — Claude Code (Claude Sonnet 5) — Round 8 implemented

Merged PR #14 (regular merge, per convention). Audited Goals (`goal_settings`/
`goal_snapshots`), Tasks' recurrence, and Reminders before writing any schema, per the
round's own instruction. Unlike Round 7, this audit *confirmed* the brief's assumed
domain boundaries rather than overturning them: Goals are fixed, hardcoded KPI
categories computed *from other tables* (never user-logged directly - `actualFor()`
counts rows in `applications`/`follow_ups`/etc.), Tasks' recurrence advances to a new
row with no per-row history or streak concept, Reminders have no repetition at all.
Habits genuinely needed its own domain - a user-owned completion log is the one thing
none of the three provide. No new `brain/DECISIONS.md` entry was needed this round,
since no brief-vs-reality conflict arose to resolve (contrast Round 7's Tasks-vs-
Reminders fork).

Implemented: new `habits`/`habit_logs` tables (`010_habit_tracker.sql`),
`backend/src/habits.js` (CRUD, ownership checks, idempotent progress upserts, derived
streaks reusing the same computational shape as the existing Goals `comparison()`
streak helper), three frequencies (daily/weekdays/weekly - no monthly, not requested
by any brief example), and one unified completion model for boolean and count habits
(one row per habit/date storing an absolute value, upserted via
`ON CONFLICT ... DO UPDATE`, making progress writes inherently retry-safe). Reused
`users.week_start` - a setting that existed but was previously unconsumed anywhere -
for weekly habits' period boundaries. On `feature/008-habit-tracker`, off
`development`.

Verified with the same rigor as every prior round: real Postgres - 29/29 backend tests
including 3 new; real Chromium - new E2E spec 5/5 viewports. Hit (and correctly
diagnosed, not mistook for a real bug) a stale-container artifact mid-session:
re-running the backend suite against the same already-migrated Postgres container a
second time fails every test on a username-uniqueness collision - expected, since
fixed test usernames collide against leftover rows; reset the container between
manual passes, the way CI's fresh service container does automatically. Also found and
fixed two real (not pre-existing) Playwright bugs while writing the E2E spec, both new
instances of Round 6/7 lesson shapes: rapid `+`/`-` clicks on a count habit's controls
raced their own async re-render exactly like Round 7's tab-click race (fixed by
awaiting each click's settled result before the next); an unscoped
`getByText("Weekly")` matched both a habit row and the create form's own "Weekly"
option (same shape as the Round 6 ambiguous-heading lesson, fixed by scoping to
`#habit-list`). Also confirmed by hitting it (not just reading about it) and then
followed an existing documented pattern: this app has no URL-based routing, so
`page.reload()` always lands back on Dashboard for every page, not just Habits -
verified persistence via a direct API call instead, matching the Round 4 checklist
test's already-documented approach.

**For the next agent**: PR #15 was reviewed and merged (regular merge) at the start of
the Round 9 session.

## 2026-09-17 (same day, continued session) — Claude Code (Claude Sonnet 5) — Round 9 implemented

Merged PR #15 (regular merge, per convention). Audited every notes-like field before
writing any schema: `applications.notes`, three separate fields on `interviews`, plus
`rejections`, `networking_contacts`, `follow_ups`, `resumes`, `weekly_goals`, and
`tasks` all have their own embedded free-text fields. None were touched, migrated, or
consolidated - they stay exactly as they are, per the round's explicit instruction not
to destabilize mature domains. Confirmed (not assumed) no pre-existing `notes`/
`journal` table or markdown/rich-text/sanitizer dependency exists anywhere, so this
really is genuinely net-new - unlike Round 7, no product-direction fork was needed
this round.

Implemented: one new `notes` table (`011_journal_notes.sql` - nullable `title` with an
"at least one of title/body" validation, a 5-value `note_type` enum, nullable
`application_id` with `ON DELETE SET NULL`, `pinned`), `backend/src/notes.js` (CRUD,
search reusing the exact `lower(field) LIKE lower(?)` pattern the Applications search
already established - proven cross-dialect, no `ILIKE`-only Postgres syntax needed),
list responses returning a truncated `body_preview` rather than full bodies (a
dedicated `GET /api/notes/:id` for the full note), and a compact "Notes" panel on the
application detail page. Plain text only - no Markdown/rich-text/sanitizer dependency;
safety comes entirely from the existing `esc()` helper plus CSS `white-space:
pre-wrap` for multi-line formatting. On `feature/009-journal-notes`, off
`development`.

Note: Docker Desktop wasn't running at the start of this session (unlike Round 8) -
started it manually, same recovery as Round 6.

Verified with the same rigor as every prior round: real Postgres - 31/31 backend
tests including 2 new; real Chromium - new E2E spec 5/5 viewports. Found a real,
pre-existing, previously-undiscovered accessibility issue while writing the E2E spec
(not introduced by Round 9): a serious color-contrast violation on the shared
`#toast` component, reproduced deterministically by a scan run right after a
delete-triggered toast. Investigated properly before concluding anything -
`--sidebar`/`--sidebar-foreground` (the tokens `#toast` uses) are a properly
high-contrast pair in both theme blocks in `styles.css`, and waiting for the toast's
`.show` class to clear did *not* resolve it either (axe still flagged it at rest).
Excluded from this round's scan (`.exclude("#toast")`, matching the existing
`.exclude(".goal-chart")` precedent) rather than attempting to fix a shared,
every-page component inside a Notes-focused round - documented for a future
dedicated look.

**For the next agent**: [fill in PR number/state once pushed and opened]. Worth
remembering: axe can still flag an `opacity:0`, no-longer-"show"-classed element's
resolved colors - don't assume waiting for a CSS transition/class to clear is always
enough to get a clean scan; `.exclude()` the specific element once you've confirmed
(not assumed) the issue is real, pre-existing, and unrelated to your round, the same
way the existing `.exclude(".goal-chart")` precedent already does. Do not start
Round 10 (Analytics module) without the user's explicit go-ahead.

## 2026-09-18 — Claude Code (Claude Sonnet 5) — Round 10 (FINAL) implemented

Merged PR #16 (Round 9, regular merge). This was the combined final round -
Analytics plus a full release-hardening capstone (backlog reconciliation, UI/UX,
accessibility, security, performance, refactoring, regression validation, release-
readiness docs) - run as 9 independently committed and tested internal phases
(10A-10I), per the round's own explicit instruction not to do this as one
undifferentiated change. On `feature/010-final-analytics-hardening`, off
`development`.

**10A (Analytics)**: audited first - most of the backend already existed
(`funnel`/`source`/`stage-duration`/etc. in `advanced.js`); closed the one real gap
(a `resume` analytics kind) and built one Analytics page reusing the existing
dependency-free SVG chart primitives (`hBar`/`vBars`/`areaLineChart`/
`radialProgress`, all since Round 3) - no new chart library. Found and fixed a
real, previously-undiscovered mobile-nav bug while writing the E2E spec: the
sidebar drawer's CSS transform transition could lag well behind its "open" class
under load, traced to a `.focus()` call forcing a synchronous layout read in the
same tick as the class toggle - fixed with a `requestAnimationFrame` deferral.

**10B (backlog gap-close)**: reconciled the full Rounds 3-9 backlog against a
P0-P3 scheme; closed the one clearly high-value, low-risk item (tracker edit UI
for Interviews/Rejections/Follow-ups/Networking/Goals - the generic edit machinery
already existed, scoped only to `networking_contacts`). This surfaced two real,
previously-untested bugs: checkbox fields weren't read/written correctly by the
generic tracker form, and the generic tracker PATCH/POST routes only ever returned
`{id}` (never tested before) - improved to return the full record, matching every
other domain's convention.

**10C (UI/UX capstone)**: normalized a couple of safe design-token drifts; no
risky global rewrite, no product redesign, per the round's own constraint.

**10D (accessibility)**: fixed the Round 9 `#toast` color-contrast finding at the
root this time (a `visibility`-transition CSS fix), rather than excluding it
again. Root-causing it properly (direct `getComputedStyle` measurement) rather
than guessing led to a broader sweep that found two *more* real issues using the
same bug class (opacity-hiding of real content): a calendar "outside month" day's
contrast, and the reminder-category filter's missing accessible label. Every
existing `.exclude()` pattern was individually re-justified or removed (two
`.exclude(".goal-chart")` calls proved obsolete by direct testing).

**10E (security)**: formal final audit - authorization matrix across every domain
table, SQL injection trace (every `${...}` SQL interpolation checked), CSRF/XSS/
CSV-injection/logging/CSP/session checks. No unresolved CRITICAL/HIGH findings.

**10F (performance)**: N+1 audit (none found), closed the one real gap
(`import_rows` had no index since Round 6/migration 001 - added a composite index
covering its one real query's filter+sort), evaluated and explicitly declined a
CDN/load-balancer/Redis/server-cache - none justified at current, measured scale.

**10G (refactor/dead-code)**: re-verified, not assumed, the old Round 3 claim that
`GET /api/applications` is callerless - it's false: three frontend pages (tracker
editor, tasks editor, note editor) and the entire test/E2E fixture suite call it.
Nothing removed. Removed genuinely dead code found by direct trace instead: one
unused icon, and six CSS declarations/blocks permanently overridden by a later
same-specificity rule or whose selector never matched a rendered element.

**10H (full regression validation)**: replicated every CI job locally against real
Postgres 17 and real Chromium. Running the *entire* browser suite for real, back to
back, surfaced three genuine, previously-undiscovered bugs no partial run had hit:
(1) `#toast`'s axe scan could catch a mid-fade animation frame, since `analyze()`
walks the live DOM and can itself run long enough for the toast's 2600ms auto-hide
timer to fire mid-scan; (2) a second, separate trigger for the mobile-nav race the
10A fix didn't cover, in the Notes E2E test; (3) the same race on the Tasks page,
this time rooted in real application code - the "Add task" handler calls
`renderTasks()` without `await`ing it. All three fixed (the third at the test
level; the unawaited render is real, logged debt). Also root-caused and fixed the
long-standing Round 6 PIN-hash test flake (the removed assertion tested a
non-security-relevant property - that a scrypt hash never coincidentally contains
the raw PIN as a substring) and closed a small Round 9 gap (`habits/format.js`
was never unit tested).

**10I (divergence audit + release docs)**: audited `development` vs `main` - 71
commits ahead, 3 behind, and that one is a Neon-crash fix `development` already
carries independently (confirmed byte-identical file content). A dry-run
`git merge-tree` three-way merge found zero files needing conflict resolution.
Wrote `docs/FINAL_MAIN_INTEGRATION_PLAN.md` (divergence, conflict risk, migration
order, Render/Neon impact, rollback, required CI gates, manual smoke checks,
proposed merge method - plan only, not executed) and `docs/RELEASE_NOTES_V2.md`
(by feature area). Updated `docs/SECURITY.md` with the final report. Completed a
full technical-debt triage of every open backlog item plus everything this round
found, each resolved to FIXED/ACCEPTED V2 DEBT/MOVE TO V2.1/OBSOLETE/DUPLICATE -
see `docs/FEATURE_UPGRADE_10_FINAL.md`. Added a brief, non-implementing
future-framework-migration note to `docs/ARCHITECTURE.md`.

**For the next agent**: [fill in PR number/state once pushed and opened]. Worth
remembering: several `toast(); render*();` call sites in `app.js` don't `await`
the re-render (e.g. Tasks' "Add task" handler) - this is real, confirmed debt, not
just a test artifact, and caused a genuine E2E failure this round. If you're
adding a new `render*()` call after a `toast()`, either `await` it or don't rely
on the toast's visibility as a settle signal for whatever comes next. Two E2E
timing flakes remain (mobile-nav transition, toast-vs-assertion race under heavy
sequential load) - both root-caused, both much rarer after this round's fixes,
neither fully eliminated; don't be surprised by an occasional one and don't chase
it further without new evidence it's gotten worse. **This was the last product
round before a `development` → `main` integration** - do not merge into
`development` or `main`, and do not deploy, without the user's separate, explicit
approval, even though the integration plan itself is now fully written.

## 2026-09-18 (same day, continued session) — Claude Code (Claude Sonnet 5) — FINAL RELEASE INTEGRATION

User gave explicit, detailed authorization to merge PR #17 into `development` and
prepare (not merge) a `development` -> `main` release PR, per a structured
release-integration task. This is release integration, not a feature round - no
new features, no speculative refactoring, no redesign.

Verified PR #17 matched its own previously-reported state exactly (head commit
`5d1b954`, CI green, `mergeStateStatus: CLEAN`, `mergeable: MERGEABLE`,
`development` unmoved since the branch point) before touching anything - nothing
had drifted. Merged via `gh pr merge --merge` (regular merge commit, confirmed two
parents via `git show --format="%H %P"`, not a fast-forward or squash): `41f3cd2`.

Ran the full release-gate list against the actual integrated `development` branch,
not just the feature branch, with real PostgreSQL 17 and real Chromium:
reproducible `npm ci`, lint, typecheck, both builds, the full backend/frontend/
integration/e2e matrix (33/44/33/33), the SQLite->Postgres migration test (1/1),
and the full browser+visual suite (63 passed, 0 failed, 7 skipped) - all clean.

Validated the migration chain two ways, both real, both against real Postgres:
(1) a fresh database applying 001->012 in order, and (2) a representative upgrade
- temporarily moved migrations 009-012 out of the directory, applied 001-008
(simulating `main`'s actual historical production state), restored 009-012, and
re-ran migrate:postgres to confirm the incremental upgrade path works cleanly on
top of an already-008 database (confirmed via `schema_migrations` timestamps:
001-008 applied first, 009-012 applied ~6s later on the second run, no
re-application). This is exactly what will happen to the real production database
on the eventual `main` merge, so it was worth simulating precisely rather than
just trusting the fresh-database case.

Re-audited `development` vs `main` against the current, post-merge state (not
assumed to still match the pre-merge report) - unchanged conclusion: 87 commits
ahead (was 71 pre-merge, +15 +1 merge commit checks out), 3 behind (still the one
Neon-crash fix `development` already independently carries, byte-identical file
content re-confirmed via `diff`), zero conflicts on a fresh dry-run
`git merge-tree`. Also checked CI workflow diff, package.json/lockfile diff (one
new devDependency, `vite`, no backend runtime dependency changes), and grepped for
any new `process.env.*` references (none) - nothing surprising.

Verified Render readiness directly against the integrated code, not by assumption:
build command, `frontendDir` path matches Vite's actual output location, `/api/
health` is fast and DB-independent (won't false-fail during a Neon suspend/
reconnect cycle - a deliberate, correct design choice), env var names unchanged
from `main`'s own `render.yaml`, no `import.meta.env`/`VITE_*` usage anywhere
(confirms no env-based secret-exposure surface) and no secret/connection-string
strings in the actual built `dist/` bundle, CSP still server-set, session cookies
unchanged, and confirmed there's no `prestart` hook that could trigger a rebuild
on every crash-restart (only `predev`, which is local-dev-only). Render readiness:
PASS. Neon readiness: PASS (connection layer byte-identical to `main`, all four
V2 migrations are pure additive DDL, no new extensions, no credentials in the
bundle).

Opened PR #18 (`development` -> `main`, "release: JobQuest V2") with the exact
section structure requested (Summary/Major Features/Architecture/Database/
Security/Accessibility/Performance/Testing/Render/Neon/Main divergence
reconciliation/Accepted V2 Debt/Rollback). Not merged.

**Found something worth flagging clearly, not burying**: PR #18's own CI hit the
same pre-existing Postgres worker RPC `JSON.parse` failure already documented from
PR #17 - this time on a different code path (`listApplications` vs. the earlier
resume-analytics query), which rules out anything query-specific and points at
the shared RPC mechanism itself. This is the second confirmed occurrence, not a
single fluke - upgraded the debt record from "rare, one-off" to "recurring,
should be prioritized promptly in V2.1," while still not attempting a fix during
release integration (a rushed change to core, concurrency-sensitive, synchronous
cross-thread DB communication code is exactly the wrong risk to take under this
kind of time pressure - if it needs fixing under pressure, that pressure should
come from a real incident, not a self-imposed deadline). Note also: the CI
workflow triggers on both `push` (to `development`/`main`) and `pull_request`
(targeting either), so a push to `development` while a PR against `main` is open
produces two parallel runs of the same commit - this is pre-existing CI config,
not something this session introduced, and explains why PR #18's check list shows
duplicate entries per job name.

**For the next agent**: the release-candidate PR (#18) is the artifact to act on
next, once the user approves. Do not re-run CI indefinitely chasing a clean run of
the RPC flake - it's pre-existing, understood, and doesn't block the PR's own
validity (the check tied to the PR's own `pull_request`-triggered CI run, not a
duplicate `push`-triggered one, is what actually matters for merge-readiness).
**Do not merge PR #18 into `main`, and do not deploy, without the user's separate,
explicit approval** - this session's instructions were unusually explicit and
detailed about this exact point.

## 2026-09-20 — Antigravity (Google Deepmind) — Round 11 (Browser Capture Extension) CP0–CP8 implemented

Implemented Round 11: Manifest V3 browser extension ("JobQuest Capture") for Chrome and Edge on branch `feature/011-jobquest-capture-extension` (off `development`).

Completed:
- CP0: Specification & feature document (`docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`).
- CP1: Migration 013 (`extension_tokens`), 7 extension API endpoints with bearer-token authentication (`backend/src/extension.js`), wired into server, 16 test cases in `backend/test/app.test.js`.
- CP2: Frontend token manager UI in Settings (`frontend/src/app.js`), raw token one-time display with copy button, token list, and revocation.
- CP3: Extension skeleton (Manifest V3, icons, background service worker, options page for server URL and token management, client API library).
- CP4: Multi-tier job extractor engine (JSON-LD schema.org JobPosting parser, Greenhouse ATS adapter, Lever ATS adapter, Indeed adapter, generic DOM/meta heuristics fallback), unit test fixtures, and extractor tests.
- CP5: Popup capture interface (`extension/popup.html`, `popup.css`, `popup.js`), content script runner (`extension/content.js`), dynamic resume dropdown, editable pre-filled capture form, and save flow.
- CP6: Duplicate detection UX (Level-1 exact URL and Level-2 company+role matching) with interactive warning banner and "Open Existing" / "Save Anyway" actions.
- CP7: Playwright E2E test suite (`backend/e2e/extension.spec.js`) validating the full extension workflow across 5 viewports (`desktop`, `compact-desktop`, `tablet`, `mobile`, `small-mobile`) with 10/10 passing tests.
- CP8: CI matrix update (`.github/workflows/ci.yml`) adding `extension` test suite; extension documentation (`extension/README.md`).

Verified:
- Backend tests: 49/49 passed.
- Frontend tests: 44/44 passed.
- Extension unit tests: 6/6 passed.
- Playwright E2E suite: 10/10 passed across all 5 viewports.
- Linting & typechecking: all JS files across backend, frontend, and extension clean.
- Frontend production bundle build (`npm run build:frontend`): succeeded.

## 2026-09-20 — Antigravity (Google Deepmind) — Round 11 Pre-Merge Defect Fixes & Stabilization

Addressed real-world local validation feedback on branch `feature/011-jobquest-capture-extension`:

1. **Defect 1 Fixed (False Duplicate Banner on First Capture)**:
   - Root cause: CSS rule `.banner { display: flex; }` overrode the browser user-agent's `[hidden]` attribute.
   - Fix: Added `[hidden] { display: none !important; }` in `extension/popup.css`. Removed static placeholder text from `extension/popup.html`.
   - Refactored `GET /api/extension/duplicate-check` to implement **Company-First duplicate classification**:
     - `EXACT_POSTING`: Normalized URL match (blocking duplicate).
     - `SAME_ROLE`: Normalized company + title match (blocking duplicate).
     - `COMPANY_ONLY`: Prior applications exist at the same company for different roles (informational only, non-blocking `.banner.info` displaying prior vs current role, normal save permitted without override).
     - `NONE`: No history found.
     - Match history explicitly bounded to top 3 recent records (`LIMIT 3`).

2. **Defect 2 Fixed (Tailored Resume Manual Entry HTTP 400)**:
   - Root cause: `validateApplication` in `backend/src/service.js` tested `data.resume_id !== undefined && data.resume_id !== ""`. When payload sent `resume_id: null`, `Number(null)` was evaluated as 0, failing `0 < 1`.
   - Fix: Explicitly allowed `data.resume_id === null` in `service.js`. Added 3-mode tailored resume interface in `extension/popup.html` and `extension/popup.js` (Select from library, Enter manually with validation, None). Updated `POST /api/extension/applications` to accept `resume_id: null` with `resume_version`.

3. **Realistic Test Suite Additions & Verification**:
   - `backend/test/app.test.js`: 52/52 passing (added tests for `COMPANY_ONLY`, `SAME_ROLE`, bounded results, and manual resume handling; fixed date-flake in Round 7 recurrence test for 2028).
   - `extension/tests/api.test.js`: 10/10 passing (added unit tests for `normalizeJobUrl`, `normalizeText`, resume payload formatting, and duplicate classification).
   - `backend/e2e/extension.spec.js`: 10/10 passing across 5 viewports.
   - `npm run test:frontend`: 44/44 passing.
   - `npm run lint` & `npm run typecheck`: clean across all files.
   - `npm run build:frontend`: clean production bundle.

4. **Documentation Created**:
   - `docs/EXTENSION_ARCHITECTURE.md`: Complete architectural specification.
   - `docs/EXTENSION_TEST_PLAN.md`: 34 test matrix scenarios + real-world manual testing checklist.
   - `docs/EXTENSION_SECURITY.md`: Comprehensive security review.
   - `docs/EXTENSION_INSTALLATION.md`: Developer unpacked installation guide.
   - `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`: Updated with stabilization defect analyses and decisions.
   - `tasks/BACKLOG.md`: Logged JobRight.ai support as deferred (ON HOLD).

**For the next agent**: PR #20 is updated on origin. Do NOT merge PR #20 into `development` without explicit user approval. Do NOT merge to `main` or deploy to production.

## 2026-09-20 (continued) — Antigravity (Google Deepmind) — Generic Career Page Extraction Hardening

Addressed non-standard career portal & job aggregator extraction defects surfaced in real-world testing (Tensor and JobRight examples):

1. **Defect 3 Fixed (Generic Career Page & Aggregator Extraction Failure)**:
   - Root causes:
     - Aggregators (e.g. `jobright.ai`): Extractor checked metadata before rendered DOM, selecting marketing slogan (`og:title="Jobright: Your AI Job Search Copilot"`) as title and platform branding (`og:site_name="Jobright AI"`) as company, ignoring rendered `<h1>QA Automation Engineer...</h1>` and employer badge (`GetInsured`).
     - Employer career portals (e.g. `tensor.auto`): `<title>Tensor</title>` was assigned as title, leaving company blank and ignoring rendered `<h1>FPGA Engineer: ISP</h1>`.
     - Dual-suffix salaries (`$120K/yr - $140K/yr`): Regex truncated before `/yr`.
     - Workplace arrangement in location chip (`Remote` inside `<span class="location">`): Arrangement defaulted to undefined.
   - Architectural resolution (no hardcoding, no dedicated JobRight adapter):
     - Source-Quality Hierarchy: High-confidence rendered semantic DOM headings (`main h1`, `article h1`, `[class*='job'] h1`) strongly outrank site metadata.
     - `isGenericTitle()` rejects slogans ("Copilot", "AI Job Search", etc.) and generic portal words ("Careers", "Jobs", "Open Positions", "Home").
     - `AGGREGATOR_AND_BOARD_DOMAINS` catalog prevents aggregator site branding from ever being assigned as employer company. Direct employer domains safely attribute domain brand.
     - Multi-location list preservation (semicolon joined).
     - Location-based workplace arrangement fallback.
     - Dual-suffix salary regex.
     - Mirrored exactly between `extension/extractors/generic.js` and `extension/content.js`.

2. **Fixtures & Tests Added**:
   - `extension/fixtures/tensor_career_job.html`: Verified Title: `"FPGA Engineer: ISP"`, Company: `"Tensor"`, Locations: 4 items.
   - `extension/fixtures/aggregator_jobright_job.html`: Verified Title: `"QA Automation Engineer (SDET) AI-Enhanced Testing"`, Company: `"GetInsured"`, Salary: `"$120K/yr - $140K/yr"`, Workplace: `"Onsite"`.
   - `extension/tests/extractor.test.js`: 16/16 tests passing (expanded from 6).
   - All tests passing: 52/52 backend, 44/44 frontend, 10/10 Playwright E2E viewports, 0 lint/typecheck errors.

3. **Documentation Updated**:
   - `docs/EXTENSION_ARCHITECTURE.md`: Documented Extractor Engine Cascade, source-quality hierarchy, and aggregator vs employer company attribution.
   - `docs/EXTENSION_TEST_PLAN.md`: Added Generic Career Page Extraction test matrix and manual checklist.
   - `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`: Recorded Defect 3 analysis, architectural fix, and re-affirmed JobRight adapter is ON HOLD.
   - `brain/DECISIONS.md`: Logged extraction hierarchy decision.
   - `tasks/CURRENT_TASK.md`: Updated with Defect 3 fixes.
   - `extension/HANDOFF.md`: Updated extension handoff.

**For the next agent**: PR #20 is updated on origin. Do NOT merge PR #20 into `development` without explicit user approval. Do NOT merge to `main` or deploy to production.


