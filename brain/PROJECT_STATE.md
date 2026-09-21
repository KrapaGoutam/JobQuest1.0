# Project state

Last updated: 2026-09-20, by Antigravity (Google Deepmind).

## Branch / commit

- `main`: head `dfea126` — JobQuest V2.1 Production Hotfix released (PR #23 merged). All 9 CI jobs green on `main`.
- `development`: head `e29ff13` — fully synchronized with hotfix and Round 11.
- `bugfix/render-postgres-extension-tokens-migration`: preserved (PR #22 merged into `development`).
- `feature/011-jobquest-capture-extension`: preserved.

- Local and remote validation of the **integrated** `main` and `development` branches: all green — reproducible install, static-quality (lint/typecheck/build/build:frontend/migrate:check), security, backend/frontend/integration/e2e/extension tests (61/44/33/33/23), sqlite-postgres migration test, full browser-and-visual suite (all 9 CI jobs passed), fresh-database migration chain (001→013), and zero regressions across all domains.

## What's done

**JobQuest V2.1 Production Migration Hotfix released to `main`.**
- Addressed Render / Postgres error: `relation "extension_tokens" does not exist`.
- Fixed `postgres-migrate.js` to resolve `DATABASE_URL` as well as `DIRECT_URL`.
- Enabled automatic production migration on Render (`NODE_ENV === "production"` / `RENDER`).
- Added startup migration runner in `server.js` and updated schema readiness check to `013_extension_tokens.sql`.
- PR #22 (`bugfix/render-postgres-extension-tokens-migration` → `development`): 9/9 CI checks green, merged via commit `e29ff13`.
- PR #23 (`development` → `main`): 9/9 CI checks green, merged via commit `dfea126`.
- Remote CI run `35633942398` on `main`: **ALL 9 CI JOBS 100% GREEN**.


Render readiness: **PASS**. Neon readiness: **PASS**. Both verified directly
against the integrated code (build command, Vite output path, health check,
env vars, CSP, sessions, Neon-suspend reconnect logic, migration safety).

`development` vs `main` divergence post-hotfix: `development` has PR #22 merged,
and `main` has PR #23 merged. Next step is fast-forwarding `development` to include
merge commit `dfea126` from `main` to maintain 100% linear parity.

## Incomplete / not started

- Production deployment verification on Render (user to verify or auto-deployed by Render on push to `main`).
- Any future V2.2 features or backlogged items (e.g. JobRight dedicated adapter, which remains on hold).

## Known state to be aware of

- Untracked root "mega-prompt" planning files remain (not committed, per
  convention) — unchanged.
- `ui-upgrade` branch's merge status still unconfirmed (low priority, carried
  over unresolved across rounds).
- **The pre-existing Postgres worker RPC request-correlation gap (first found
  on PR #17's own CI) recurred independently on PR #18's CI**, on a different
  code path (`listApplications` this time, vs. a resume-analytics-adjacent
  query the first time) — same `SyntaxError: Unexpected end of JSON input`
  inside `rpc()` (`backend/src/postgres-db.js`). Confirmed via `git diff` both
  times that neither `postgres-db.js` nor `postgres-worker.js` has been touched
  by any commit on `feature/010-final-analytics-hardening` or the two follow-up
  docs commits on `development` — this is genuinely pre-existing, not
  introduced by this session. Never reproduced locally across dozens of
  full-suite runs. **Elevated from "rare, one-off" to "recurring, should be
  prioritized promptly in V2.1"** given the second occurrence — but still not
  fixed here: a rushed change to core, concurrency-sensitive, synchronous
  cross-thread DB communication code is exactly the kind of risk a release-
  integration phase should avoid. Full root-cause analysis and a scoped fix
  recommendation (add a request-correlation ID to the RPC protocol) are in
  `docs/FEATURE_UPGRADE_10_FINAL.md`'s Known Deferred Debt section.
- Two toast-timing E2E flakes were also found and fixed during PR #17's CI
  cycles (a mid-transition axe-scan race, generalized into a shared
  `toastSettled()` helper across every scan in the spec, and a redundant
  assertion racing its own auto-hide timer) — both real fixes, not workarounds,
  detailed in `docs/FEATURE_UPGRADE_10_FINAL.md`.

## Blockers

None. JobQuest V2.1 is fully merged into `main` with 100% green CI.

## Next safe action

JobQuest V2.1 integration complete. The user can deploy to Render/production or load the unpacked extension into Chrome/Edge for live usage. All git history and branches are safely preserved.


