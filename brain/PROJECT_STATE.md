# Project state

Last updated: 2026-09-17, by Claude Sonnet 5 (Claude Code).

## Branch / commit

- Working branch: `feature/008-habit-tracker`, based on `development`.
- `development` (origin): merge commit `da3a41d` — regular merge of PR #14 (Round 7).
- `main`: unchanged this session.
- Local validation: all green (lint/typecheck/build/build:frontend, 66 pass/1 skipped
  unrelated across `npm test`, 29/29 backend tests against real Postgres, new E2E spec
  5/5 viewports, full existing non-pixel E2E suite unaffected). Not yet pushed — no CI
  run on this branch yet.

## What's done

- Round 8 (habit tracker) implemented — see
  [docs/FEATURE_UPGRADE_8.md](../docs/FEATURE_UPGRADE_8.md). New `habits`/`habit_logs`
  tables (migration `010_habit_tracker.sql`), new `backend/src/habits.js` handler
  module, new `frontend/src/features/habits/format.js`, `renderHabits()` in `app.js`,
  one new nav entry + nav-badge count (`habits_due_today`, daily-frequency only —
  see Known Debt), Habits CSV export + JSON-backup inclusion.
- Domain audit (Goals/Tasks/Reminders) *confirmed* the brief's assumed boundaries
  rather than overturning them, unlike Round 7 — Goals are fixed KPI categories
  computed from other tables, Tasks recurrence advances to a new row with no per-row
  history, Reminders have no repetition at all. Habits needed its own completion-log
  domain. Full reasoning in `docs/FEATURE_UPGRADE_8.md` "Existing Related
  Functionality"/"Domain Boundaries" (no new `brain/DECISIONS.md` entry was needed
  this round since no brief-vs-reality conflict arose to resolve).
- One unified completion model for boolean (`target_count=1`) and count
  (`target_count>1`) habits: one row per (habit, date) storing an absolute value,
  upserted idempotently via `ON CONFLICT(habit_id, completion_date) DO UPDATE` — makes
  progress writes inherently retry-safe without a separate idempotency mechanism.
  Streaks are derived (never stored), reusing the same computational shape as the
  existing Goals `comparison()` streak helper, applied to a different data source.
- `users.week_start` (previously stored but unconsumed anywhere) is now actually used,
  for weekly habits' period boundaries.
- New tests: 3 backend integration tests (real Postgres) + 8 frontend/unit tests (37
  total, up from 29) + 1 new Playwright E2E spec (5 viewports).

## Incomplete / not started

- Not yet pushed; no PR open yet for Round 8 as of this note. Push, open PR into
  `development`, watch CI, fix any real failures, then stop per the Round 8 stop
  condition (no auto-start of Round 9).
- Everything from Round 9 onward in [docs/PRD.md](../docs/PRD.md).

## Known state to be aware of

- Untracked root "mega-prompt" planning files remain (not committed, per convention).
- `ui-upgrade` branch's merge status still unconfirmed (low priority, carried over
  unresolved across rounds — not touched this round either).
- **Re-running backend integration tests against the same already-migrated Postgres
  container a second time will fail** with `duplicate key value violates unique
  constraint "users_username_key"` on every test, starting with the first one — this
  is expected (fixed usernames collide against leftover rows from the prior run), not
  a real bug. Reset the container (`docker rm -f` + re-run + re-migrate) between
  repeated manual validation passes against the same container, the way CI's fresh
  service container does automatically. Hit and correctly diagnosed this round;
  worth remembering before treating a second Postgres run's failures as real.
- Two real (not pre-existing) Playwright bugs found and fixed this round, both new
  instances of Round 6/7 lesson shapes: (1) rapid clicks on a count habit's `+`/`−`
  buttons raced their own async re-render, identical in shape to Round 7's tab-click
  race — fixed by awaiting each click's settled result before the next, rather than
  batching clicks. (2) An unscoped `getByText("Weekly")` matched both a habit row and
  the create form's own "Weekly" `<option>` — same shape as the Round 6 ambiguous-
  heading lesson, fixed by scoping to `#habit-list`.
- Confirmed (by hitting it, not by reading a comment first) and then followed an
  existing documented pattern: this app has no URL-based routing (`state.page` lives
  only in memory), so a real `page.reload()` in an E2E test always lands back on the
  Dashboard for *every* page, not just Habits — already noted at the Round 4 checklist
  test. Verify persistence via a direct `page.request.get(...)` call instead.
- `habits_due_today` (nav badge) only counts `daily`-frequency habits — no safe
  cross-dialect (SQLite/Postgres) weekday function exists in the shared query layer
  for `weekdays`, and `weekly` habits aren't single-day-scoped at all. Documented,
  minor limitation in a secondary nav affordance; the Habits page itself is correct.
- The Edit-UI gap for interviews/rejections/follow_ups/goals (Round 5) and the
  `#detail-stage` accessibility gap (Round 4) are both still open. Neither touched.

## Blockers

None. Next action is push → PR → CI → report → stop, per the Round 8 stop condition.

## Next safe action

Push `feature/008-habit-tracker`, open a PR into `development`, wait for CI, fix any
real failures at root cause, then produce the Round 8 implementation report and stop.
Do not start Round 9 (Journal) without the user's explicit go-ahead.
