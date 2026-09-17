# Current task

**Status: Round 7 implemented locally, all local checks green, not yet pushed / no PR
open yet.** See [docs/FEATURE_UPGRADE_7.md](../docs/FEATURE_UPGRADE_7.md) for full
detail.

Branch: `feature/007-task-management`, based on `development` (which now includes the
merged Round 6 PR #13 — regular merge, per convention).

## What just happened

1. PR #13 (Round 6) merged into `development` via regular merge commit; confirmed all
   8 CI checks were green beforehand.
2. Audited every task-like domain before writing any schema: `reminders` (Feature
   Upgrade 1) turned out to already cover most of what "Task management" describes —
   due date, priority, status, completion, a derived Overdue/Due Today/Upcoming state,
   even automatic application-linking. `checklist_items`, `follow_ups`, and
   `goal_settings`/`goal_snapshots` were confirmed structurally distinct and untouched.
3. Surfaced the Reminders overlap to the user mid-round (a genuine product-direction
   fork, not a routine implementation detail) rather than guessing. Decision: Tasks
   stays a **distinct** domain — `reminders.due_date` is `NOT NULL` by design (it's a
   notification system), while Tasks needs a nullable due date to support an
   unscheduled Backlog. See `brain/DECISIONS.md` for the full reasoning.
4. Implemented the MVP: new `tasks` table (migration `009_task_management.sql`), a new
   `backend/src/tasks.js` handler module (CRUD, ownership checks, application-linking
   ownership checks, recurrence), four views (Today/Upcoming/Backlog/Completed —
   deliberately merged the brief's separate Inbox/Backlog into one, since both resolve
   to the identical `due_date IS NULL` predicate), a compact "Linked Tasks" panel on
   the application detail page, a nav entry + nav-badge count, and CSV/JSON export
   inclusion (one-line additions to already-generic, already-safe export code).
5. Recurrence (daily/weekdays/weekly/monthly): complete-to-advance model, exactly one
   next occurrence per completion, verified idempotent (completing an already-completed
   recurring task a second time creates no duplicate) via a dedicated backend test.
6. Verified with the same rigor as every prior round: real Postgres via Docker (running
   in this environment without needing to start Docker Desktop manually this time) —
   26/26 backend tests including 3 new Round 7 tests; real Chromium — new E2E spec 5/5
   viewports, full existing non-pixel suite unaffected.
7. Found and fixed one real bug during E2E testing (not pre-existing — introduced and
   fixed within this same round): clicking a task-view tab triggers an async
   re-render, and a `.fill()`/`.click()` issued immediately after could land on the
   old, about-to-be-replaced form instead of the new one (both have a field with the
   same label). Fixed by adding `aria-pressed` to the tab buttons — a genuine
   accessibility improvement, not only a test hook — and waiting on it as a real
   settle point.

## Next safe action

Push the branch, open a PR into `development`, wait for CI, fix any real failures at
root cause (not by loosening assertions), then produce the Round 7 implementation
report and stop per the round's explicit stop condition — do not start Round 8
(Habit tracker) without the user's explicit go-ahead.
