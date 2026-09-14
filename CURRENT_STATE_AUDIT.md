# JobQuest — Current State Audit

Phase 0 discovery snapshot. Read-only: no application behavior, infrastructure, or
dependencies were changed to produce this document. Date: 2026-09-14.

## 1. Runtime & framework

- **Backend**: plain Node.js 24 (`type: module`, no framework — no Express/Fastify/Nest).
  Hand-rolled HTTP handling in `backend/src/server.js` (910 lines), business logic split
  across `service.js` (745), `advanced.js` (1576), `feature-upgrade.js` (794).
- **Frontend**: **vanilla HTML/CSS/JS**, no framework, no bundler, no TypeScript.
  Served as static files by the backend. Key files: `frontend/app.js` (2726 lines),
  `frontend/styles.css` (2323 lines), plus `application-table.js`, `application-preview.js`,
  `ui-utils.js`, `dashboard-config.js`, `icons.js` (inline Lucide icons, self-hosted fonts).
- **Package manager**: npm (`backend/package-lock.json`). No root-level or frontend
  `package.json` — frontend ships unbundled, checked with `node --check`.
- There is **no React, shadcn/ui, Radix, Base UI, Tailwind, or Framer Motion** anywhere in
  this codebase today.

## 2. Database & data layer

- **Production**: PostgreSQL on **Neon**, accessed via `pg` (node-postgres) directly —
  no ORM (no Prisma/Drizzle/Knex). Raw SQL in `postgres-db.js`, `postgres-worker.js`.
- **Migrations**: hand-written, versioned SQL files in `backend/jobsearch/migrations/`
  (001 → 008), applied via `postgres-migrate.js` / `npm run migrate:postgres`.
- **SQLite** is retained only as a migration-source/backup format (`sqlite-backup.js`,
  `sqlite-to-postgres.js`) — explicitly **not** used at runtime in production
  (README: "Production requires DATABASE_URL and never falls back to SQLite").
- Recent fix (`481c00b`) hardened the pg pool against Neon compute-suspend disconnects —
  i.e. Neon's autosuspend-on-idle behavior has already caused a production incident and
  was patched. This is a live operational concern to be aware of, not a design flaw to "fix."

## 3. Auth & authorization

- Custom session auth: opaque random session tokens, stored only as SHA-256 hashes;
  12-hour expiry; HttpOnly/SameSite cookies, `Secure` in production.
- 4-digit PIN login, salted scrypt hashing, 5-attempt lockout (5 min).
- CSRF tokens bound to session for all mutations.
- Two roles: `USER` and `MANAGER`. Manager account is seeded out-of-band
  (`npm run seed`, env-var secrets only — never CLI args or repo).
- Row-level ownership enforced at the query layer (user-scoped WHERE clauses; 404 instead
  of 403 for cross-user access); manager actions preserve record owner, audit rows keep actor.
- This is a genuinely security-conscious design already — see `backend/src/security.js`
  and the dedicated CI `security` job (npm audit, secret-pattern grep, no committed DBs).

## 4. Hosting / deployment (protected infrastructure)

- **Render** (`render.yaml`): single `web` service, `rootDir: backend`, Node runtime,
  `preDeployCommand: npm run migrate:postgres` (migrations run automatically on deploy),
  health check at `/api/health`. `DATABASE_URL`/`DIRECT_URL` are unsynced secrets (set in
  Render dashboard, not in repo).
- **Neon**: sole database. No local Postgres compose file — local dev also points at a
  real Postgres (`DATABASE_URL` in `.env.example` defaults to a local instance, not Neon).
- No containerization (no Dockerfile), no separate frontend host — one deployable unit.
- **Per the operating rules for this engagement, none of this (Render service shape,
  Neon usage, env var names, migration-on-deploy behavior) should change without an
  explicit proposal + approval.**

## 5. Testing & CI

- Node's built-in test runner (`node --test`) for backend/frontend/integration/e2e logic
  tests, plus **Playwright** for real-browser functional, accessibility (axe-core),
  responsive, and visual-regression tests (`backend/e2e/jobquest.spec.js` +
  `*-snapshots/` baselines).
