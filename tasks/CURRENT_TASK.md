# Current task

**Status: Round 6 implemented locally, ready to push/PR.** See
[docs/FEATURE_UPGRADE_6.md](../docs/FEATURE_UPGRADE_6.md) for full detail.

Branch: `feature/006-import-export-hardening`, based on `development` (which now
includes the merged Round 5 PR #12 — regular merge, per convention).

## What just happened

1. PR #12 (Round 5) merged into `development` via regular merge commit.
2. Audited import/export end-to-end before writing anything. Found the preview/
   validation/duplicate-detection/transaction pipeline was **already exceptionally
   solid** (both partial-failure models already implemented, XLSX already had
   formula-injection protection and correct date handling) — but found two real,
   concrete security gaps and one real missing capability:
   - **Every CSV export had zero formula-injection protection** (only XLSX did).
   - **`job_url` accepted `javascript:`/`data:` as "valid"** (only checked
     parseability, not safety) — and the application-detail page rendered it as a
     clickable link with no further check.
   - **CSV import didn't exist at all** — only JSON and a custom structured-text
     format, despite CSV being a primary export format.
   - Smaller: `import_rows` (per-row error detail) was written but never read back
     anywhere; "Import History" was manager-only in the nav even though the API
     already correctly scoped it to "my own batches" for regular users too.
3. Closed all of that: `csvEscape` now reuses the existing, already-tested `safeCell`
   formula-injection guard (fixes every CSV export in one change);
   `validateApplication` (shared by manual entry *and* import) now requires http(s)
   job_url; added a small dependency-free CSV parser feeding the exact same
   downstream pipeline JSON/structured_text already used; added
   `GET /api/import/history/:id/rows` + a "View Rows" UI action; moved "Import
   History" into the main nav.
4. Verified with the same rigor established in Round 4/5: real Postgres via Docker
   (Docker Desktop wasn't running at session start — started it, waited for the
   daemon, then proceeded) — 23/23 backend tests including 2 new Round 6 tests; real
   Chromium — new E2E test 5/5 viewports, full existing non-pixel suite 20/20, no
   regressions — all before pushing.

## Next safe action

Push the branch, open a PR into `development`, and get CI green. Do not merge to
`main`. Do not start Round 7 until this PR is merged and the user has explicitly said
to proceed.
