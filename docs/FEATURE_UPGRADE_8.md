# Feature Upgrade 8 — Habit Tracker

## Status

Implemented. Branch `feature/008-habit-tracker`, off `development` (which now includes
the merged Round 7 PR #14). Locally verified against real PostgreSQL and real Chromium
across all 5 viewport projects. PR #15 into `development` is open with all 8 CI checks
green on the first push — not yet merged, per the Round 8 stop condition. The Data
Model/Frequency/Completion/Streak sections below were written before any schema work,
per the round's own instruction, and match what was actually implemented without
revision.

## Goal

A lightweight habit tracker for recurring behaviors (job-search routines,
interview-prep, learning, generic user-created habits) — simple, fast, daily/weekly,
easy to complete, easy to understand. Not a fitness/quantified-self platform, not a
goal-planning suite, not a calendar engine, not social/gamified.

## Existing Related Functionality

Audited before designing any schema, per the round's instruction not to assume a new
domain is required until verified:

| Existing feature | What it actually does | Why it isn't Habits |
|---|---|---|
| `goal_settings`/`goal_snapshots` (Feature Upgrade 1 / Round 3) | A **fixed**, hardcoded set of 5 categories (`applications`, `follow_ups`, `connections`, `recruiter_messages`, `interview_prep_minutes`). `actual` is never user-logged — it's **computed** from other tables (`actualFor()` in `advanced.js` counts rows in `applications`/`follow_ups`/`networking_contacts`/`daily_goals`). `goal_snapshots` already has its own streak concept (`comparison()`'s local `streak()` helper — consecutive achieved/missed periods), a useful shape to reuse conceptually. | A goal's source of truth is *other domain tables*, not a direct user action. A habit's source of truth is the user explicitly marking it done. Users also cannot create their own goal categories — `GOAL_CATEGORIES` is a fixed array in code. Confirms Goals and Habits are structurally distinct, not overlapping implementations of the same idea. |
| `daily_goals`/`weekly_goals` (migration 001, the older/legacy goal system, still the source for `interview_prep_minutes` above) | Per-day/per-week numeric target+actual pairs, but again fixed, hardcoded fields (`applications_target`, `resumes_target`, etc.), not user-definable. | Same reasoning as above — a second, legacy instance of the "fixed KPI quota" pattern, not a generic behavior tracker. |
| `tasks` (Round 7) | Recurrence (`daily`/`weekdays`/`weekly`/`monthly`) generates **one new row** for the next occurrence when the current one is completed — no history log against the same row, no streak concept, no per-period target count. | A task's recurrence answers "when is the next one due"; a habit's completion model answers "how consistently have I done this over time," which needs a log, not a single next-due-date. |
| `reminders` (Feature Upgrade 1) | Single mandatory `due_date`/`due_time`, no repetition at all — a reminder fires once (or is snoozed once), never recurs. | No repetition/streak semantics whatsoever; a different problem (notify me once) from a habit (track me doing this repeatedly). |

No `habits`/`habit_logs`/`streak`/`routine` table or code exists anywhere in the schema
or backend (confirmed by direct search) — this is genuinely net-new, consistent with
the round's premise, and now confirmed rather than assumed.

## Domain Boundaries

Preserved, per the round's own instruction, and reinforced (not merely assumed) by the
audit above:

- **Habit** — a repeated behavior the user tracks over time against their own
  definition of it (`Practice coding daily`). Source of truth: an explicit completion
  log the user writes to directly.
- **Task** (Round 7) — a specific, one-shot actionable item (`Apply to Acme QA
  Engineer`). Recurrence advances to a new row; no per-row history.
- **Reminder** (Feature Upgrade 1) — a date/time-driven, one-time notification
  (`Remind me Friday at 9am`). No repetition.
- **Goal** (`goal_settings`/`goal_snapshots`) — a numeric target/outcome, computed
  *from other tables*, over a fixed set of job-search KPI categories the user cannot
  extend. Not something the user marks "done" directly.

No merging, no shared table, no automatic cross-domain creation (a habit does not spawn
a task or a reminder; see Out of Scope).

## User Stories

- "I want to track that I practiced coding today, and see how many days in a row I've
  kept it up."
