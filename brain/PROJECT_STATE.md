# Project state

Last updated: 2026-09-14, by Claude Sonnet 5 (Claude Code).

## Branch / commit

- Working branch: `feature/002-frontend-build-tooling`, based on `development`.
- `development` (origin): `36ccaef` — the squash-merged planning-foundation PR #8
  (which, as a side effect of branching from `main`, also brought `development` up to
  date with the previously-`main`-only pg-pool-crash fix; `development` and `main` now
  match exactly on application code).
- `main`: unchanged this session, still `7b674f4`.
- Last full CI run confirmed green: PR #8 into `development`, all 8 jobs, after fixing
  a self-tripped secret-pattern grep gate in `docs/SECURITY.md`.

## What's done

- Round 2 (frontend build tooling) implemented — see
  [docs/FEATURE_UPGRADE_2.md](../docs/FEATURE_UPGRADE_2.md) for full detail: Vite build,
  `frontend/src`+`frontend/public` layout, backend serves `frontend/dist`, Render/CI
  updated, one test file's import paths updated.
- Verified locally: lint, typecheck, build, `test:frontend`, `npm audit` (backend +
  frontend), and a manual cold-start smoke test.

## Incomplete / not started

- This branch is **not yet pushed** and has **no PR** open yet — CI has not run against
  it. That's the very next step.
- Everything from Round 3 onward in [docs/PRD.md](../docs/PRD.md).

## Known state to be aware of

- Same as before (see `brain/DECISIONS.md` and the prior entry in
  `brain/AGENT_HANDOFF_LOG.md`): untracked root "mega-prompt" files are the user's own
  drafts, not to be committed; `ui-upgrade` branch's merge status is still unconfirmed.
- Playwright visual-regression baselines in this repo are Linux-generated
  (`backend/e2e/jobquest.spec.js-snapshots/`) — this repo's own history shows
  Windows-generated baselines were reverted as invalid. Do not attempt to regenerate or
  judge visual-regression results from a local Windows run; only trust the
  `browser-and-visual` CI job (ubuntu-latest).
- No local Postgres is available in this environment — DB-backed suites
  (backend/integration/e2e/migration/browser tests) were not run locally this session;
  they must be validated via CI on the pushed branch, same as was done for PR #8.

## Blockers

None. Waiting to push the branch and open the PR (next action), then waiting on the
user's explicit go-ahead before Round 3 starts (per the Round 2 stop condition).

## Next safe action

Push `feature/002-frontend-build-tooling`, open a PR into `development`, get full CI
green (especially zero visual-regression diffs), report results to the user, and stop —
do not begin Round 3 without explicit approval.
