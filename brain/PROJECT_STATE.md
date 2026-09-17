# Project state

Last updated: 2026-09-17, by Claude Sonnet 5 (Claude Code).

## Branch / commit

- Working branch: `feature/007-task-management`, based on `development`.
- `development` (origin): merge commit `6099cb9` — regular merge of PR #13 (Round 6).
- `main`: unchanged this session.
- Local validation: all green (lint/typecheck/build/build:frontend, 55 pass/1 skipped
  unrelated across `npm test`, 26/26 backend tests against real Postgres, new E2E spec
  5/5 viewports, full existing non-pixel E2E suite unaffected). Not yet pushed — no CI
  run on this branch yet.

## What's done

- Round 7 (task management) implemented — see
  [docs/FEATURE_UPGRADE_7.md](../docs/FEATURE_UPGRADE_7.md). New `tasks` table
  (migration `009_task_management.sql`), new `backend/src/tasks.js` handler module,
  new `frontend/src/features/tasks/format.js`, `renderTasks()` +
  application-detail "Linked Tasks" panel in `app.js`, one new nav entry + nav-badge
  count, Tasks CSV export + JSON-backup inclusion.
- Key mid-round finding: `reminders` (Feature Upgrade 1) already covers most of what
  "Task management" was originally scoped to build — the round's own PRD brief said
  "no `tasks` table exists" (true) without knowing `reminders` covers due date,
  priority, status, completion, and application-linking almost identically. Surfaced
  to the user as a real product-direction question (not guessed at); decision: Tasks
  stays a **distinct** domain because `reminders.due_date` is `NOT NULL` by design and
  cannot represent an unscheduled Backlog item without changing a mature, tested,
  already-shipped feature. Full reasoning in `brain/DECISIONS.md`.
- Recurrence (daily/weekdays/weekly/monthly), complete-to-advance, verified idempotent.
- New tests: 3 backend integration tests (real Postgres) + 6 frontend/unit tests (29
  total, up from 23) + 1 new Playwright E2E spec (5 viewports).
- Also corrected `docs/PRD.md`'s top status line, stale since Round 2 (it still said
  "no implementation has started" through Round 6) — small, low-risk, clearly-justified
  fix made in passing.

## Incomplete / not started

- Not yet pushed; no PR open yet for Round 7 as of this note. Push, open PR into
  `development`, watch CI, fix any real failures, then stop per the Round 7 stop
  condition (no auto-start of Round 8).
- Everything from Round 8 onward in [docs/PRD.md](../docs/PRD.md).

## Known state to be aware of

- Untracked root "mega-prompt" planning files remain (not committed, per convention).
- `ui-upgrade` branch's merge status still unconfirmed (low priority, carried over
  unresolved across rounds — not touched this round either).
- Docker was already running at the start of this session (unlike Round 6, no manual
  Docker Desktop start was needed) — don't assume either way at the start of a future
  round; just check `docker ps` first.
- A **real Playwright test race** was found and fixed this round (not pre-existing —
  introduced and fixed within Round 7 itself): a task-view tab button triggers an
  async re-render; interacting with the form immediately after a tab click could hit
  the old, about-to-be-replaced DOM (both old and new renders have a field with the
  same accessible name, so Playwright doesn't need to wait). Fixed by adding
  `aria-pressed` to the tab buttons and waiting on it as a real settle point before
  the next interaction — a genuine accessibility improvement, not only a test hook.
  Worth generalizing the lesson: a locator that resolves without a strict-mode error
  isn't automatically safe if it might resolve to a *stale* element from a race, not
  just an *ambiguous* one (the Round 6 lesson was about ambiguity specifically).
- Nav buttons with a pending-count badge (Tasks/Interviews/Follow-Ups/Reminders) have
  an accessible name that changes once the badge appears (e.g. "Tasks" → "Tasks 1
  pending") — an E2E test clicking one of these with `exact: true` after triggering
  its badge condition will fail to match; use a non-exact/substring match instead.
- The Edit-UI gap for interviews/rejections/follow_ups/goals (noted in Round 5) is
  still open, as is the `#detail-stage` accessibility gap (Round 4). Neither touched.
- `docs/PRD.md`'s Round 7 paragraph (line ~97) still describes the original, larger
  "inbox/today/upcoming/backlog/completed + tags + subtasks" vision — deliberately
  left as the historical record of original intent; the actual implemented scope and
  reasoning for every deferral lives in `docs/FEATURE_UPGRADE_7.md`, matching how
  every prior round's reconciliation was handled.

## Blockers

None. Next action is push → PR → CI → report → stop, per the Round 7 stop condition.

## Next safe action

Push `feature/007-task-management`, open a PR into `development`, wait for CI, fix any
real failures at root cause, then produce the Round 7 implementation report and stop.
Do not start Round 8 (Habit tracker) without the user's explicit go-ahead.
