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

- PR #10 is open, CI green, **not merged** — left for the user's review.
- Everything from Round 4 onward in [docs/PRD.md](../docs/PRD.md).

## Resolved this round (was flagged as a risk, turned out fine)

Visual-regression baselines were expected to need a deliberate update (dashboard tier
sections and the quick-filter row are real, intended visual changes) but did not: CI's
`browser-and-visual` job passed against the existing, unmodified baselines. Verified
this wasn't a coverage gap by confirming the tested bundle actually contains the new
markup (`widget-tier`/`quick-filters`/`data-quick-filter` present in the built JS). The
changes are visually modest enough (thin section headers, one small button row) to fall
under the suite's existing `maxDiffPixelRatio: 0.12` tolerance on a full-page
screenshot. No baseline files were touched.

## Known state to be aware of

- Untracked root "mega-prompt" planning files remain (not committed, per
  `f432aa3`/user convention) — `Feature_Upgrade_2_Codex_Prompt.md` was read and
  reconciled this round but is not itself modified or committed.
- `ui-upgrade` branch's merge status still unconfirmed (carried over from Round 2 — not
  re-investigated this round either; low priority unless it starts blocking something).
- PR #8 was squash-merged (a one-off deviation, now corrected for PR #9 onward) — see
  `brain/DECISIONS.md`. Not undone; just don't repeat it.

## Blockers

None. Waiting on the user to review/merge PR #10, then on their explicit go-ahead
before Round 4 starts.

## Next safe action

Nothing further to do on Round 3. If picking this up cold: read
`docs/FEATURE_UPGRADE_3.md`, confirm PR #10's status hasn't changed, and otherwise wait
for direction on Round 4 (or address any review feedback on PR #10 if the user has left
any).
