# Final `development` → `main` Integration Plan

**Status: plan only. No merge into `main` has happened or is authorized by this
document.** Written at the end of Round 10 (Analytics + Capstone Hardening) to
prepare for a future, separately-approved integration. Do not execute the steps
below without explicit sign-off from the project owner.

**Re-audited post-merge** (PR #17 merged into `development` as commit `41f3cd2`,
a real two-parent merge commit): every conclusion below was re-verified against
the actual, current state of the repository — not assumed to still hold from when
this document was first written — and nothing changed.

## 1. Divergence summary

As of the integrated `development` branch (`41f3cd2`, Round 10 merged in):

- `main..development`: **87 commits** — every product round from Round 2 (frontend
  build tooling) through Round 10 (this round, now merged). All additive: new
  features, new tests, new docs.
- `development..main`: **3 commits**, unchanged from before the merge — all a
  single logical change: the Neon connection-crash fix (`481c00b`, "handle pg
  connection errors to prevent crash on Neon compute suspend") and its merge
  commit.
- **This fix is not missing from `development`** — re-confirmed post-merge by
  diffing the actual file content: `backend/src/postgres-worker.js` is still
  byte-identical between `main` and `development`. `development` independently
  carries the same fix (applied during an earlier round), so the two branches
  converged on identical content even though the commit graphs differ. No action
  needed for this file.

## 2. Conflict risk: verified, not assumed

Ran `git merge-tree $(git merge-base main development) main development` — a
dry-run three-way merge with no working-tree changes. **Zero files were modified on
both sides of the merge base in a way requiring manual resolution.** Every file
`development` touches, `main` either doesn't touch at all, or touches in a way that
already fully converged (see `postgres-worker.js` above). A standard merge commit
(`git merge development` from `main`) is expected to apply cleanly with no conflict
markers.

This was re-verified twice this round: once before merging `feature/010-final-
analytics-hardening` into `development`, and again after, against the real,
integrated `development` (`41f3cd2`) vs. the current `main` (`7b674f4`) — same
result both times, 0 files needing resolution. Re-run the same dry-run command
immediately before the actual `main` merge regardless, since `main` may receive
further hotfixes between now and whenever that step is approved.

## 3. Main-only changes to preserve

Just the one: the Neon connection-crash fix. Already present in `development`
(see §1) — nothing to cherry-pick, nothing to reconcile. The merge will not need to
choose between the two versions since they're identical.

## 4. Development-only changes landing on `main`

Everything else — the full V2 feature set. At a high level (see
`docs/RELEASE_NOTES_V2.md` for the user-facing version):

- Frontend build tooling migration: Vite, `frontend/src/` restructuring, modular
  `features/*/format.js` files (Round 2).
- Dashboard/Applications UI revamp, checklist, contacts/networking gap-closes
  (Rounds 3–5).
- Import/export hardening (Round 6).
- Task management, habit tracker, journal/notes (Rounds 7–9).
- Analytics page, tracker-edit UI gap-close, accessibility fixes (`#toast` contrast,
  `.goal-chart`/`#detail-stage` labeling), security/performance audit, dead-code
  cleanup, and this validation pass (Round 10, this branch).
- Four new, purely additive migrations: `009_task_management.sql`,
  `010_habit_tracker.sql`, `011_journal_notes.sql`,
  `012_final_performance_indexes.sql`.
- One `render.yaml` change: `buildCommand` gains `&& npm run build:frontend`,
  required because `development` introduced the Vite build step `main` doesn't have.
- No new backend runtime dependencies (checked `backend/package.json`'s
  `dependencies` — unchanged; only `scripts` and `devDependencies` differ). Frontend
  adds exactly one devDependency: `vite`.

## 5. Migration order

All four new migrations are purely additive (new tables/indexes, no `ALTER`/`DROP`
touching existing production data) and numbered contiguously after `main`'s highest
(`008_manual_application_resume_version.sql`) with no gaps or renumbering:

```
009_task_management.sql   (tasks table)
010_habit_tracker.sql     (habits, habit_logs tables)
011_journal_notes.sql     (notes table)
012_final_performance_indexes.sql  (import_rows composite index)
```

`preDeployCommand: npm run migrate:postgres` (already in `render.yaml`, unchanged)
applies them automatically and in order on the next deploy after merge. No manual
migration step is required beyond the existing deploy pipeline.

## 6. Render / Neon impact

- **Render**: one config change (`buildCommand`, §4) ships with the merge — Render
  will run the Vite frontend build on every future deploy. No service-plan, region,
  or env-var change needed. `healthCheckPath: /api/health` is unchanged.
- **Neon**: no schema-breaking change, no destructive migration, no connection
  handling change (that fix is already shared — §1). The four new tables are small
  and additive; no expected impact on Neon's free-tier compute or storage limits at
  current usage.
- Both Render and Neon remain protected infrastructure per every round's standing
  instruction — this plan proposes no infrastructure change beyond the one
  `buildCommand` line above, which is required for the app to build at all with the
  Vite migration already on `development`.

## 7. Rollback strategy

Because the merge is a plain merge commit (not squashed) into `main`:

- **If the merge itself needs undoing before anything deploys**: `git revert -m 1
  <merge-commit-sha>` on `main` cleanly reverts the whole merge in one commit,
  since there are no conflicts to re-resolve (per §2).
- **If a bad deploy needs rolling back after Render has already deployed it**:
  Render's own "redeploy previous version" (or manually deploying the prior `main`
  commit) is the fast path — no database rollback is needed for this to be safe,
  since every migration in this merge is additive (new tables/index only); rolling
  the app back to pre-merge code leaves the new tables unused but harmless.