- "I want to apply to jobs 5 days a week, not tied to a specific calendar day."
- "I want to log networking outreach 3 times this week, whichever days I actually do
  it."
- "I don't want yesterday's forgotten habit to silently vanish — I want to see my
  recent history."
- "I want habits I've stopped doing to get out of my way, without losing the record
  that I used to do them."

## Data Model

Two new tables, one new forward migration (`010_habit_tracker.sql`):

```sql
CREATE TABLE habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekdays','weekly')),
    target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count > 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_habit_owner_active ON habits(user_id, active);

CREATE TABLE habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    completion_date TEXT NOT NULL,
    value INTEGER NOT NULL DEFAULT 0 CHECK (value >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(habit_id, completion_date)
);
CREATE INDEX idx_habit_log_habit_date ON habit_logs(habit_id, completion_date);
CREATE INDEX idx_habit_log_owner_date ON habit_logs(user_id, completion_date);
```

`user_id` on `habit_logs` is redundant with `habit_id → habits.user_id` but follows
the repository's own established convention of carrying ownership directly on child
rows for fast, join-free ownership-scoped queries (`checklist_items`, `timeline_events`,
`import_rows` all do the same).

Deliberately excluded: no `current_streak` column (see Streak Semantics — derived, not
stored, per the round's explicit guidance), no `parent`/grouping table, no tags, no
application link (see Application Linking below), no `monthly` frequency (not
requested by any example in the brief, and daily/weekdays/weekly already cover every
example given).

**One completion row per (habit, calendar date), storing an absolute count** — not one
row per individual action. This single shape covers both boolean habits
(`target_count=1`, `value` is 0 or 1) and count habits (`target_count=5`, `value`
increments toward 5) without two separate systems, and makes progress updates
naturally idempotent (see Completion Model).

## Frequency Model

Three frequencies, matching every example in the brief:

- **daily** — due every calendar day.
- **weekdays** — due Monday–Friday only; weekends are not "due" and do not break a
  streak (skipped, not counted as a miss).
- **weekly** — due across the whole week as a target-per-period, e.g. "3 times per
  week" — **not** "every Monday". A weekly habit is actionable on any day of its week
  and its progress is the sum of that week's logged values against `target_count`.

No recurrence DSL, no monthly frequency, no reuse of Task's recurrence model — Task
recurrence answers "what's the next due date," which is the wrong shape for "how
consistently have I done this."

**Week boundary**: the app has exactly one explicit "week start" concept —
`users.week_start` (0–6, default 1/Monday, set in Settings). It isn't actually
*consumed* anywhere yet — the existing weekly goal-snapshot period walker just chunks
in fixed 7-day blocks from whatever start date its caller passes, and the calendar's
week view hardcodes Monday-first — but it's the one real, user-facing, documented
"week start" setting in the schema. Habits reuses it directly for weekly-period
boundaries, since the round's instruction is to reuse an established convention where
one exists rather than invent a second, inconsistent one. This is a small improvement
over the status quo (an existing setting becoming meaningfully consumed for the first
time), not a new inconsistency.

## Completion Model

`PUT /api/habits/:id/progress` with `{ completion_date, value }` — the client sends the
**absolute** value for that date (not a relative "+1"/"-1" delta), computed client-side
from the currently-displayed value. The server upserts
(`INSERT ... ON CONFLICT(habit_id, completion_date) DO UPDATE`) on the `UNIQUE(habit_id,
completion_date)` constraint.

This makes progress updates **inherently retry-safe**: resubmitting the same PUT after
a network hiccup writes the same final value, never double-counts, and never needs a
separate idempotency-key mechanism. A boolean habit's checkbox just PUTs `value: 1`
(check) or `value: 0` (uncheck); a count habit's `+`/`−` buttons PUT
`current ± 1` (clamped to a minimum of 0 — negative progress is rejected; **no** upper
clamp — `6/5` is valid and still counts as complete, matching real over-achievement).

For `target_count = 1`: completion is simply `value >= 1` (complete/incomplete). For
`target_count > 1`: progress is shown as `value / target_count`, complete once
`value >= target_count`.

Rows are **updated in place, never deleted** by a progress write — an explicit
"uncheck to 0" still leaves a historical row (`value: 0`), so history stays the
complete, honest record of what happened (or didn't) on that date, per the round's
"history is the source of truth" instruction.

## Streak Semantics

Derived from `habit_logs`, never stored as a counter — per the round's explicit
instruction and the same shape the existing Goals `comparison()` streak helper already
uses (a useful, evidence-based precedent, even though it operates on a different data
source).

A **period** is:
- for `daily`/`weekdays`: one calendar date. `weekdays` periods skip Saturday/Sunday
  entirely — a weekend does not break the streak because it was never "due."
- for `weekly`: one full week, bounded by the user's `week_start` setting.

A period is **achieved** if its summed `value` (single date for daily/weekdays, the
whole week for weekly) is `>= target_count`.

**Current streak** = the number of consecutive achieved periods walking backward from
today (or the current week), stopping at the first missed period.

**Bounded computation**: one query fetches up to 365 days of that habit's log rows
(plenty for any realistic streak; a hard, documented bound rather than scanning
unbounded history), then the streak is walked in memory. This is the same single query
already used for today's/this-week's progress (see Performance) — no extra round trip.
A streak longer than 365 days would display capped at 365; noted in Known Debt as an
intentional, currently-irrelevant trade-off.

## UI / UX

One workspace, tabs rather than three separate nav items (per the round's "avoid
excessive navigation" guidance): **Today** / **All Habits** / **History** (selecting
one habit). `frontend/src/features/habits/`:
- `format.js` — pure functions: `isDueToday`, `periodKey` (date vs. week-start
  boundary), `progressLabel` (`"3 of 5 completed today"`, never color-only),
  `computeStreak` (the generic period-walker described above), `emptyStateMessage`.

`app.js` gains a `renderHabits()` page (tab state, quick-create form, per-habit
complete/increment controls) and one nav entry — the minimum wiring, matching the
pattern established (and explicitly asked to be improved on) in Round 7.

## Scope

- Habit CRUD (create/edit/archive/reactivate/delete), ownership-enforced.
- Frequencies: daily, weekdays, weekly (target-per-week).
- Boolean and count-based completion via one unified model (`target_count`).
- Idempotent progress updates (absolute-value PUT, upsert on `(habit_id,
  completion_date)`).
- Today view (habits due today, quick-complete controls, streak).
- All Habits view (active + archived, edit/archive/reactivate/delete).
- History view (recent log rows for one habit).
- Derived streaks (daily/weekdays and weekly).
- Habits CSV export and full-workspace JSON backup inclusion (same one-line pattern
  Round 7 used for Tasks).

## Out of Scope

Per the round's explicit instructions, none of the following were started: a
calendar-heatmap visualization, gamification (points/XP/badges/leaderboards),
notifications of any kind (habits reuse nothing from Reminders' infrastructure),
automatic Task or Reminder creation from a habit, application-linking (a habit is
cross-application behavior by nature — `Apply to jobs daily` isn't tied to one job),
a Goals redesign or Habit/Goal unification, a Dashboard redesign, and a Journal.

## Architecture

`backend/src/habits.js` — a new, self-contained handler module
(`validateHabit`/`validateProgress`, `listHabits` (one habits query + one bounded logs
query, never N+1), `computeStreak`, `handleHabits`), following the exact
`handle<X>(context, helpers)` pattern `tasks.js`/`advanced.js`/`feature-upgrade.js`
already established.

## Database Impact

Two new tables, four new indexes, zero changes to any existing table. New forward
migration; no existing migration file touched. Validated against real PostgreSQL (see
PostgreSQL Validation).

## API Design

- `GET /api/habits?view=today|all&active=true|false|all&user_id=` — every returned
  habit includes today's/this-week's progress and its derived streak in one response
  shape, regardless of view (see Performance).
- `POST /api/habits` — create (`target_user_id` supported for managers, matching every
  other resource).
- `PATCH /api/habits/:id` — edit name/description/frequency/target_count/active.
- `DELETE /api/habits/:id` — hard delete, cascades `habit_logs` (`ON DELETE CASCADE`,
  verified against real Postgres). Archiving (`PATCH {active:false}`) is the
  recommended path when history matters; delete remains available and consistent with
  every other resource in this app that already supports it.
- `PUT /api/habits/:id/progress` — idempotent absolute-value progress write (see
  Completion Model).
- `GET /api/habits/:id/history?days=30` — recent log rows for one habit.

## Implementation Tasks

1. Audit Goals/Tasks/Reminders overlap (done above).
2. Write this document.
3. Add migration `010_habit_tracker.sql`.
4. Implement `backend/src/habits.js`.
5. Wire `handleHabits` into `server.js`; add CSV/JSON export entries.
6. Implement `frontend/src/features/habits/format.js`.
7. Implement `renderHabits()` and nav entry in `app.js`.
8. Add backend/unit tests.
9. Add a Playwright E2E spec, with controlled date fixtures (see Testing).
10. Validate against real PostgreSQL and real Chromium (5 viewports).
11. Update continuity docs.

## Acceptance Criteria

Create/edit/archive/reactivate a habit; choose a simple frequency; define a target
count; see habits due today; record progress; see completion state; refresh without
losing progress; see recent history; see a derived streak; usable on
desktop/tablet/mobile.

## Testing

Habit/streak logic is date-sensitive, so "today" is derived from one centralized
function (`isoDate()`, matching the pattern already used in `tasks.js`), not scattered
`new Date()` calls — and the E2E spec drives dates explicitly via `completion_date` in
API calls rather than depending on the real current date lining up with a fixture,
avoiding a flaky, time-dependent test.

- **Backend/integration**: create/list/edit/archive/reactivate/delete a habit; IDOR;
  ownership cannot be changed; mass-assignment protection; frequency/target_count
  validation; progress upsert idempotency (same PUT twice → same state, no duplicate
  rows, `UNIQUE` constraint holds); negative-value rejection; over-target value
  accepted; `ON DELETE CASCADE` removes `habit_logs` with the habit (verified against
  real Postgres); weekday-only due-today filtering; weekly progress summed correctly
  across a week boundary.
- **Unit**: `computeStreak` for daily (with a gap), weekdays (weekend doesn't break
  it), and weekly (across a week-start boundary); `progressLabel`/`isDueToday`.
- **E2E**: create a daily habit, complete it, refresh, verify persistence; create a
  count habit, increment to target, verify completion; create a weekdays habit, verify
  it's absent from Today on a stubbed weekend date (via a direct API-seeded log, not a
  literal weekend wait); archive a habit, verify it leaves Today and its history
  remains reachable; mobile completion flow; accessibility scan.

## Security

Every operation ownership-scoped server-side (`ownedHabit`, mirroring `ownedTask`);
mass assignment blocked (`user_id`/`owner_id`/`id`/timestamps rejected); progress
writes require owning the target habit; input length/range validated (`name`,
`description`, `target_count` bounded to prevent abuse); text rendered through the
app's existing `esc()` helper, no unescaped `innerHTML`; CSRF required on every
mutation.

## Accessibility

Progress is always exposed as text (`"3 of 5 completed today"`), never color-only;
completion controls use explicit `aria-label`s matching the `checklist_items`/`tasks`
pattern; streak state is text, not just a badge color.

## Responsive Behavior

Verified across all 5 configured viewport projects. Count controls
(`−`/count/`+`) sized for touch on tablet/mobile, no tiny tap targets.

## Performance

One habits query + one bounded (365-day) logs query per list call — never N+1 across
habits. No pagination/caching/background workers added (habit volume is expected to
stay small, per the round's own guidance).

## Files Changed

- `backend/jobsearch/migrations/010_habit_tracker.sql` (new)
- `backend/src/habits.js` (new)
- `backend/src/server.js` (wire `handleHabits`)
- `backend/src/advanced.js` (CSV/JSON export entries)
- `backend/src/feature-upgrade.js` (`habits_due_today` nav count, daily-only)
- `backend/package.json` (`lint`/`typecheck` now include `src/habits.js`)
- `frontend/src/features/habits/format.js` (new)
- `frontend/src/app.js` (nav, routing, `renderHabits`, `bindHabitActions`, edit prompt)
- `frontend/src/icons.js` (`repeat`)
- `frontend/src/styles.css` (`.habit-list`/`.habit-row`/`.habit-count`/
  `.habit-history-list`)
- `backend/test/app.test.js` (+3 integration tests)
- `backend/test/frontend.test.js` (+8 unit tests)
- `backend/e2e/jobquest.spec.js` (+1 spec; renamed the shared tab-settle helper from
  `selectTaskView` to `selectTab` since Habits reuses the identical pattern)
- `docs/FEATURE_UPGRADE_8.md` (new, this file)
- `tasks/BACKLOG.md`, `tasks/CURRENT_TASK.md`, `brain/PROJECT_STATE.md`,
  `brain/AGENT_HANDOFF_LOG.md` (continuity)

## Commits

Scoped, in order: domain audit + this document; schema migration + backend `habits.js`
+ server wiring; frontend feature module + UI wiring; backend/unit tests; E2E test
(plus the two locator fixes it surfaced); continuity docs.

## CI Status

All 8 CI jobs green on the first push (PR #15 into `development`) — no fix round
needed. `browser-and-visual`: 38 passed / 7 skipped / 0 failed across 45 browser
tests (up from 33 passed in Round 7's final state; the +5 is exactly the new Habits
spec across the 5 viewport projects), including zero visual-regression diffs against
the existing baselines.

## Known Debt

- Streak lookback is bounded at 365 days — a deliberate, documented trade-off; a
  genuine streak longer than that would display capped. Trivial to raise later.
- No calendar-heatmap visualization (explicitly out of scope this round).
- No Habit→Task/Reminder integration (explicitly out of scope this round).
- `users.week_start` was previously stored but unused; Habits is the first feature to
  actually consume it for a weekly boundary. Worth revisiting whether the calendar's
  hardcoded Monday-first week view and the goal-snapshot weekly walker should also
  start honoring it, for consistency — not done here (out of this round's scope, a
  pre-existing inconsistency this round did not introduce).
- The `habits_due_today` nav-badge count is deliberately `daily`-frequency-only (not
  `weekdays`/`weekly`) — a cross-dialect-safe weekday function (SQLite `strftime` vs.
  Postgres `EXTRACT`) doesn't exist in this shared query layer, and the badge is a
  secondary nav affordance, not the source of truth (the Habits page itself computes
  due-today correctly in JS). A minor, documented undercount for `weekdays`/`weekly`
  habits in the badge only.
- Habit edit uses a sequential `prompt()` flow (name → description → frequency →
  target_count), matching the exact pattern this codebase already uses for reminder
  category rename (`renderCategories`). A richer inline form was considered but not
  justified for four fields edited infrequently; revisit if habit editing turns out to
  be a frequent action in practice.
- **Two real, non-pre-existing bugs were found and fixed while writing this round's
  E2E spec** (both are new instances of lessons first surfaced in Rounds 6/7, applied
  here in a new shape): (1) rapid sequential clicks on the count habit's `+`/`−`
  buttons raced their own async re-render exactly like the Round 7 tab-click race —
  clicking again before the previous click's PUT+re-render settled could read a stale
  `data-value` off the about-to-be-replaced button and under-count. Fixed by awaiting
  each click's expected, settled result before issuing the next one (not by adding a
  server-side fix — the server was already correct and idempotent; the race was purely
  a test-timing issue). (2) `getByText("Weekly")` was ambiguous against both a habit
  row's text and the create form's own "Weekly" `<option>`, the same shape as Round 6's
  ambiguous-heading lesson — fixed by scoping the locator to `#habit-list`.
- This app has no URL-based routing (`state.page` lives only in memory), so a real
  `page.reload()` always lands back on the Dashboard, for every page, not just Habits —
  already documented at the Round 4 checklist test. The Habits E2E spec verifies
  persistence via a direct `page.request.get("/api/habits?view=today")` call instead,
  matching that established pattern rather than rediscovering it.

## Completion Notes

Round 8 delivered the full MVP acceptance criteria: CRUD, archive/reactivate, three
frequencies, boolean and count-based completion sharing one model, idempotent progress
writes, derived (never stored) streaks including a weekday-skip and a weekly
week-start-aware boundary, and a recent-history view — verified against real
PostgreSQL and real Chromium across all 5 viewports. The domain boundaries the round
asked to preserve (Habit distinct from Task/Reminder/Goal) held up under audit without
needing any exception, unlike Round 7 where the audit forced a genuine mid-round
product decision — this round's audit confirmed the four domains really are as
distinct as the brief assumed.
