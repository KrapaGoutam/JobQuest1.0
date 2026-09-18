# AGENTS.md

Operating instructions for any coding agent working on JobQuest — Claude Code, OpenAI
Codex, Google Antigravity, Gemini-based agents, or otherwise. Read this before editing.

## What this project is

A secure, multi-user job-application tracker: Node.js 24 (no framework) + PostgreSQL on
Neon, vanilla HTML/CSS/JS frontend (no framework, no bundler yet — see Round 2 in
[docs/PRD.md](docs/PRD.md)), deployed as one service on Render. Full detail:
[CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md), [README.md](README.md),
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Before touching anything

1. Read [brain/PROJECT_STATE.md](brain/PROJECT_STATE.md) and
   [tasks/CURRENT_TASK.md](tasks/CURRENT_TASK.md) — don't reconstruct context from chat
   history that isn't available to you.
2. Check current branch and `git status`. Never work directly on `main`.
3. Check whether the table/endpoint/feature you're about to add already exists — this
   codebase is more feature-complete than it looks from the README alone (see
   [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §Data model). Grep the migrations and
   `backend/src/*.js` before assuming something is net-new.

## Protected infrastructure — do not change without an explicit, approved proposal

- **Render** (`render.yaml`): single web service, `rootDir: backend`, migrations run via
  `preDeployCommand`. Do not change the service shape, deploy provider, or env var names.
- **Neon**: the only database, in production and for local dev (`DATABASE_URL` points at
  real Postgres, not SQLite). SQLite is migration/backup tooling only — never reintroduce
  it as a runtime fallback. Neon autosuspends on idle; the pg pool already handles that
  (see `481c00b`) — don't "fix" that behavior by fighting Neon's autosuspend itself.
- Env var names in `.env.example` / Render dashboard.
- Auth/session model (opaque tokens hashed with SHA-256, scrypt PINs, CSRF, ownership
  scoping) — extend it for new tables, don't replace it.

If a change to any of the above is genuinely required: explain why, show the impact,
propose the smallest safe change, and wait for explicit approval before making it.

## Stack rules (decided 2026-09-14 — see [brain/DECISIONS.md](brain/DECISIONS.md))

- No React, no Radix/shadcn, no Tailwind. Stay vanilla JS.
- A build step (Vite, introduced in Round 2) is being added so the frontend can be split
  into ES modules — use it once it lands; don't hand-roll a second bundling approach.
- Match existing code style: no semicolons-optional inconsistency, no new formatting
  tool introduced without asking — check `backend/src` and `frontend/*.js` conventions
  directly and mirror them.

## Workflow

- Branch naming: `feature/<round-number>-<slug>` off `development` (the repo's existing
  integration branch — see [brain/DECISIONS.md](brain/DECISIONS.md) for why we did not
  introduce a separate `revamp/v2-platform` branch).
- Commit style already in use: `feat(scope): ...`, `fix(scope): ...`, `refactor(scope): ...`,
  `docs(scope): ...`, `test(scope): ...`, `chore(scope): ...`.
- Every substantial change ends with: format → `npm run lint` → `npm run typecheck` →
  `npm test` → relevant Playwright suites → `npm run build` → diff review → commit.
- One feature doc per round in `docs/FEATURE_UPGRADE_N.md` (see template in
  [docs/PRD.md](docs/PRD.md)) — not a `SPEC.md`/`PLAN.md`/`TASKS.md`/`TESTS.md` folder
  per feature. Only split into separate files if a round is large enough to need it.
- Update [brain/PROJECT_STATE.md](brain/PROJECT_STATE.md) and
  [tasks/CURRENT_TASK.md](tasks/CURRENT_TASK.md) at the end of meaningful work so another
  agent can pick up without you.
- Never silently overwrite a doc another agent/session just wrote — check
  `brain/AGENT_HANDOFF_LOG.md` for the latest entry first if something looks stale.

## Documents map

| Doc | Purpose |
| --- | --- |
| [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) | Phase 0 snapshot of the real stack |
| [docs/PRD.md](docs/PRD.md) | Product vision + the full phased roadmap (rounds) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Current + target architecture, data model |
| [DESIGN.md](DESIGN.md) | Authoritative UI/design-token contract |
| [docs/SECURITY.md](docs/SECURITY.md) | Security posture + checklist for new features |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | Testing strategy across rounds |
| [tasks/CURRENT_TASK.md](tasks/CURRENT_TASK.md) | What's active right now |
| [tasks/BACKLOG.md](tasks/BACKLOG.md) | Ordered backlog (mirrors PRD rounds) |
| [brain/PROJECT_STATE.md](brain/PROJECT_STATE.md) | Recovery snapshot: branch, CI, blockers |
| [brain/DECISIONS.md](brain/DECISIONS.md) | Cross-project decisions + why |
| [brain/AGENT_HANDOFF_LOG.md](brain/AGENT_HANDOFF_LOG.md) | Notable agent-to-agent handoffs |

`brain/` is a recovery/context layer, not a source of truth. Authoritative requirements
live in `docs/PRD.md`, `docs/ARCHITECTURE.md`, the per-round `docs/FEATURE_UPGRADE_N.md`
files, tests, and the source code itself.
