# Project state

Last updated: 2026-09-16, by Claude Sonnet 5 (Claude Code).

## Branch / commit

- Working branch: `feature/006-import-export-hardening`, based on `development`.
- `development` (origin): `74894aa` — regular merge of PR #12 (Round 5).
- `main`: unchanged this session, still `7b674f4`.
- Last full CI run confirmed green: PR #12 into `development`, all 8 jobs on the first
  push, 23 passed/7 skipped/0 failed across 30 browser tests.

## What's done

- Round 6 (import/export hardening) implemented — see
  [docs/FEATURE_UPGRADE_6.md](../docs/FEATURE_UPGRADE_6.md). Two real security gaps
  found and fixed (CSV formula-injection across every CSV export; `job_url` accepting
  unsafe protocols on both manual entry and import), one real missing capability
  closed (CSV import, feeding the existing validation/duplicate/transaction pipeline
  unchanged), and one existing-but-invisible capability surfaced (import batch
  row-level detail, plus fixing "Import History" being manager-only in the nav when
  the API already worked for everyone).
- New tests: 2 backend integration tests (real Postgres), 6 frontend unit tests (24
  total, up from 19), 1 new Playwright E2E test (5 viewports, real Postgres + real
  Chromium, verified before pushing).

## Incomplete / not started

- Branch **not yet pushed**, **no PR open**, CI has not run against it.
- Everything from Round 7 onward in [docs/PRD.md](../docs/PRD.md).

## Known state to be aware of

- Untracked root "mega-prompt" planning files remain (not committed, per convention).
- `ui-upgrade` branch's merge status still unconfirmed (low priority, carried over
  unresolved across rounds).
- **Docker Desktop is not always running by default in this environment** — at the
  start of this round `docker ps` failed until Docker Desktop's process was started
  and its daemon polled for readiness (took under a minute). If a future round's
  Docker commands fail immediately, try starting Docker Desktop first before assuming
  it's unavailable — don't silently fall back to "no real Postgres" without checking.
- A one-off, non-reproducible PIN-hash test flake was observed and is not a real bug —
  see `docs/FEATURE_UPGRADE_6.md` Known Debt.
- The Edit-UI gap for interviews/rejections/follow_ups/goals (noted in Round 5) is
  still open, as is the `#detail-stage` accessibility gap (Round 4).

## Blockers

None. Next action is mechanical (push, PR, CI) — no decision pending except the user's
eventual review/merge of the resulting PR.

## Next safe action

Push `feature/006-import-export-hardening`, open a PR into `development`, confirm CI
green, report to the user, and stop — do not begin Round 7 without explicit approval.
