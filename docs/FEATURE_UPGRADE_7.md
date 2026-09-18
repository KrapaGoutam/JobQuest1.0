# Feature Upgrade 7 — Task Management

## Status

Implemented. Branch `feature/007-task-management`, off `development` (which now includes
the merged Round 6 PR #13). Locally verified against real PostgreSQL and real Chromium
across all 5 viewport projects. PR into `development` open, CI pending review — not yet
merged, per the Round 7 stop condition.

## Goal

A lightweight, fast productivity layer for job-search and personal task tracking —
title, priority, optional due date, optional application link, optional simple
recurrence. Not a Notion clone, not a checklist replacement, not a second Reminders.

## User Problems

- "What do I need to do today, across every application I'm tracking?"
- "I thought of something to do later — I don't want to lose it, but it has no date yet."
- "I want a task tied to a specific application without digging through that
  application's page to remember it."
- "Some of my to-dos repeat every week — I don't want to recreate them by hand."

## Existing Related Functionality

Audited before writing any schema, per the round's own instruction not to assume no
task-like table exists:

| Existing feature | What it already does | Overlap with "Tasks" |
|---|---|---|
| `reminders` + `reminder_categories` (Feature Upgrade 1) | Full CRUD, categories, priority (Low/Medium/High), status (Upcoming/Snoozed/Completed/Cancelled), `due_date`+`due_time` (both **required**), snooze, a derived Overdue/Due Today/Upcoming state (`reminderState()`, computed — not stored), polymorphic `related_record_type`/`related_record_id` link (already used to auto-create a reminder when a follow-up is created), nav-visible "Reminder Center" page, dashboard widget, CSV export, calendar integration. | Very high — due date, priority, status, completion, application-linking are all already there. See **Domain Boundaries** below for why this round did not extend it. |
| `checklist_items` (Round 4) | Per-application, ordered, template-seeded checklist rows scoped to one specific application (`application_id NOT NULL`). | Low — a checklist item only exists in the context of one application's workflow; it isn't a schedulable, cross-application to-do. The round prompt explicitly warned against conflating these, and the audit confirms they're structurally distinct (owning FK is `NOT NULL` vs `NULL`-able). |
| `follow_ups` (Feature Upgrade 1) | Due-dated contact/recruiter follow-up tracking, tied to an application/interview/networking contact (at least one required), its own status enum, auto-creates a `reminders` row. | Low-medium — a follow-up is a specific, typed CRM action, not a general to-do. Left untouched, per the round's explicit instruction not to migrate this domain silently. |
| `goal_settings`/`goal_snapshots` (Feature Upgrade 1 / Round 3) | Daily/weekly numeric targets (applications sent, connections made, etc.) and their historical snapshots. | None — goals are aggregate counters over a period, not individual actionable items. Confirmed distinct; not touched. |
| `tags` + `application_tags` (Feature Upgrade 1) | User-owned tag rows, but the join table (`application_tags`) is applications-only. | None usable directly — adding task tagging would need a new `task_tags` join table. Deferred (see Known Debt); not required by this round's acceptance criteria. |

## Domain Boundaries

**Decision (made with the user — see the mid-round clarifying question in this
session): Tasks is a distinct domain from Reminders, not an extension of it.**

Reminders and Tasks look similar on the surface but serve different purposes:

- **Reminders** are date-mandatory notifications: `due_date` is `NOT NULL` in the
  schema, they support snoozing, and they're organized by user-defined categories. They
  exist to *tell you something is coming up*.
- **Tasks** are to-do items that may or may not have a date yet. `tasks.due_date` is
  nullable specifically so a task can sit in an unscheduled **Backlog** — something
  `reminders` cannot represent without a schema change to a table three other rounds'
  worth of features already depend on. Tasks exist to *track what you need to do*, not
  to notify you.

Extending `reminders` to also cover undated backlog items and renaming/repurposing the
existing, tested, nav-visible "Reminder Center" was considered and rejected: it would
have meant changing behavior of a mature, working feature to serve a second purpose,
for a smaller net change than standing up one new table. A separate `tasks` table with
its own minimal API keeps both features simple and correct on their own terms. No data
migration between the two was performed or is planned — they remain two distinct lists.

Checklist items, follow-ups, and goals were all confirmed structurally distinct (see
table above) and were not touched.

## Data Model

New table, one new forward migration (`009_task_management.sql`):

```sql
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed')),
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
    due_date TEXT,
    completed_at TEXT,
    recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN ('daily','weekdays','weekly','monthly')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_task_owner_due ON tasks(user_id, due_date);
CREATE INDEX idx_task_owner_status ON tasks(user_id, status);
CREATE INDEX idx_task_application ON tasks(application_id);
```

Deliberately excluded (see MVP acceptance criteria and Known Debt):
- No `parent_task_id` (subtasks deferred — see Known Debt).
- No `tags` relationship (deferred — see Known Debt).
- No `sort`/`position` column — views are entirely derived from `status`/`due_date`/
  `priority`, per the round's own "avoid storing redundant state that can drift"
  guidance. No manual drag-and-drop ordering was requested or implemented.
- `status` is a two-value enum (`open`/`completed`), not a bigger state machine —
  "Today"/"Upcoming"/"Backlog" are *views*, computed from `due_date` vs today's date,
  never stored. This mirrors exactly how `reminders`' own `reminderState()` already
  works, and matches the round's explicit instruction to prefer derived views.

Indexes were chosen against the actual queries this round issues (owner+due-date range
scans for Today/Upcoming, owner+status for Completed history, application_id for the
application-detail linked-tasks panel) — not added speculatively.

## API Design

One coherent resource, `backend/src/tasks.js` (`handleTasks`, wired into `server.js`
exactly like the existing `handleAdvanced`/`handleFeatureUpgrade` handler modules):

- `GET /api/tasks?view=today|upcoming|backlog|completed|all&application_id=&user_id=`
  — view defaults to `today`. `user_id` (manager-only, same convention as every other
  tracker) scopes to another user's tasks.
- `POST /api/tasks` — create. `target_user_id` supported for managers, same as
  `POST /api/applications`.
- `PATCH /api/tasks/:id` — edits `title`/`notes`/`priority`/`due_date`/
  `application_id`/`recurrence`, and/or a `status: "open"|"completed"` transition, in
  one call. `status` is handled as an explicit state transition (not a free-form
  field) so completion/reopen side effects (see Recurrence Strategy) stay predictable.
- `DELETE /api/tasks/:id`.

No single-task `GET` endpoint was added — nothing in this round's UI needs to fetch one
task in isolation (the list endpoint and the application-detail bundle cover every
read), and the round's own instruction is to keep the query surface small.

## UI / UX

`frontend/src/features/tasks/`:
- `format.js` — pure, unit-tested functions (`isOverdue`, `dueDateLabel`,
  `emptyStateMessage`, `recurrenceLabel`, `priorityRank`). No DOM code.

`app.js` gained: a `renderTasks()` page, `taskRowHtml`/`bindTaskActions` (shared
between the Tasks page and the application-detail panel), `applicationTasksView`/
`bindDetailTasks`, one nav entry, one grouped-nav placement (in "Activity", next to
Reminders/Interviews/etc.), one nav-badge count (`tasks_due_today`, same mechanism as
the existing interviews/follow-ups/reminders badges), and one new icon
(`check-square`). This is intentionally the *minimum* wiring `app.js` needed — all
formatting logic lives in the feature module, matching the round's explicit
"demonstrate the modular architecture Vite enables" instruction.

Quick-add is a single always-visible form (Title required; due date, priority,
application link, and repeat are all optional) — no modal required to create a task.

## Views

Four views, not five — see the note below on collapsing Inbox into Backlog.

- **Today**: `status='open' AND due_date IS NOT NULL AND due_date <= today`, ordered
  by `due_date ASC` (which naturally sorts older/overdue dates first), then priority.
  Overdue tasks are labeled explicitly ("Overdue — was due …"), never color-only.
- **Upcoming**: `status='open' AND due_date > today`, ordered by `due_date ASC`, then
  priority.
- **Backlog**: `status='open' AND due_date IS NULL`, ordered by priority, then
  `created_at DESC`. This is also where the round prompt's separate "Inbox" view would
  have lived — see below.
- **Completed**: `status='completed'`, ordered by `completed_at DESC`, capped at 100
  rows server-side (see Known Debt on why no "load more" was built yet).

**Inbox vs Backlog**: the round's brief described Inbox ("needs triage or has no
schedule") and Backlog ("open, unscheduled") as two separate views, but the MVP data
model has no field that could distinguish them — both descriptions resolve to the exact
same predicate (`status='open' AND due_date IS NULL`). The round's own MVP acceptance
criteria only requires *one* unscheduled/backlog view, and its "Task Views" section
explicitly warns against "storing redundant state that can drift." Splitting Inbox and
Backlog into two views with identical underlying queries would have added a
distinction with no real difference, so they were deliberately merged into one
**Backlog** view. If a genuine "needs triage" concept is wanted later, it should be a
real signal (e.g., an explicit `triaged_at` timestamp), not a second view over the same
data.

## Recurrence Strategy

Supported patterns: `daily`, `weekdays`, `weekly`, `monthly` (month-end clamped — e.g.
Jan 31 + 1 month lands on Feb 28/29, never overflows into March).

Model: **complete the current occurrence → generate exactly one next occurrence**, not
pre-generated future rows. On `PATCH /api/tasks/:id { status: "completed" }`:
1. The current row is marked `completed` (idempotent — see below).
2. If it has a `recurrence` and a `due_date`, a new task is inserted with the same
   `title`/`notes`/`priority`/`application_id`/`recurrence`, due on the computed next
   date, `status='open'`.
3. The response includes `created_next_task_id` (or `null`) so the frontend can react
   without a second round trip.

**Idempotency**: the completion side effect (creating the next occurrence) is gated on
`record.status !== "completed"` *at the time of the request* — completing an
already-completed task a second time updates nothing and creates no second next
occurrence. Verified by a dedicated backend test (`Round 7: recurrence generates
exactly one idempotent next occurrence...`) that calls complete twice and asserts only
one open next-occurrence row exists.

Recurrence without a due date is rejected (400) at both create and update time — there
is no "next" to compute without a starting date.

Reopening a task that already spawned a next occurrence does not retroactively delete
that next occurrence — the two become independent tasks. This is a deliberate,
documented choice (not an oversight): "undo" semantics for recurrence chains would add
real complexity for a scenario (reopening a *recurring* task specifically, rather than
creating a fresh one) that the round's brief did not ask for.

## Application Linking

`tasks.application_id` is a nullable FK, `ON DELETE SET NULL` — deleting an application
preserves its tasks (unlinked), matching the exact same behavior the round suggested
and the identical pattern already used by `networking_contacts.application_id`.
Verified by a dedicated backend test.

Linking is ownership-checked server-side on both create and update: the referenced
application must belong to the same owner as the task (checked via a direct
`applications.user_id` lookup, the same shape as `networking_contacts`' existing
`relatedOwner` check) — an application ID belonging to another user is rejected (400),
covered by a backend IDOR-style test.

## Scope

- Tasks CRUD (create/edit/complete/reopen/delete), ownership-enforced.
- Four views (Today/Upcoming/Backlog/Completed), deterministic and date-safe.
- Priority (Low/Medium/High, reusing the app's existing `PRIORITIES` constant).
- Due date (date-only, nullable).
- Optional single-application link, with a compact "Linked Tasks" panel on the
  application detail page (add/complete from there).
- Recurrence (daily/weekdays/weekly/monthly), complete-to-advance, idempotent.
- Nav entry + nav-badge count (`tasks_due_today`).
- Tasks CSV export (`/api/exports/tasks`) and inclusion in the full-workspace JSON
  backup — both were one-line additions to already-generic, already-safe (formula-
  injection-protected) export code, so including them cost effectively nothing and
  keeps Tasks consistent with every other tracked domain.

## Out of Scope

Per the round's explicit instructions, none of the following were started: Habit
Tracker, Journal, a full Notion-style editor, a calendar engine, push/email/SMS
notifications, Google Calendar sync, a Goals redesign, a Follow-up domain migration, a
Dashboard redesign, drag-and-drop manual ordering, or advanced task analytics. Also
deferred, and listed in Known Debt: subtasks, task tagging, and a small Dashboard
widget.

## Architecture

`backend/src/tasks.js` is a new, self-contained handler module (`validateTask`,
`nextOccurrence`, `classifyTaskView`, `handleTasks`), following the exact pattern
`advanced.js`/`feature-upgrade.js` already established: a `handle<X>(context, helpers)`
function wired into `server.js`'s dispatch chain, returning `true` once it has handled
a route. Two small, justified touches to existing files: `advanced.js`'s
`/api/applications/:id/detail` bundle gained a `tasks` field (open, linked tasks), and
`feature-upgrade.js`'s `/api/navigation/counts` gained one more subquery. Both are
additive — no existing response shape changed.

## Implementation Tasks

1. Audit existing task-like domains (reminders, checklist, follow-ups, goals, tags).
2. Resolve the Reminders-vs-Tasks domain-boundary question with the user.
3. Design and add migration `009_task_management.sql`.
4. Implement `backend/src/tasks.js` (validation, view queries, recurrence, handler).
5. Wire `handleTasks` into `server.js`; add the `tasks` field to the application-detail
   bundle; add the `tasks_due_today` nav-badge count; add CSV/JSON export entries.
6. Implement `frontend/src/features/tasks/format.js` (pure functions).
7. Implement `renderTasks()`, the application-detail "Linked Tasks" panel, nav entry,
   and the `check-square` icon in `app.js`/`icons.js`; add `.task-list`/`.task-row` CSS.
8. Add backend/unit tests (26 → includes 3 new integration tests; 29 frontend/unit
   tests, up from 24).
9. Add a Playwright E2E spec covering every required flow.
10. Validate against real PostgreSQL and real Chromium (5 viewports).
11. Write this document; update continuity docs.

## Acceptance Criteria

All met: create/edit/complete/reopen/delete a task; assign priority and due date; view
Today/Upcoming/Backlog/Completed; optionally link a task to an application; usable on
desktop/tablet/mobile; state survives a refresh (server-persisted, no client-only
state); recurrence is implemented and verified idempotent.

## Testing

- **Backend/integration** (`backend/test/app.test.js`, real HTTP requests against the
  actual server): view classification and date-safety; complete/reopen persistence and
  `completed_at`; application-linking ownership checks (including rejecting another
  user's application); `ON DELETE SET NULL` on application deletion; IDOR (another
  user cannot list/update/delete); ownership cannot be changed via update;
  mass-assignment protection (`status`, `user_id` rejected on create); recurrence
  idempotency; invalid priority/recurrence/due-date rejection.
- **Unit** (`backend/test/frontend.test.js`): `nextOccurrence` for all four recurrence
  patterns including month-end clamping and a leap-year check; `classifyTaskView`
  against all four view predicates; `isOverdue`/`dueDateLabel`/`emptyStateMessage`/
  `recurrenceLabel`/`priorityRank`.
- **E2E** (`backend/e2e/jobquest.spec.js`, one new spec, real Chromium): create a
  backlog (undated) task, a due-today task, and a future task; verify each lands in
  the correct view and nowhere else; complete/reopen round-trips through Completed
  back to Today; create and complete a recurring task, verify exactly one next
  occurrence; link a task to the seeded application and complete it from the
  application detail page; delete a task; an unscoped accessibility scan at the end.

## Security

- Every task operation is ownership-scoped server-side (`ownedTask`, mirroring
  `owned()`/`ownedApplication()` elsewhere in the codebase) — ownership is never
  trusted from the client.
- Application linking is ownership-checked both ways: on create/update, the linked
  application must belong to the task's owner (not just any existing ID).
- Mass assignment: `user_id`/`owner_id`/`target_user_id`/`id`/`created_at`/
  `updated_at`/`completed_at` are all rejected if present in a create/update body;
  `status` is excluded from `validateTask`'s writable-field whitelist entirely and
  handled only through the explicit, validated transition path.
- Title/notes are rendered through the app's existing `esc()` text-escaping helper —
  no `innerHTML` of unescaped user content, consistent with every other page.
- CSRF required on every mutating request, matching every other endpoint.

## Performance

No pagination/virtualization/caching was added — task volume per user is expected to
stay small, per the round's own guidance not to prematurely optimize. Application
names on linked tasks are not N+1-fetched: the application-detail bundle's `tasks`
field is one indexed query (`application_id`), and the Tasks page fetches the full
application list once (`/api/applications?page_size=100`) rather than per-row. The
Completed view is capped at 100 rows server-side so it cannot grow unboundedly; no
"load more" UI was built for it yet (see Known Debt).

## Accessibility

Zero violations on the new E2E spec's unscoped `axe` scan. Specific choices: view-tab
buttons expose `aria-pressed` (not just a visual "secondary" class) so their selected
state is available to assistive tech — this was also the fix for a real Playwright
test race (see Known Debt/lessons) and a genuine accessibility improvement in its own
right, not only a test convenience. Completion checkboxes use an explicit
`aria-label` ("Mark '…' complete"/"…not complete"), the same proven pattern
`checklist_items` already uses. Overdue state is never color-only — it's a labeled
text state ("Overdue — was due …").

## Responsive Behavior

Verified across all 5 configured viewport projects (desktop, compact-desktop, tablet,
mobile, small-mobile) via the new E2E spec. Task rows use flex-wrap with a mobile
breakpoint (`.task-row` stacks to a column, actions right-align) rather than a fixed
table layout, consistent with how `.checklist-item` already handles the same problem.

## Database Impact

One new table (`tasks`), three new indexes, zero changes to any existing table. New
forward migration (`009_task_management.sql`); no existing migration file was touched.
Verified against a real `postgres:17-alpine` container (see PostgreSQL Validation) —
translated automatically by the existing `postgres-migrate.js` dialect rules with no
special-casing required (unlike Round 4's `CASE`-type issue).

## API Impact

Entirely additive: one new resource (`/api/tasks` and `/api/tasks/:id`), one new field
on an existing response (`tasks` on `/api/applications/:id/detail`), one new field on
an existing response (`tasks_due_today` on `/api/navigation/counts`), one new export
type (`/api/exports/tasks`), one new key in the full-workspace JSON backup. No existing
endpoint's behavior or response shape changed.

## Files Changed

- `backend/jobsearch/migrations/009_task_management.sql` (new)
- `backend/src/tasks.js` (new)
- `backend/src/server.js` (wire `handleTasks`)
- `backend/src/advanced.js` (detail bundle `tasks` field; CSV/JSON export entries)
- `backend/src/feature-upgrade.js` (`tasks_due_today` nav count)
- `backend/package.json` (`lint`/`typecheck` now include `src/tasks.js`)
- `frontend/src/features/tasks/format.js` (new)
- `frontend/src/app.js` (nav, routing, `renderTasks`, detail-page linked-tasks panel)
- `frontend/src/icons.js` (`check-square`)
- `frontend/src/styles.css` (`.task-list`/`.task-row`/`.task-meta`)
- `backend/test/app.test.js` (+3 integration tests)
- `backend/test/frontend.test.js` (+6 unit tests)
- `backend/e2e/jobquest.spec.js` (+1 spec)
- `docs/FEATURE_UPGRADE_7.md` (new, this file)
- `docs/PRD.md` (corrected a status line stale since Round 2 — see Known Debt)
- `tasks/BACKLOG.md`, `tasks/CURRENT_TASK.md`, `brain/PROJECT_STATE.md`,
  `brain/AGENT_HANDOFF_LOG.md` (continuity)

## Commits

Scoped, in order: audit/domain-boundary docs; schema migration; backend `tasks.js` +
server wiring; frontend feature module + UI wiring; backend/unit tests; E2E test (plus
the `aria-pressed` fix it surfaced); continuity docs.

## CI Status

Pending — PR not yet pushed/opened at the time this section was written. Will be
updated once CI has run; see `brain/PROJECT_STATE.md` for the latest status if this
section is stale.

## Known Debt

- **`docs/PRD.md` was stale since Round 2**: its status line said "draft, awaiting
  review — no implementation has started" through Rounds 3–6. Corrected in this round
  as a small, low-risk, clearly-justified fix; worth remembering to keep current going
  forward rather than letting it drift again.
- **Subtasks**: deferred. The round's own guidance was to only add them if they
  "materially improve MVP" and to never repurpose `checklist_items` for them — neither
  condition was met strongly enough to justify the schema/UI cost this round.
- **Task tagging**: deferred. `tags`/`application_tags` exist but the join table is
  applications-only; a `task_tags` table would be small but was not required by MVP
  acceptance criteria.
- **Dashboard widget** ("Tasks due today"): deferred in favor of the application-detail
  integration, which the round's own brief said to prioritize. Adding a widget touches
  three separate places (`BUILTIN_WIDGETS`, default-enabled sets, and the dashboard
  render switch in `app.js`) for a small win; backlogged rather than added for
  coupling's sake.
- **Completed view has no "load more"**: capped at 100 rows server-side, which is
  enough at current scale; pagination UI can be added if that cap is ever reached in
  practice.
- **A real Playwright test race was found and fixed while writing this round's E2E
  spec** (not a pre-existing bug — introduced and fixed within this same round):
  clicking a task-view tab button triggers an async re-render; a `.fill()`/`.click()`
  issued immediately after can land on the old, about-to-be-replaced DOM instead of
  waiting for the new one, because the target label/button text exists in both. Fixed
  by adding `aria-pressed` to the tab buttons (a genuine accessibility improvement, not
  only a test hook) and waiting on it as a real settle point before interacting with
  the form. Documented here as a second instance of the Round 6 lesson ("don't trust a
  locator that happens to resolve, even without a strict-mode error") extended to a
  new shape: a locator that resolves to a *stale* element isn't safe either — wait for
  a signal that the new render actually landed.
- **Nav-badge accessible names**: the "Tasks" (and equally, Interviews/Follow-Ups/
  Reminders) nav button's accessible name changes when its pending-count badge is
  present (e.g. "Tasks" → "Tasks 1 pending"). Not a bug — it's a deliberate,
  informative accessible name — but worth remembering for any future E2E test that
  clicks these buttons with `exact: true` after triggering their badge condition.

## Backlog Updates

`tasks/BACKLOG.md` updated: Round 7 marked done; the four Known Debt items above added
as smaller backlog entries; the stale-PRD-status lesson noted.

## Completion Notes

Round 7 delivered a Tasks MVP that is deliberately smaller than the original brief's
"inbox/today/upcoming/backlog/completed + tags + subtasks" vision, because the audit
found real, load-bearing prior art (`reminders`) covering much of that surface, and the
brief's own MVP acceptance criteria — as opposed to its aspirational "at minimum
evaluate" sections — turned out to require less than the full vision. Every deferral
above is a documented, reasoned scope decision, not an oversight.
