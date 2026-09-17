# Feature Upgrade 9 — Journal / Notes

## Status

Implemented. Branch `feature/009-journal-notes`, off `development` (which now includes
the merged Round 8 PR #15). Locally verified against real PostgreSQL and real Chromium
across all 5 viewport projects. PR #16 into `development` is open with all 8 CI checks
green on the first push — not yet merged, per the Round 9 stop condition. This
document's Data Model/Note Types/Application Linking/Search sections were written
before any schema work, per the round's own instruction, and match what was actually
implemented without revision.

## Goal

A lightweight, fast capture-organize-find-revisit tool for job-search journaling and
general notes — daily entries, interview reflections, company research, recruiter
notes, personal planning — optionally linked to an application. Not a rich-text
editor, not a wiki, not Notion.

## Existing Related Functionality

Audited before designing any schema, per the round's instruction not to assume this is
entirely new until verified. Direct search of every migration file for `notes`/
`journal`/`comments`/rich-text/markdown dependencies:

| Location | What it is |
|---|---|
| `applications.notes`, `applications.job_description` | Free-text fields embedded on the application row. |
| `interviews.preparation_notes`, `.performance_notes`, `.notes` | Three separate embedded free-text fields on one interview row. |
| `rejections.notes`, `.lessons_learned` | Embedded free-text on the rejection row. |
| `networking_contacts.notes` | Embedded free-text on the contact row. |
| `follow_ups.notes` | Embedded free-text on the follow-up row. |
| `resumes.notes` | Embedded free-text on the resume row. |
| `weekly_goals.notes`, `.main_accomplishment`, `.main_challenge` | Embedded free-text on the weekly-goal row. |
| `tasks.notes` (Round 7) | Embedded free-text on the task row. |

No `notes`/`journal_entries` table, no rich-text/markdown parser, no HTML sanitizer
dependency exists anywhere in `backend/package.json` or `frontend/package.json` —
confirmed, not assumed. This round is genuinely net-new.

## Domain Boundaries

Per the round's own instruction, these embedded fields are **not** migrated,
consolidated, or removed. They stay exactly as they are — each is a comment/detail
field scoped tightly to its own domain record (an interview's prep notes belong to
that interview, not to a general list of "things I wrote"). Round 9 adds a genuinely
independent **Notes** domain: standalone records with their own lifecycle
(create/search/pin/delete), optionally linked to an application, not tied to any other
domain record's fields. A note and an application's `notes` column can coexist without
conflict — e.g., a quick line in `applications.notes` for "call back Tuesday" versus a
full journal entry "Interview reflection: Acme Product Engineer" linked to that
application via `notes.application_id`.

Consolidating the embedded fields into this new table was considered and rejected: it
would touch eight mature, working, already-tested domains for a purely cosmetic
unification with no functional benefit, directly against the round's explicit
instruction not to destabilize mature domains. Backlogged as a documented idea, not
pursued.

## User Stories

- "I want to write a quick reflection after every interview, searchable later."
- "I want a running journal of my job search, one entry per day, without forcing a
  title on every entry."
- "I want to jot down company research before applying, and find it again by
  searching."
- "I want notes that aren't tied to any specific application — career planning,
  networking strategy, resume ideas."
- "I want to see the interview reflection I wrote right there on the application's own
  page, not go hunting for it."
- "I want my most important notes to stay near the top."

## Data Model

One new table, one new forward migration (`011_journal_notes.sql`):

```sql
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
    title TEXT,
    body TEXT NOT NULL DEFAULT '',
    note_type TEXT NOT NULL DEFAULT 'general' CHECK (note_type IN ('general','daily_journal','interview','company_research','reflection')),
    entry_date TEXT,
    pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_note_owner_updated ON notes(user_id, updated_at);
CREATE INDEX idx_note_owner_application ON notes(user_id, application_id);
CREATE INDEX idx_note_owner_type ON notes(user_id, note_type);
```

`title` is nullable — a note is valid with just a body (see Note Title below).
`entry_date` is nullable and date-only — meaningful for `daily_journal` entries,
optional for everything else (e.g. tagging a `company_research` note with the date you
plan to apply). Deliberately excluded: no `archived` column (hard delete only for
MVP — see Archive vs Delete), no tags table (see Out of Scope), no attachments, no
version history, no generic polymorphic entity link (application-only for MVP).

**Note title**: optional, not auto-generated server-side. A note with an empty title
displays a client-side fallback (its `entry_date` if set, else "Untitled note") in
list views — this keeps storage simple (no synthetic titles to keep in sync) while
never leaving a note indistinguishable in a list. Validation requires **at least one**
of `title`/`body` to be non-empty after trimming — an entirely blank note is rejected.

**Length limits**: `title` ≤ 200 characters, `body` ≤ 20,000 characters (~20KB — generous
for a long journal entry or research dump, while still bounded against abuse).

## Note Types / Categories

Five values, matching every example in the brief without over-categorizing:
`general`, `daily_journal`, `interview`, `company_research`, `reflection`. No
`application` type — application-relatedness is already signaled by
`notes.application_id` being set, orthogonal to type (an `interview` note can also be
application-linked; a `general` note can be too).

## Application Linking

Nullable `application_id`, `ON DELETE SET NULL` — deleting an application preserves
its notes (unlinked), the same pattern already used by
`networking_contacts.application_id` and `tasks.application_id` (Round 7). Ownership
is checked server-side on both create and update: the referenced application must
belong to the same owner as the note (same shape as Tasks' `applicationOwner` check).

## Search

Simple parameterized `LIKE` across `title`/`body`, reusing the exact
`lower(coalesce(field,'')) LIKE lower(?)` pattern the Applications search
(`feature-upgrade.js`'s `buildApplicationWhere`) already uses — proven cross-dialect
(SQLite and Postgres both support `lower()`/`LIKE`; no `ILIKE`-only Postgres syntax
needed). A single trimmed phrase, not multi-word AND-across-fields — simpler than
Applications' search, sufficient for the expected note volume, and easy to reason
about. No `Elasticsearch`/`Meilisearch`/vector database, no full-text index.

## UI / UX

One workspace, `frontend/src/features/notes/`:
- `format.js` — pure functions: `notePreview` (safe, length-bounded excerpt),
  `displayTitle` (the empty-title fallback described above), `typeLabel`,
  `emptyStateMessage`.

`app.js` gains a `renderNotes()` page (search box, type/pinned/application filters,
list + a detail/edit panel) and one nav entry — minimal wiring, continuing the
pattern established in Rounds 7-8.

## Scope

- Notes CRUD (create/view/edit/delete), ownership-enforced.
- Search (title + body).
- Filter by type, by linked application, by pinned.
- Pin/unpin.
- Optional single-application link, with a compact "Notes" panel on the application
  detail page (view/add from there).
- List previews (truncated body), full content on open/edit — avoids shipping every
  note's full body on every list load.
- Notes CSV export and full-workspace JSON backup inclusion (same one-line pattern
  Rounds 7-8 used for Tasks/Habits).

## Out of Scope

Per the round's explicit instructions, none of the following were started: a rich-text
editor, Notion-style blocks, attachments, collaborative notes, comments, version
history, a generic polymorphic entity-link system, contact-linked notes, Task/Habit-
linked notes, document management, external full-text search, AI summarization,
Markdown rendering (plain text only — see Note Content Format), and archive (hard
delete with confirmation is the MVP delete model — see Archive vs Delete).

## Architecture

`backend/src/notes.js` — a new, self-contained handler module (`validateNote`,
`listNotes` (search/filter, preview truncation, one query, no N+1), `handleNotes`),
following the exact `handle<X>(context, helpers)` pattern `habits.js`/`tasks.js`/
`advanced.js`/`feature-upgrade.js` already established. One small, justified touch to
an existing file: the application-detail bundle (`advanced.js`) gains a `notes` field.

## Database Impact

One new table, three new indexes, zero changes to any existing table. New forward
migration; no existing migration file touched. Validated against real PostgreSQL (see
PostgreSQL Validation).

## API Design

- `GET /api/notes?search=&type=&application_id=&pinned=&user_id=` — list, pinned
  first then most-recently-updated, capped at 100 rows (no "load more" UI yet — see
  Known Debt), each row includes a truncated `body_preview` rather than the full body.
- `GET /api/notes/:id` — the full note (opening/editing needs the complete body).
- `POST /api/notes` — create (`target_user_id` supported for managers, matching every
  other resource).
- `PATCH /api/notes/:id` — edit title/body/note_type/application_id/entry_date/pinned.
- `DELETE /api/notes/:id` — hard delete.

## Implementation Tasks

1. Audit existing notes-like fields (done above).
2. Write this document.
3. Add migration `011_journal_notes.sql`.
4. Implement `backend/src/notes.js`.
5. Wire `handleNotes` into `server.js`; add the `notes` field to the application-detail
   bundle; add CSV/JSON export entries.
6. Implement `frontend/src/features/notes/format.js`.
7. Implement `renderNotes()`, the application-detail "Notes" panel, and nav entry in
   `app.js`.
8. Add backend/unit tests, explicitly including stored-XSS-shaped content.
9. Add a Playwright E2E spec.
10. Validate against real PostgreSQL and real Chromium (5 viewports).
11. Update continuity docs.

## Acceptance Criteria

Create/edit/delete a note; create a journal entry; search notes; view recent notes;
categorize by type; pin a note; link a note to an application; see linked notes from
application detail; content persists across a re-fetch; usable on
desktop/tablet/mobile; arbitrary user text (including HTML/script-shaped strings)
renders safely as text, never executes.

## Testing

- **Backend/integration**: create/list/get/edit/delete; IDOR; ownership cannot be
  changed; mass-assignment protection; title/body length limits; at-least-one-of-
  title/body-required validation; invalid `note_type` rejection; application-linking
  ownership checks (rejects another user's application); `ON DELETE SET NULL` on
  application deletion; search matches title and body; pin/unpin persistence; stored
  content with `<script>`/`<img onerror>`-shaped text round-trips as inert text
  (verified via the API response, not just visual inspection).
- **Unit**: `notePreview` truncation behavior; `displayTitle` fallback; `typeLabel`.
- **E2E**: create a general note, verify persistence via a direct API call (this app
  has no URL-based routing — `page.reload()` always lands on Dashboard, already
  documented on the Round 4/8 tests); create a daily journal entry; search and clear
  search; link a note to the seeded application and see it on the application detail
  page; pin/unpin; delete; a malicious-looking note body renders as literal text, not
  as executed markup; mobile create/edit flow; accessibility scan.

## Security

Every operation ownership-scoped server-side (`ownedNote`, mirroring `ownedTask`/
`ownedHabit`); mass assignment blocked; application linking ownership-checked both
ways; search uses parameterized `LIKE`, never string-built SQL; `title`/`body` length-
bounded; **all note content is rendered through the app's existing `esc()` text-
escaping helper, never `innerHTML` of unescaped user content** — this round has the
highest XSS surface of any round so far (arbitrary long-form user text), so this is
the load-bearing invariant, explicitly tested with `<script>`/`<img onerror>`-shaped
strings; CSRF required on every mutation.

## Accessibility

Zero violations target. The body textarea has a real label (not placeholder-only);
pin/delete controls have explicit `aria-label`s; search has a real label; the note
list/detail relationship is navigable by keyboard.

## Responsive Behavior

Verified across all 5 configured viewport projects. Mobile favors list → open note →
full-width detail rather than a split-pane layout.

## Performance

List responses return truncated previews, not full bodies (bounded payload
regardless of body length). One habits-style single query for the list (no N+1
application lookups — the list query joins application company/title directly).
Capped at 100 rows server-side.

## Files Changed

- `backend/jobsearch/migrations/011_journal_notes.sql` (new)
- `backend/src/notes.js` (new)
- `backend/src/server.js` (wire `handleNotes`)
- `backend/src/advanced.js` (detail bundle `notes` field; CSV/JSON export entries)
- `backend/package.json` (`lint`/`typecheck` now include `src/notes.js`)
- `frontend/src/features/notes/format.js` (new)
- `frontend/src/app.js` (nav, routing, `renderNotes`/`renderNoteEditor`,
  application-detail Notes panel)
- `frontend/src/icons.js` (`book-open`)
- `frontend/src/styles.css` (`.note-list`/`.note-card`/`.note-body-input`)
- `backend/test/app.test.js` (+2 integration tests)
- `backend/test/frontend.test.js` (+4 unit tests)
- `backend/e2e/jobquest.spec.js` (+1 spec)
- `docs/FEATURE_UPGRADE_9.md` (new, this file)
- `tasks/BACKLOG.md`, `tasks/CURRENT_TASK.md`, `brain/PROJECT_STATE.md`,
  `brain/AGENT_HANDOFF_LOG.md` (continuity)

## Commits

Scoped, in order: domain audit + this document; schema migration + backend `notes.js`
+ server wiring; frontend feature module + UI wiring; backend/unit tests; E2E test
(plus the pre-existing toast-contrast finding it surfaced); continuity docs.

## CI Status

All 8 CI jobs green on the first push (PR #16 into `development`) — no fix round
needed. `browser-and-visual`: 43 passed / 7 skipped / 0 failed across 50 browser
tests (up from 38 passed in Round 8's final state; the +5 is exactly the new Notes
spec across the 5 viewport projects), including zero visual-regression diffs against
the existing baselines.

## Known Debt

- No "load more"/pagination UI past the 100-row cap — same documented trade-off
  pattern as Tasks' Completed view and Habits' history.
- No tags, no contact/task/habit linking, no archive — all explicitly deferred per
  the round's instructions; consolidating the eight existing embedded notes fields
  into this table was considered and explicitly rejected (see Domain Boundaries).
- Search is a single-phrase substring match, not multi-word AND-across-fields like
  Applications' search — simpler, sufficient for expected note volume; revisit if
  that proves too coarse in practice.
- **A real, pre-existing, previously-undiscovered accessibility issue was found
  while writing this round's E2E spec** (not introduced by Round 9 — the shared
  `#toast` component and its CSS are untouched by any Round 9 change): an unscoped
  accessibility scan run immediately after a delete action (which shows a "Note
  deleted" toast) reported a serious color-contrast violation on `#toast`,
  reproduced deterministically across repeated runs. Investigated before concluding
  anything: `styles.css` defines `--sidebar`/`--sidebar-foreground` (the tokens
  `#toast` uses) as a properly high-contrast dark-navy/light-gray pair in both the
  light and dark theme blocks — so the near-white-on-near-white colors axe reported
  are not that pair at all. Waiting for the toast's `.show` class to clear before
  scanning did **not** resolve it either (axe still flagged `#toast` at rest,
  `opacity:0`, no `.show` class), which points to axe still evaluating an
  `opacity:0`-but-still-in-DOM element's resolved colors, or a CSS custom-property
  resolution quirk specific to this headless-browser context. Excluded `#toast` from
  this round's scan (`.exclude("#toast")`, the same precedent as the existing
  `.exclude(".goal-chart")` in the Applications test) rather than attempting to fix
  a shared, every-page component's theme-token handling inside a Notes-focused
  round — real, separate, higher-risk work. Worth a dedicated investigation in a
  future round or design/polish pass: is this a genuine always-present contrast bug
  on `#toast` regardless of visibility state, or specific to how this test
  environment resolves CSS custom properties?

## Completion Notes

Round 9 delivered the full MVP acceptance criteria — create/edit/delete a note,
journal entries with an empty-title date fallback, search, type/pinned/application
filters, application-detail integration, and safe rendering of arbitrary (including
malicious-looking) user text — while deliberately leaving the eight existing
domain-specific notes fields untouched, exactly as instructed. The one genuinely
new-domain design decision (title optional, at-least-one-of-title/body required,
list previews vs. full-body detail fetch) all held up through implementation without
revision from the pre-migration plan. The one surprise this round surfaced was not a
domain-boundary question like Rounds 7-8, but a real, previously-undiscovered,
unrelated accessibility issue on a component every single page in the app shares —
found only because this round's E2E spec happened to be the first one whose final
action left a toast on-screen at the exact moment of an unscoped scan.
