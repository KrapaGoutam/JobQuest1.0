# Project state

Last updated: 2026-09-14, by Claude Sonnet 5 (Claude Code).

## Branch / commit

- Working branch: `feature/004-application-checklist-gap-close`, based on `development`.
- `development` (origin): `7dc295a` — regular merge of PR #10 (Round 3).
- `main`: unchanged this session, still `7b674f4`.
- Last full CI run confirmed green: PR #11 into `development`, all 8 jobs,
  browser-and-visual 18/7/0 (pass/skip/fail) across 25 tests (5 new checklist tests,
  one per viewport project, plus the 13 pre-existing baseline tests unchanged).

## What's done

- Round 4 (application checklist gap-close) implemented, tested, pushed, and PR'd —
  see [docs/FEATURE_UPGRADE_4.md](../docs/FEATURE_UPGRADE_4.md): full CRUD (edit/
  delete/reorder added; create/complete/progress/ownership already existed),
  server-side validation, lifecycle-phase display grouping (read-time only, no schema
  change), plus real Playwright E2E coverage (none existed for checklist before).
- Along the way: fixed a real Postgres-only dialect bug (CI caught it, fixed, verified
  locally against a throwaway Postgres container), a real new a11y contrast violation
  from this round's own Delete button, and two pre-existing unrelated a11y violations
  on the same page (fixed in passing, one-line each) — a third pre-existing one
  (`#detail-stage`) was deliberately left for the backlog, not fixed, to avoid scope
  creep into an unrelated page-wide audit.
- 16 frontend unit tests (up from 13), 1 new backend integration test, 1 new E2E test
  (5 viewport variants) — all green on CI.

## Incomplete / not started

- PR #11 is open, CI green, **not merged** — left for the user's review.
- Everything from Round 5 onward in [docs/PRD.md](../docs/PRD.md).

## Correction to earlier rounds' notes

Rounds 2/3 recorded "no local Postgres available in this environment" as a constraint.
That was wrong — **Docker is available locally**, and so is installing Playwright's
Chromium (`npx playwright install chromium` — confirmed working, no proxy/network
issue). Round 4 used both: a throwaway `postgres:17-alpine` container caught and let a
real Postgres-dialect bug get fixed and verified before pushing, and a local Chromium
install let the new E2E test run for real (all 5 viewports) before trusting CI with it.
Prefer verifying locally over round-tripping through CI when the tooling is available —
it is, in this environment, for both Postgres and Playwright.

## Known state to be aware of

- Untracked root "mega-prompt" planning files remain (not committed, per convention).
- `ui-upgrade` branch's merge status still unconfirmed (low priority, carried over
  unresolved across rounds).
- Checklist's `note` field is editable server-side via the same PATCH used for
  label/completed, but no frontend control sends it except through the (still
  UI-inaccessible-for-notes) completion flow — see Known Debt in the feature doc.
- `#detail-stage` (application detail page) has no accessible name — real,
  critical-impact, pre-existing, not fixed this round (out of scope) — backlogged.
- Playwright visual baselines remain Linux-only for pixel comparisons; a local Windows
  run is fine for functional/accessibility signal but never authoritative for pixel
  diffs (established Round 2/3, still true — confirmed again this round: the new
  checklist E2E test's *functional* assertions were verified locally on Windows before
  push, but the *visual*-regression tests were only trusted from CI).

## Blockers

None. Waiting on the user to review/merge PR #11, then on their explicit go-ahead
before Round 5 starts.

## Next safe action

Nothing further to do on Round 4. If picking this up cold: read
`docs/FEATURE_UPGRADE_4.md`, confirm PR #11's status hasn't changed, and otherwise wait
for direction on Round 5 (or address any review feedback on PR #11 if the user has left
any).
