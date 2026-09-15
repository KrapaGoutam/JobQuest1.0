# Feature Upgrade 5 — Contacts / Networking Gap-Close

## Status

Implemented on `feature/005-contacts-networking-gap-close`, off `development` (which
now includes the merged Round 4 PR #11). Round 5 of [docs/PRD.md](PRD.md). Local checks
green, including real PostgreSQL and real-browser validation (see Testing) — CI pending
as this doc is written; see CI Status for the final result.

## Goal

Make the existing per-user networking-contacts domain correct and genuinely connected
to applications — the actual gap wasn't "no CRUD," it was "the promised
application-contact link doesn't work, and edited/linked contacts are invisible where
they'd matter most" — without turning this into a CRM.

## Existing implementation (found by reading the actual code, not assumed)

### Data model

`networking_contacts` (added in migration `001_jobsearch.sql`, the very first
migration — not a later round):

```
id, user_id (FK), application_id (FK, nullable, ON DELETE SET NULL),
contact_name (required), company, job_title, linkedin_url, email, phone,
relationship_type (free text), connection_request_date, connection_accepted,
first_message_sent, response_received, referral_requested, referral_received,
last_contact_date, next_follow_up_date, networking_stage (default 'Identified'),
notes, created_at, updated_at
```

Indexed on `(user_id, next_follow_up_date)`. `relationship_type` and
`networking_stage` are both free text at the schema level (`networking_stage` has a
default but no `CHECK` constraint) — never altered since creation.

**Relationship shape**: one contact links to **at most one** application
(`application_id` is a single nullable FK on the contact row, not a join table) — many
contacts can point at the same application, but a contact can't be linked to several
applications at once. Deleting an application `SET NULL`s any contact's `application_id`
(the contact survives, unlinked) — verified by test, not assumed. Deleting a contact
`ON DELETE CASCADE`s any `follow_ups` row referencing it via `networking_contact_id` —
also verified by test, a real behavior worth knowing before ever building a "delete
contact" confirmation UI that doesn't mention it.

### Existing APIs

Networking contacts are one of six resource types (`interviews`, `rejections`,
`follow_ups`, `networking_contacts`, `daily_goals`, `weekly_goals`) served by one
generic, already-secure "tracker" mechanism in `backend/src/server.js`
(`listTracker`/`createTracker`/`updateTracker` + a shared route matcher):

- `GET /api/networking_contacts` — list, owner-scoped (or all, for managers).
- `POST /api/networking_contacts` — create; validates `contact_name` required;
  column-allowlist filtered (mass-assignment safe); cross-checks that a supplied
  `application_id`'s owner matches the contact's owner.
- `PATCH /api/networking_contacts/:id` — update; explicitly rejects any attempt to
  change `user_id`/`target_user_id`/`owner_id`; same allowlist/cross-check as create.
- `DELETE /api/networking_contacts/:id` — delete; owner-scoped.

**All four CRUD operations already existed and were already correctly secured** —
ownership enforcement, IDOR protection, and mass-assignment protection were not gaps.
Linking a contact also auto-writes an `activities`/`timeline_events` entry
(category `recruiter`) — already working, untouched.

### Existing UI

`frontend/src/app.js`'s `renderTracker` is a single generic list+create view shared by
the same six resource types, driven by a `trackerMeta[type].fields` array. For
`networking_contacts` specifically, reading the actual field list and the
`application_id`-select's rendering branch turned up the central bug this round fixes:
**`application_id` was missing from `networking_contacts.fields`**, even though the
form-rendering code already had a dedicated (and already-correctly-optional-for-
contacts) branch to render an application selector — it just never ran, because the
field it checks for was never in the list. The application detail page's existing
"Link Contact" button (`data-related-page="networking_contacts"`) sets
`state.relatedAppId` and navigates here specifically to pre-select that application —
and could never actually complete the link, because there was no field to submit it
through. Also found: **no Edit control at all** (only Create + Delete — PATCH existed
server-side, unused by the UI); `linkedin_url`/`email` rendered as inert plain text, not
links; `application_id` (once linkable) would have rendered as a raw numeric ID in the
list, not a readable company/title; and the application detail page's "Networking (N)"
tab showed a count but no actual contact list (same non-functional-tabs pattern found
for Checklist in Round 4 — the count came from `data.networking.length`, but nothing
rendered `data.networking` itself anywhere on the page).

## Application linkage (the core Round 5 focus)

- **Before**: contacts could store an `application_id` via direct API use, but the UI
  had no way to set one, and even a contact that WAS linked (via direct API/import) was
  invisible on the application's own detail page (only a decorative count existed) and
  showed as a raw ID in the Networking list.
- **After**: "Link Contact" on an application actually links (application selector now
  renders); the application detail page shows a real "Networking Contacts" section
  (name, relationship/company, safe mailto/LinkedIn links, follow-up date with an
  overdue flag, notes) with a link back into it; the Networking list shows a clickable
  "Company — Job Title" instead of a raw ID and navigates to that application's detail
  page.

## Gap analysis

| Capability | Classification |
|---|---|
| Schema (ownership, application link, relationship/stage/follow-up fields) | ALREADY IMPLEMENTED |
| List/Create/Update/Delete APIs, ownership + IDOR protection, mass-assignment protection | ALREADY IMPLEMENTED |
| Delete → follow-up cascade, application-delete → contact unlink | ALREADY IMPLEMENTED (verified by test, not previously tested at all) |
| Link a contact to an application from the UI | **NEEDS BACKEND SUPPORT — actually just a missing frontend field; fixed this round** |
| Edit a contact from the UI | **NET NEW UI (backend already supported it) — closed this round** |
| See contacts linked to an application, from the application | **NET NEW — closed this round** |
| See which application a contact is linked to, from the contacts list | **NET NEW — closed this round** |
| Safe, clickable LinkedIn/email links | **NEEDS UX IMPROVEMENT — closed this round** (also closes the theoretical unsafe-protocol question by construction) |
| Overdue follow-up indicator | **NET NEW (small) — closed this round**, reusing the existing `.tone-chip.tone-warning` component |
| relationship_type suggestions without breaking existing free-text values | **NEEDS UX IMPROVEMENT — closed this round** via a `<datalist>`, not a hard `<select>` |
| Contact search/filter | **DEFERRED** — no evidence of a real need at the current/expected dataset size; the list is unfiltered today and nothing suggests that's a problem |
| Duplicate-contact detection | **NOT JUSTIFIED** — no evidence of a real duplication problem; explicitly optional per the brief |
| Interaction/activity history beyond the existing timeline | **DEFERRED** — the existing `activities`/`timeline_events` records already capture "contact linked"; a richer interaction log is a bigger, separate feature |
| Dashboard follow-up integration | **DEFERRED** — see Out of Scope |
| Edit UI for interviews/rejections/follow_ups/goals (same shared component, same original gap) | **DEFERRED, explicitly out of scope this round** — real, but not "contacts" |

## Scope

1. Add `application_id` to `networking_contacts.fields` (the actual bug fix).
2. Add Edit capability to `renderTracker`, scoped to `networking_contacts` only.
3. Render `application_id`/`email`/`linkedin_url`/`next_follow_up_date` meaningfully in
   the Networking list instead of raw values (new `trackerCellHtml` helper).
4. Add a `relationship_type` datalist (suggestions, not a hard enum).
5. Add a real "Networking Contacts" section to the application detail page.
6. New pure module `frontend/src/features/contacts/format.js`
   (`safeExternalUrl`, `contactLabel`, `isFollowUpOverdue`).
7. Fix a real, pre-existing, shared accessibility gap discovered while testing this
   (see Accessibility).
8. Tests: backend integration (CRUD, linkage, ownership/IDOR, delete/cascade/unlink
   behavior — none existed before), frontend unit (the new pure functions), and a new
   Playwright E2E test (none existed before).

## Out of scope

Contact search/filter/sort, duplicate detection, richer interaction history, dashboard
follow-up integration, editing interviews/rejections/follow_ups/goals (same shared
component, same gap, different domain), any email-sending/Gmail/LinkedIn-scraping
integration, full CRM features, React, Render/Neon changes.

## Architecture

- `backend/`: **no changes**. Every capability this round needed already existed and
  was already correctly secured — genuinely nothing to fix or add server-side.
- `frontend/src/features/contacts/format.js` (new): three pure functions.
  `safeExternalUrl` rejects any non-`http:`/`https:` protocol (so a `javascript:` value
  in `linkedin_url` renders as inert text, never as a clickable link) — this is the
  concrete implementation of the brief's URL-handling requirement, not a promise.
  `contactLabel` and `isFollowUpOverdue` are shared between the Networking list and the
  new application-detail section so both stay visually/behaviorally consistent.
- `frontend/src/app.js`: `trackerMeta.networking_contacts.fields` gains
  `application_id`; `renderTracker` gains a `trackerCellHtml` cell-formatter, an
  edit-in-place flow (reusing the existing create form — no new modal/dialog), and a
  `relationship_type` datalist branch; `renderDetail` gains a
  `networkingContactsView(data.networking)` section, inserted next to the existing
  Checklist section (same insertion pattern Round 4 used).
- The shared `table()` helper's wrapper gets `tabindex="0"` — see Accessibility.

## Implementation tasks

- [x] Add `application_id` to `networking_contacts.fields`.
- [x] `frontend/src/features/contacts/format.js` (`safeExternalUrl`, `contactLabel`,
      `isFollowUpOverdue`).
- [x] `trackerCellHtml`: readable application link, safe mailto/LinkedIn links, overdue
      follow-up flag.
- [x] Edit-in-place for `networking_contacts` (Edit/Cancel buttons, PATCH on submit,
      ownership-field stripped before sending).
- [x] `relationship_type` datalist (suggestions, backward-compatible with existing
      free-text values).
- [x] `networkingContactsView` on the application detail page.
- [x] CSS: `.contact-list`/`.contact-card`/`.contact-meta` (reuses existing tokens).
- [x] `tabindex="0"` fix on the shared `table()` wrapper (see Accessibility).
- [x] Backend integration test (CRUD, linkage, ownership/IDOR, cascade/unlink).
- [x] Frontend unit tests for the new pure functions.
- [x] Playwright E2E test, run locally against real Postgres across all 5 viewports.

## Acceptance criteria

- [x] "Link Contact" from an application detail page actually results in a linked
      contact (verified end-to-end, UI and API).
- [x] A linked contact is visible on the application detail page, and the Networking
      list shows a readable, clickable reference back to its application.
- [x] Editing a contact works from the UI (previously impossible).
- [x] `javascript:`/other unsafe-protocol values never become clickable links (unit
      tested).
- [x] Deleting a contact does not damage the linked application; deleting an
      application does not delete linked contacts (both verified by test, not assumed).
- [x] No N+1 pattern introduced — contacts are fetched exactly once per detail-page
      load (already the case, via the existing `/detail` endpoint) and once per
      Networking-page load; nothing new queries per-row.
- [x] No new dependency.
- [ ] Full CI green — pending, see CI Status.

## Testing

Local: `npm run lint`, `typecheck`, `build`, `build:frontend`, `test:frontend` (19
tests, up from 16) all pass.

**Real PostgreSQL validation** (Docker, confirmed available in this environment since
Round 4): a throwaway `postgres:17-alpine` container, migrated, ran the full backend
suite (21/21 pass) including the new networking-contact test — specifically exercising
the `ON DELETE SET NULL` (application → contact) and `ON DELETE CASCADE`
(contact → follow_ups) FK behaviors for real, not by reading the schema and assuming.

**Real browser validation** (Chromium, confirmed available since Round 4): a new
Playwright E2E test — link a contact from an application, verify the application
selector is pre-filled, submit, verify the list shows a readable application link and a
real LinkedIn link, edit the contact's stage, verify it from the application-detail
side (correct label, working mailto/LinkedIn links), delete it, verify it's gone from
the list without disturbing the application — run locally across all 5 viewport
projects (5/5 pass) plus the full existing non-pixel suite (15/15 pass, no regressions)
before pushing.

## Security impact

- No new backend code path — the create/update/delete logic exercised by this round
  (application linkage, edit) was already live and already ownership/IDOR-protected;
  this round only exposed existing, already-secure capability through the UI.
- `safeExternalUrl` is the concrete fix for the brief's "prevent unsafe protocols such
  as `javascript:`" requirement — unit tested directly against that exact payload, plus
  a `data:` URL and a bare non-URL string.
- Email/LinkedIn links use `esc()` for attribute safety in addition to the protocol
  allowlist; `rel="noopener noreferrer"` on the external LinkedIn link.
- No mass-assignment risk: the edit flow strips `target_user_id` from the payload
  before sending, and the backend independently rejects any ownership-field change
  regardless (verified by test — belt and suspenders, not relying on only one layer).

## Performance impact

- No N+1 introduced. The application-detail endpoint already fetched
  `networking_contacts WHERE application_id=?` (unused by the UI before this round);
  this round only renders data that was already being fetched. The Networking list
  page's application-lookup (`appsById`) is one extra existing request
  (`/api/applications?page_size=100&archived=all`) — that request already ran before
  this round (it feeds the create-form's application dropdown), just unused for display
  until now.

## Accessibility

- New Edit/Delete/Move-equivalent controls (Edit/Delete/Cancel) all have plain,
  sufficient visible text (no icon-only actions); mailto/LinkedIn links have real
  accessible names (the email address / "LinkedIn").
- **A real, pre-existing, shared violation was found and fixed**: the generic `table()`
  helper's scrollable wrapper (`overflow: auto` in CSS, used by every tracker page —
  interviews, rejections, follow_ups, networking_contacts, goals, resumes, reminders,
  etc.) had no way to receive keyboard focus, failing WCAG 2.1.1/2.1.3. Fixed with one
  `tabindex="0"` on the shared wrapper — a one-line, unambiguous, low-risk fix that
  benefits every page using it, not just Networking. Confirmed pre-existing (not
  something this round's changes caused) by checking the helper was unmodified by any
  of this round's other edits.
- Not pursued: a full audit of every `renderTracker`-based page (interviews,
  rejections, follow_ups, goals) — this round only scanned the Networking page and the
  application-detail page's new section, since no accessibility test previously
  existed for any tracker page at all. See Known Debt.

## Responsive validation

Reuses the existing `.card`/`.table-wrap`/`.form-grid` responsive patterns; the new
`.contact-list`/`.contact-card` styles use the same simple block/grid layout as
`.related-card`, which already works down to small-mobile width. Confirmed via the new
E2E test running on all 5 viewport projects, and will be confirmed via CI's visual
suite — see CI Status for whether that needed a baseline update or not (per Round 3's
lesson, not assumed either way).

## Database impact

None. No migration — the schema already supported every gap closed this round.

## API impact

None. No endpoint added, removed, or changed — the existing generic tracker endpoints
already supported everything this round's UI now uses.

## Files changed

```
backend/e2e/jobquest.spec.js                       (new networking-contacts E2E test)
backend/test/app.test.js                           (new Round 5 integration test)
backend/test/frontend.test.js                       (format.js unit tests)
docs/FEATURE_UPGRADE_5.md                           (new, this doc)
frontend/src/app.js                                 (application_id field fix, edit-in-place,
                                                       trackerCellHtml, networkingContactsView,
                                                       table() tabindex fix: 2748 -> 2877 lines)
frontend/src/features/contacts/format.js            (new)
frontend/src/styles.css                             (.contact-list/.contact-card/.contact-meta)
```

## Commits

See git log on `feature/005-contacts-networking-gap-close` — scoped per the round's
suggested progression (audit doc, application-linkage fix, contacts module, detail-page
section, edit capability, accessibility fix, tests, continuity docs).

## CI status

_Filled in once CI on this branch's PR completes._

## Known debt (backlogged, not fixed this round)

- **Edit UI gap for interviews/rejections/follow_ups/daily_goals/weekly_goals** — the
  exact same "no edit control, PATCH already works server-side" gap this round closed
  for networking_contacts exists identically for every other type sharing
  `renderTracker`. Real, verified, deliberately left alone — different domain than
  "contacts."
- **No full accessibility audit of the other `renderTracker`-based pages** (interviews,
  rejections, follow_ups, goals, resumes, reminders) — only Networking and the
  application-detail page were scanned this round. The shared `table()` fix
  (`tabindex="0"`) benefits all of them, but page-specific issues (analogous to
  `#detail-stage`, found in Round 4) may still exist and haven't been checked.
- **Contact search/filter/sort** — deferred; no evidence of need at current scale.
  Revisit if the list genuinely grows large enough to matter.
- **Duplicate-contact detection** — deferred; no evidence of a real duplication
  problem today. Never silently merge if this is ever built.
- **Manager editing another user's contact**: the (informational-only, stripped before
  submit) owner dropdown in the edit form doesn't pre-select the record's actual owner
  — cosmetic only, no data-correctness impact, low priority.
- **`job_url`'s existing external link** (on the application detail page, unrelated to
  contacts) has the same unvalidated-protocol pattern `linkedin_url` had before this
  round — noticed in passing, not touched (out of scope: it's an application field, not
  a contact field).

## Completion notes

Nothing in Round 6+ ([docs/PRD.md](PRD.md)) has started. Do not begin Round 6 until this
round's PR is reviewed/merged and the user has explicitly said to proceed.
