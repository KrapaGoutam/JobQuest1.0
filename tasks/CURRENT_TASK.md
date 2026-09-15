# Current task

**Status: Round 3 implemented locally, CI/visual-baseline update in progress.** See
[docs/FEATURE_UPGRADE_3.md](../docs/FEATURE_UPGRADE_3.md) for full detail.

Branch: `feature/003-dashboard-applications-revamp`, based on `development` (which now
includes the merged Round 2 PR #9 — regular merge commit, matching the repo's existing
convention).

## What just happened

1. PR #9 (Round 2) merged into `development` via a regular merge commit (not squash —
   correcting course from PR #8, which was squash-merged; documented as a one-off
   deviation, not repeated).
2. Reconciled `Feature_Upgrade_2_Codex_Prompt.md` against the actual codebase: most of
   its search/filter/sort/saved-views/export wishlist **already exists** (see the
   reconciliation table in `docs/FEATURE_UPGRADE_3.md`) — the prompt was written without
   full knowledge of this schema/UI. Implemented only the real gaps: a dashboard
   information hierarchy (three tiers) and Applications quick filters, plus removed one
   dead frontend function (`legacyRenderApplications`, 101 lines, zero callers).
3. Added `status_group` (active/closed) support to the backend query builder — the one
   genuinely new server-side capability this round needed.
4. Local checks pass: lint/typecheck/build/`build:frontend`/`test:frontend` (13 tests).
   DB-backed and browser tests deferred to CI (no local Postgres/Playwright browser
   install in this environment — same constraint as every prior round).

## Next safe action

Push the branch, open a PR into `development`, and get CI green. **This round
intentionally changes Dashboard/Applications visuals**, so unlike Round 2, the
visual-regression baselines are expected to need a deliberate update, not a
zero-diff pass — inspect what changed, confirm it's only the intended tier/quick-filter
UI, and commit updated baselines with that inspection documented (see
`docs/FEATURE_UPGRADE_3.md`'s CI Status section once filled in). Do not merge to `main`.
Do not start Round 4 until this PR is merged and the user has explicitly said to
proceed.
