# Project state

Last updated: 2026-09-14, by Claude Sonnet 5 (Claude Code).

## Branch / commit

- Working branch: `feature/003-dashboard-applications-revamp`, based on `development`.
- `development` (origin): `806bd2e` — regular merge of PR #9 (Round 2). `development`
  and `main` match exactly on application code (Round 2 changes are additive/frontend).
- `main`: unchanged this session, still `7b674f4`.
- Last full CI run confirmed green: PR #9 into `development` (second run, after a
  docs-only follow-up commit), all 8 jobs, browser-and-visual 13/7/0 (pass/skip/fail).

## What's done

- Round 3 (dashboard + applications workspace) implemented — see
  [docs/FEATURE_UPGRADE_3.md](../docs/FEATURE_UPGRADE_3.md): dashboard 3-tier
  information hierarchy, Applications quick filters (`status_group` added
  server-side), dead-code removal (`legacyRenderApplications`), unit + integration
  tests for all of it.
- Reconciled `Feature_Upgrade_2_Codex_Prompt.md` against the real codebase — most of
  its wishlist (search/filter/sort/saved-views/Kanban/export) turned out already
  implemented; only two genuinely new things were built this round. Full reconciliation
  table in the feature doc.
- Verified locally: lint, typecheck, build, `build:frontend`, `test:frontend` (13
  tests, up from 9).

## Incomplete / not started

- Branch **not yet pushed**, **no PR open**, CI has not run against it.
- **Visual-regression baselines will need a deliberate update** this round (unlike
  Round 2) — the dashboard tier sections and quick-filter row are real, intended visual
  changes. This must happen via CI (ubuntu-latest); do not attempt to generate or judge
  baselines from a local Windows run. Plan: push branch → PR → let `browser-and-visual`
  fail showing the expected diffs → run a one-off Linux job with
  `test:visual:update` → commit the updated snapshots → confirm CI green → document
  exactly which snapshots changed and why in `docs/FEATURE_UPGRADE_3.md`.
- DB-backed suites (backend/integration/e2e/migration) and the browser suite itself:
  not run locally (no local Postgres/Playwright browsers in this environment); must be
  validated via CI, same as every prior round.
- Everything from Round 4 onward in [docs/PRD.md](../docs/PRD.md).

## Known state to be aware of

- Untracked root "mega-prompt" planning files remain (not committed, per
  `f432aa3`/user convention) — `Feature_Upgrade_2_Codex_Prompt.md` was read and
  reconciled this round but is not itself modified or committed.
- `ui-upgrade` branch's merge status still unconfirmed (carried over from Round 2 — not
  re-investigated this round either; low priority unless it starts blocking something).
- PR #8 was squash-merged (a one-off deviation, now corrected for PR #9 onward) — see
  `brain/DECISIONS.md`. Not undone; just don't repeat it.

## Blockers

None. Next action is mechanical (push, PR, CI, baseline update) — no decision pending
except the user's eventual review/merge of the resulting PR.

## Next safe action

Push `feature/003-dashboard-applications-revamp`, open a PR into `development`, run the
one-off Linux baseline-update job described above once `browser-and-visual` shows the
expected diffs, commit the updated baselines with a clear description of what changed,
confirm full CI green, update `docs/FEATURE_UPGRADE_3.md`'s CI Status section, report to
the user, and stop — do not begin Round 4 without explicit approval.
