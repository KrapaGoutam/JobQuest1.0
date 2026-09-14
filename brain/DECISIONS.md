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

## 2026-09-14 — Several "new" product-brief features already exist; scope only the gap

**Decision**: Rounds 4 (checklist), 5 (contacts), 6 (import/export) are scoped as
audit-then-gap-close, not net-new builds.

**Why**: the migrations already define `checklist_items`, `networking_contacts`,
`import_batches`/`import_rows`/`export_preferences`, and the backend already wires them
up (confirmed in `service.js`/`advanced.js`/`feature-upgrade.js`). Building these "from
scratch" per the original brief would duplicate real, working functionality.
