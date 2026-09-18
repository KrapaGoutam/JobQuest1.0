# Feature Upgrade 6 — Import / Export Hardening

## Status

Implemented on `feature/006-import-export-hardening`; PR #13 open into `development`,
full CI matrix green (8/8 jobs) after one fix round for a flaky, pre-existing E2E test
(see CI Status), awaiting the user's review/merge. Round 6 of [docs/PRD.md](PRD.md).

## Goal

Close the real, verified import/export gaps — a genuine formula-injection hole in
every CSV export, a missing import format, and an unsafe-URL hole reachable through
import — without rebuilding the already-mature preview/validation/duplicate/transaction
machinery underneath them.

## Existing export functionality

- **XLSX** (`GET /api/exports/applications.xlsx`, `feature-upgrade.js`): curated,
  human-readable columns (not raw DB column names), computed `aging`/`application_health`
  columns, boolean-friendly fields, **already applies `safeCell()` formula-injection
  neutralization to every cell**, correctly anchors date-only values at noon before
  constructing a `Date` object (avoids the exact timezone-shift bug this round's brief
  warns about — already handled), autofilter, styled header, and a Summary sheet
  (stage breakdown, date range, applied filters) when exporting more than one row.
  **This is the most mature of the three formats — nothing here needed fixing.**
- **CSV** (`GET /api/exports/{applications,interviews,rejections,follow_ups,
  networking,reminders,goals,resume-analytics,aging,stage-duration}`, plus a separate
  per-application timeline CSV): proper RFC 4180 quote/comma escaping
  (`csvEscape`) — but, until this round, **zero formula-injection protection**, unlike
  the XLSX path. Raw DB column names (not curated), which is fine for a raw dump but
  worth knowing if a friendlier CSV is ever wanted later.
- **JSON** (`GET /api/exports/json`): already a genuine **full-workspace backup** —
  applications, timeline, stage history, interviews, rejections, follow-ups,
  networking, resumes, reminders, reminder categories, goal settings/history,
  dashboard preferences, saved views, tags — with `export_version`/`exported_at`
  metadata. Confirmed safe: no `password_hash`, no session data, nothing from
  `import_batches`/`import_rows` either. **There is no restore path for this format at
  all** — see Known Debt.

## Existing import functionality

- **Formats**: `json` and `structured_text` (a `---`-delimited key:value block
  format) — **`csv` did not exist**, despite CSV being a primary export format.
- **Pipeline** (`service.js`): `parseBulk` → `previewImport` (validate + duplicate-check
  every row, non-persistent) → `executeImport` (transactional, `BEGIN`/`COMMIT`/
  `ROLLBACK`). Already implements, correctly:
  - Header/field **aliasing** (`company_name`→`company`, `title`/`role`→`job_title`,
    `status`→`stage`, `applied_date`/`date`→`date_applied`, `url`/`job_link`→`job_url`,
    etc.) and **strict unknown-field rejection** (no fuzzy matching).
  - **Forbidden-field rejection** (`user_id`, `owner_id`, `created_by`, `role`, …) —
    mass-assignment protection at the field level, in addition to ownership being
    resolved server-side from the authenticated actor, never from the payload.
  - **Row validation**: required fields, date format, enum fields (stage/priority/
    work_arrangement/employment_type), email format, non-negative salary with
    min≤max, resume_version length/charset, resume_id shape — and, until this round,
    a job_url check that only verified "is this parseable as *a* URL", not "is this
    safe to render as a link" (see Security).
  - **Duplicate detection**: company + job_title + date_applied + normalized job_url
    match, with three deliberate, user-selectable actions — `skip` /
    `import_anyway` / `update_existing`.
  - **Two explicit, already-decided partial-failure models** —
    `valid_rows_only` (import what validates, report the rest) and `all_or_nothing`
    (any invalid row means the whole batch is `REJECTED`, nothing persisted) — both
    already implemented and tested.
  - **Batch tracking** (`import_batches`/`import_rows`): total/valid/invalid/
    duplicate/created/updated/skipped/rejected counts, status, per-row status and
    JSON error messages — all already written. **Nothing ever read `import_rows`
    back**, though — see Gap Analysis.
- **No file upload architecture at all.** Import is textarea-paste, not
  `<input type="file">` — the whole "file upload security"/"ZIP archive safety"/
  "path traversal" surface the brief describes **does not apply** to this app's actual
  architecture. The existing global request-body cap (`body()` in `server.js`, ~1MB,
  already returns 413 above that) is the only "size limit" relevant here, and it
  already covers pasted-text bulk import the same as every other POST body.