- GitHub Actions (`.github/workflows/ci.yml`) runs 5 parallel jobs on every PR to
  `development`/`main`: static-quality (lint/typecheck/build via `node --check`), tests
  (matrix: backend/frontend/integration/e2e against a real Postgres 17 service container),
  security (audit + secret scan), sqlite→postgres migration test, and a full
  browser+visual-regression job with artifact upload on failure.
- This is a **mature, real CI pipeline** already — not a gap to fill, a baseline to preserve.

## 6. Existing documentation

Already present and current — do **not** duplicate, prefer extending:

- `README.md` — stack, run/seed instructions, full command table, auth/authorization model.
- `DESIGN.md` — "authoritative interface contract" (design tokens/UI spec, 12.8KB).
- `docs/NEON_MIGRATION.md`, `docs/FEATURE_UPGRADE_1.md`, `docs/FEATURE_UI_UPGRADE_1_1.md`
  — prior feature-upgrade rounds, each documented after the fact.
- `HEADROOM.md` — a local context-compression tool config (see `.headroom/` in
  `.gitignore`); unrelated to product docs.
- Several **untracked, repo-root "mega-prompt" planning documents** (`JOBSEARCH_MANAGER_*`,
  `Feature_Upgrade_2_Codex_Prompt.md`) — these are the user's own working drafts for past
  and upcoming revamp rounds (git history shows a prior commit deliberately excluding this
  category: `f432aa3 chore: ignore local prompt and planning files`). They are historical
  planning input, not committed product documentation.

There is no existing `docs/product/`, `docs/architecture/`, `tasks/`, `brain/`,
`features/`, or Spec Kit scaffolding — this repo has so far used a lighter-weight,
single-file-per-round documentation style (`docs/FEATURE_UPGRADE_N.md`), not the
multi-agent directory structure described in the revamp prompt.

## 7. Existing feature set (what's actually built today)

From README + source, JobQuest today is a **single-domain job-application tracker**:

- Applications: CRUD, table + Kanban views, stages, priorities, activity timeline,
  interviews, contacts (per-application), attachments/resume-version field, notes.
- Dashboard: widgets driven by `dashboard-config.js` (drill-throughs already exist per
  README) — applications/week, stage funnel-style views, goals.
- Daily/weekly goals, follow-up tracking, networking, import.
- Manager dashboard (cross-user oversight for the `MANAGER` role).
- Accessibility (WCAG AA contrast fixes already landed — `6180511`), dark/light theme
  (already implemented — visual regression tests cover "light dark and system themes"),
  responsive nav (mobile nav visual regression already covered).

There is **no task manager, habit tracker, journal/notes system, standalone contacts/CRM,
or analytics module** yet — those are the genuinely new surface area in the revamp brief.

## 8. Git / branch state

- Current branch: `main`. Working tree has 5 untracked planning `.md` files (see §6);
  nothing staged, nothing modifying tracked files.
- Local + remote branches beyond `main`: `development` (integration branch already in use),
  `ui-upgrade`, `feature/dashboard-applications-reskin`,
  `feature/lovable-dashboard-applications-adaptation`,
  `feature/upgrade-lovable-ui-reference`, `chore/refresh-visual-baselines`,
  `bugfix/pg-pool-connection-crash` — all already merged to `main` per recent log except
  possibly `ui-upgrade` (unmerged, not yet investigated further).
- Recent history is a clean, incremental sequence of scoped PRs (dashboard reskin → a11y
  fixes → visual baseline refresh → pg-pool crash fix), each merged through PR review.
  **`development` already functions as this repo's integration branch** — worth deciding
  whether a new `revamp/v2-platform` branch is additive or should just be `development`.

## 9. Key gap vs. the revamp brief — read before planning further

The revamp brief (product vision, tool audit, UI stack) is written assuming a
**React + shadcn/ui + Radix + Framer Motion** SPA with a **Spec Kit / multi-agent
brain-and-tasks directory** workflow. The actual repo is a **vanilla JS, no-build,
server-rendered-static-files** app with a lightweight one-doc-per-feature history and a
real, already-mature CI/security/testing setup. This is the single biggest fork in the
road before any further phases run — see the questions that follow this audit.