- **Database rollback is not expected to be necessary.** None of the four new
  migrations alter or drop any existing column, table, or constraint.

## 8. Required CI gates before merge

All of `.github/workflows/ci.yml`'s jobs must be green on the PR that eventually
merges `development` → `main` (this is the same gate list already enforced for
`feature/010-final-analytics-hardening` → `development`, re-run once more against
`main` as the target to catch anything `main`-specific):

- `static-quality` (migrate:check, lint, typecheck, build, frontend build)
- `tests` matrix (backend, frontend, integration, e2e — real Postgres)
- `security` (dependency audits, committed-secret scan)
- `sqlite-postgres-migration`
- `browser-and-visual` (full E2E + visual regression, real Chromium, real Postgres)

## 9. Manual smoke checks (post-deploy, before calling the release done)

Beyond automated CI, a short manual pass against the live Render deployment once
merged and deployed:

1. Register a new account, log in, log out — confirms the deployed Vite build
   actually serves and the session/CSRF flow works end-to-end in production.
2. Create an application, move it through a couple of stages, confirm the timeline
   records it.
3. Open the new Analytics page and confirm it renders real data (not just that it
   doesn't 500).
4. Add a task, a habit, and a note; confirm each persists across a page reload.
5. Trigger a toast (e.g. change the theme) and confirm it's readable — the exact
   regression this round's `#toast` fix targeted.
6. Confirm the mobile nav (narrow viewport or browser dev tools' device mode) opens
   and closes.
7. Check Render's logs for any unexpected `[postgres] connection error:` spam
   beyond the occasional expected Neon-suspend reconnect.

## 10. Proposed merge method

Regular merge commit (`git merge --no-ff development` from `main`), consistent with
every prior round's standing instruction — never squash, never rebase `main`. PR
title/description should reference this document and `docs/RELEASE_NOTES_V2.md`.

## 11. Release notes outline

See `docs/RELEASE_NOTES_V2.md` for the full, feature-area-organized version. This
plan only needs the shape: New Features (Tasks/Habits/Notes/Analytics), Improvements
(UI/UX/accessibility/performance), Fixes (the three Phase 10H timing bugs, prior
rounds' gap-closes), Security (final audit summary, pointer to `docs/SECURITY.md`),
Infrastructure (the one `render.yaml` line), Known Debt (pointer to Technical Debt
Classification in `docs/FEATURE_UPGRADE_10_FINAL.md`).

## 12. Explicit stop condition

This document describes a plan. Executing §10 (the actual merge into `main`) requires
separate, explicit approval from the project owner, per this round's own instructions.
Nothing in this document authorizes that merge to happen automatically or as a
follow-on to this round's PR into `development`.