- **`/api/import/history`** already exists and is already correctly owner-scoped
  (a regular user sees their own batches; a manager sees everyone's) — but the nav
  entry pointing to it existed **only in the Manager section**, so a regular user had
  no way to reach a page that already worked correctly for them.

## Data flow

```
Export:  applications table --(curated fields, safeCell, noon-anchored dates)--> XLSX
         applications/other tables --(raw fields, csvEscape [+ safeCell as of this round])--> CSV
         14 tables --(as-is, secrets excluded)--> JSON (full backup; no restore)

Import:  pasted text --parseBulk(format)--> array of plain objects
                        (json | structured_text | csv [added this round])
                     --previewImport--> validateApplication + duplicate() per row
                     --executeImport--> BEGIN; insert/update/skip per row per
                        import_mode + duplicate_action; import_batches +
                        import_rows written; COMMIT/ROLLBACK
```

## Gap analysis

| Capability | Classification |
|---|---|
| CSV/JSON escaping correctness (quotes, commas, embedded newlines) | ALREADY IMPLEMENTED |
| XLSX formula-injection protection, curated fields, correct date handling | ALREADY IMPLEMENTED |
| **CSV formula-injection protection** | **NEEDS HARDENING — real gap, closed this round** |
| JSON full-workspace backup (export side) | ALREADY IMPLEMENTED |
| JSON full-workspace **restore** | **NOT PRESENT — deferred, see Known Debt** |
| Import: JSON, structured_text formats | ALREADY IMPLEMENTED |
| **Import: CSV format** | **NET NEW — closed this round, zero changes to the shared validation/duplicate/transaction pipeline** |
| Import preview (rows detected/valid/invalid/duplicate, per-row messages) | ALREADY IMPLEMENTED |
| Field mapping / safe header aliases | ALREADY IMPLEMENTED (CSV needed one addition — see below) |
| Required-field / row-level validation | ALREADY IMPLEMENTED |
| Duplicate detection + explicit handling (skip/import_anyway/update_existing) | ALREADY IMPLEMENTED |
| Partial-failure semantics (both models, explicit and tested) | ALREADY IMPLEMENTED |
| Import transaction safety | ALREADY IMPLEMENTED |
| Import batch tracking (counts, status) | ALREADY IMPLEMENTED |
| **Viewing a past batch's row-level detail/errors** | **NEEDS UX IMPROVEMENT — data already existed, nothing read it back; closed this round** |
| Ownership/IDOR on import, export, and batch history | ALREADY IMPLEMENTED |
| **job_url accepting unsafe protocols (`javascript:`, `data:`) as "valid"** | **NEEDS HARDENING — real gap, directly import-relevant, closed this round** |
| Import History reachable by a regular user | **NEEDS UX IMPROVEMENT — API/page already worked; nav entry was manager-only; closed this round** |
| File-upload security, ZIP/archive safety, path traversal | NOT APPLICABLE — no file-upload architecture exists |
| Import size/row limits | ALREADY IMPLEMENTED — the existing global ~1MB request-body cap already covers this |
| Salary normalization across currency/period | NOT JUSTIFIED this round — no evidence of a real problem; explicitly out of scope per the brief |
| Error-report CSV download | DEFERRED — the underlying data is now viewable (this round); exporting it as a separate CSV is a small additive follow-up, not done here |
| Batch-level "undo import" | NOT JUSTIFIED / explicitly avoided — see Known Debt |

## Scope

1. **CSV formula-injection fix**: `csvEscape` (shared by every CSV export) now runs
   values through the existing, already-tested `safeCell()` before quoting — closes
   the gap for applications/interviews/rejections/follow_ups/networking/reminders/
   goals/resume-analytics/aging/stage-duration/timeline CSV exports in one change.
2. **job_url safety fix**: `validateApplication` (shared by manual create/edit *and*
   import) now requires an actual `http:`/`https:` protocol, not just "parses as a
   URL"; the application-detail page's job_url link now uses the same
   `safeExternalUrl` guard already built in Round 5, so pre-existing unsafe data (from
   before this fix existed) can't render as a clickable link either.
3. **CSV import**: a small, dependency-free RFC 4180-ish parser
   (`parseCsvRows`/`parseBulk("csv", …)`), feeding the exact same
   alias/validate/duplicate/transaction pipeline JSON and structured_text already use.
   Header whitespace is normalized to underscores (`"Applied Date"` → `applied_date`)
   so human-friendly spreadsheet headers resolve through the existing alias table.
4. **Import batch row-detail**: new `GET /api/import/history/:id/rows` (owner-scoped,
   reusing the same ownership pattern as `/api/import/history`) + a "View Rows" action
   on the Import History page, surfacing `import_rows.messages_json` that already
   existed but was never read back anywhere.
5. **Import History nav fix**: moved from the Manager-only section into the main nav
   (the underlying API/page already handled both roles correctly).
6. Small UX polish: the result toast now mentions invalid/rejected rows when
   non-zero (`summarizeImportResult`); the Import History table's duplicate "Created"
   column header (once for the row count, once for the timestamp) is now
   disambiguated ("Created" / "Created At").
7. Tests: 2 new backend integration tests (real Postgres), 6 new unit tests, 1 new
   Playwright E2E test (5 viewports).

## Out of scope

Full-workspace JSON restore (see Known Debt — too large and too risky for a hardening
round); salary currency/period normalization; error-report CSV download (data is now
viewable, exporting it is a small separate follow-up); batch-level undo; any file-upload
architecture (none exists, none is being added); dashboard/design-system/Tasks/Habits/
Journal/Analytics work; React; Render/Neon changes.

## Architecture

- `backend/src/service.js`: `parseCsvRows` (new, pure) + a `"csv"` branch in
  `parseBulk` (new) sit entirely upstream of `previewImport`/`executeImport`, which
  are unchanged — CSV rows become plain objects with the exact same shape JSON rows
  already had, so the whole downstream pipeline treats them identically.
  `validateApplication`'s job_url check now requires an http(s) protocol.
- `backend/src/advanced.js`: imports `safeCell` from `feature-upgrade.js` and applies
  it inside the shared `csvEscape` helper — one change, every CSV export benefits.
- `backend/src/server.js`: new `GET /api/import/history/:id/rows`, matching the
  existing `/api/import/history` ownership pattern exactly (manager sees any batch,
  everyone else only their own — 404, not 403, on a mismatch, per this repo's
  established "don't reveal existence" convention).
- `frontend/src/features/import-export/format.js` (new): `summarizeImportResult`,
  `previewRowMessage` — pure functions extracted from what was inline string-building
  in `renderBulk`'s submit handler, now independently testable.
- `frontend/src/app.js`: `renderBulk` gains a `csv` format option + example text;
  `renderImports` gains a "View Rows" action reading the new endpoint, and a
  disambiguated column header; the main `nav` array gains `imports` (removed from the
  Manager-only block); the application-detail job_url link uses `safeExternalUrl`.
- No new dependency. No migration — `import_batches.input_format` is plain `TEXT`
  with no `CHECK` constraint, so `"csv"` is just another value it already accepted.

## Import validation

Unchanged except: (1) job_url now requires http(s) (closes a real gap — see Security),
(2) CSV headers are whitespace-normalized before alias matching so human-readable
spreadsheet column names resolve the same way `company_name`/`applied_date` already did
for JSON input.

## Export safety

CSV formula-injection is now neutralized identically to XLSX (`safeCell`, a leading
apostrophe on any string starting with `=`/`+`/`-`/`@`) — verified by test: import a
`=1+1` company name, export it, confirm the exported field is `'=1+1`, not the raw
`=1+1`. JSON export was already confirmed secret-free (checked again this round: no
`password_hash`, no session data, nothing from `import_batches`/`import_rows`).

## Duplicate handling

Unchanged — already correctly implemented (company + job_title + date_applied +
normalized job_url, three explicit user-selectable actions). Re-verified by the
existing test suite; no gap found.

## Error handling

Row-level messages already existed (`import_rows.messages_json`); they're now visible
after the fact via Import History → "View Rows", not only in the one-time preview/
result response. The result toast now says how many rows were rejected when that
count is non-zero.

## Security

Two real, concrete findings this round, both fixed and tested:

1. **CSV formula injection** — every CSV export (not just applications: interviews,
   rejections, follow_ups, networking contacts, reminders, goals, resume-analytics,
   aging, stage-duration, and per-application timeline CSVs) had zero protection
   against a cell value like `=1+1` or `=HYPERLINK(...)` being interpreted as a live
   formula when opened in Excel/Sheets/LibreOffice — a real risk on a multi-user app
   where a manager can export reports containing other users' data. XLSX already had
   this protection (`safeCell`); CSV didn't. Fixed by routing every CSV cell through
   the same, already-tested function.
2. **job_url accepted unsafe protocols** — `new URL("javascript:alert(1)")` parses
   without throwing, so the pre-existing validation ("is this a URL at all") let a
   `javascript:`/`data:`/`vbscript:` value through as "valid" for both manual entry
   *and* bulk import — and the application-detail page rendered `job_url` as a
   clickable `<a href>` with no further check. A malicious import row could have
   planted a stored-XSS-via-click vector. Fixed at both ends: `validateApplication`
   requires `http:`/`https:`, and the render side independently validates again
   (defense in depth — protects any row that predates this fix).

Everything else audited and confirmed already correct: ownership/ID0R on all
import/export/batch-history endpoints (verified by test, including the new
row-detail endpoint), no mass-assignment (forbidden-field rejection was already
there), parameterized queries throughout (no SQL injection surface touched by this
round), no secrets in JSON export, no file-upload attack surface (none exists).

## Performance

No N+1 introduced. CSV parsing is a single linear pass over the pasted text (same
computational shape as the existing JSON.parse-based path). The new row-detail
endpoint is one indexed query (`import_rows` has no dedicated index on `batch_id`
today, but batches are naturally small — see Known Debt for the one thing worth
watching if that changes). No streaming/pagination added — not justified at the
existing ~1MB pasted-text scale.

## Accessibility

New "View Rows"/format-select controls use the same labeled-control conventions
already established (`select()`/`field()` helpers). Confirmed via the new E2E test's
axe scan across the Bulk Import → Import History → row-detail flow — zero violations,
run unscoped (unlike Round 4/5's scoped scans, since this flow doesn't touch the known
pre-existing `#detail-stage`-style issues on the application detail page).

## Responsive behavior

Reuses the existing `.card`/`.form-grid`/`.table-wrap` (already keyboard-focusable,
fixed in Round 5) responsive patterns — no new layout primitives. Confirmed via the new
E2E test across all 5 viewport projects.

## Database impact

None. No migration — `import_batches.input_format` already accepted arbitrary text.

## API impact

New: `GET /api/import/history/:id/rows`. No existing endpoint's contract changed
(`format: "csv"` is simply a new accepted value for the existing `format` field on
`/api/import/preview` and `/api/import`, not a new endpoint or a breaking change to
existing JSON/structured_text callers).

## Implementation tasks

- [x] `parseCsvRows` + CSV branch in `parseBulk`, header whitespace normalization.
- [x] `csvEscape` routes through `safeCell` (every CSV export).
- [x] `validateApplication` job_url protocol check (http/https only).
- [x] Application-detail job_url render uses `safeExternalUrl`.
- [x] `GET /api/import/history/:id/rows`, owner-scoped.
- [x] `frontend/src/features/import-export/format.js` (`summarizeImportResult`,
      `previewRowMessage`).
- [x] `renderBulk`: CSV format option + example; uses the new pure formatters.
- [x] `renderImports`: "View Rows" action, disambiguated column header.
- [x] `nav`: `imports` moved from Manager-only to the main array.
- [x] Backend integration tests (real Postgres): CSV import round-trip +
      formula-injection-safe export, batch row-detail visibility/IDOR.
- [x] Unit tests: `parseCsvRows` (quoted commas, doubled quotes, embedded newlines,
      CRLF, Unicode), `parseBulk("csv")`, `validateApplication` job_url rejection,
      `summarizeImportResult`, `previewRowMessage`.
- [x] Playwright E2E test: CSV format → preview → import → Applications → Import
      History (now reachable) → View Rows, run across all 5 viewports.

## Acceptance criteria

- [x] CSV export neutralizes formula-injection identically to XLSX (verified by test:
      import a formula-like value, export, confirm the neutralized form).
- [x] CSV import works end-to-end (preview + execute), including quoted-comma fields
      and human-readable header aliasing, verified against real Postgres and a real
      browser.
- [x] job_url rejects unsafe protocols on both manual entry and import; a pre-existing
      unsafe value (hypothetically already stored) can't render as a clickable link.
- [x] A user can view their own past import batches' row-level results; ownership/IDOR
      verified by test.
- [x] No N+1, no new dependency, no migration.
- [x] Full CI green (8/8 jobs) — see CI Status.

## Testing

Local: `npm run lint`, `typecheck`, `build`, `build:frontend`, `test:frontend` (24
tests, up from 19) all pass.

**Real PostgreSQL validation**: Docker was briefly unavailable at the start of this
session (Docker Desktop wasn't running); started it, waited for the daemon, then used
the same throwaway `postgres:17-alpine` pattern established in Round 4/5 — 23/23
backend tests pass, including both new Round 6 tests (CSV import/export round-trip,
batch row-detail ownership/IDOR).

**Real browser validation**: local Chromium, new E2E test (CSV format → preview →
import → Applications → Import History → View Rows) passes on all 5 viewport
projects; full existing non-pixel suite (20/20) passes with no regressions — verified
before pushing.

One incidental observation: a full local run hit one unrelated, non-reproducible test
failure (`PIN validation accepts leading zero...`, asserting a scrypt hash string
doesn't happen to contain the plaintext PIN as a substring — a coincidence-based
assertion, not a deterministic property of correct hashing). Re-ran in isolation 3/3
and the full suite again immediately after: both clean. Confirmed unrelated to this
round's changes (nothing here touches PIN/auth code) and not reproducible — not fixed,
noted for awareness only.

## Files changed

```
backend/e2e/jobquest.spec.js                          (new bulk-import E2E test)
backend/src/advanced.js                                (csvEscape -> safeCell)
backend/src/server.js                                  (GET /api/import/history/:id/rows)
backend/src/service.js                                 (parseCsvRows, CSV branch in parseBulk,
                                                         job_url protocol validation)
backend/test/app.test.js                               (2 new Round 6 integration tests)
backend/test/frontend.test.js                           (6 new unit tests)
docs/FEATURE_UPGRADE_6.md                              (new, this doc)
frontend/src/app.js                                    (CSV format option, job_url safe link,
                                                         Import History nav + view-rows UI:
                                                         2877 -> 2912 lines)
frontend/src/features/import-export/format.js          (new)
```

## Commits

See git log on `feature/006-import-export-hardening` — scoped per the round's
suggested progression (audit doc, CSV formula-injection fix, job_url fix, CSV import,
batch row-detail endpoint + UI, nav/UX polish, tests, continuity docs).

## CI status

PR [#13](../../../pull/13) into `development`: all 8 jobs pass — `static-quality`,
`security`, `sqlite-postgres-migration`, `tests` × 4 (backend/frontend/integration/
e2e), and `browser-and-visual` (35 tests total, up from 30: 28 passed, 7 skipped,
0 failed — the 5 new bulk-import E2E tests, one per viewport, all pass, and all 23
pre-existing baseline tests unchanged — zero visual regression).

**One fix round was needed, for a genuinely interesting reason**: the first two CI
pushes both failed `browser-and-visual`, on a *different, effectively random* viewport
project each time (`tablet`, then `compact-desktop`) — with the identical error: a
pre-existing (Round 5) assertion, `getByRole("heading", { name: "Networking" })`
without `exact: true`, ambiguously matched both the Networking tracker page's own
`<h1>Networking</h1>` and its create-form's `<h2>Add Networking</h2>`. This never
reproduced locally (4/4 passes on the specific viewport CI first failed on, 5/5 across
all viewports afterward) — a real, latent test fragility that CI's timing happened to
expose and local runs didn't. Fixed with `exact: true`, matching the identical fix
already applied to a similar case earlier in Round 5; verified fixed by watching CI
turn green on the very next push, not just by local re-runs.

## Known debt (backlogged, not fixed this round)

- **No restore path for the full-workspace JSON export.** The export is genuinely
  comprehensive (14 tables) and already labeled as a backup (`export_version`,
  `exported_at`), but building a safe restore — one that can't silently duplicate or
  overwrite a user's entire account, across 14 tables with real foreign-key
  relationships — is real, separate, higher-risk feature work, not "hardening."
  Deliberately not attempted this round.
- **No error-report CSV download.** Row-level detail is now viewable (this round);
  offering it as a downloadable CSV is a small, separate follow-up.
- **`import_rows` has no dedicated index on `batch_id`.** Fine at today's scale (a
  `WHERE batch_id=?` scan over a small per-user table); worth adding
  `CREATE INDEX ... ON import_rows(batch_id)` if batch sizes or total import volume
  ever grow enough to matter — no evidence they do today.
- **Salary currency/period normalization** remains unresolved from earlier rounds —
  raw values are preserved as-is on both import and export; not addressed here per
  the brief's explicit instruction not to invent normalization this round.
- **The coincidental PIN-hash test flake** noted in Testing — not fixed (unrelated to
  this round), but worth a one-line note for whoever next sees it: it's a substring
  coincidence, not a real bug, and the fix (if ever done) belongs to auth tests, not
  import/export.

## Completion notes

Nothing in Round 7+ ([docs/PRD.md](PRD.md)) has started. Do not begin Round 7 until this
round's PR is reviewed/merged and the user has explicitly said to proceed.
