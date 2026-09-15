# Current task

**Status: Round 4 implemented, CI green, PR #11 open — awaiting the user's review/merge.**
See [docs/FEATURE_UPGRADE_4.md](../docs/FEATURE_UPGRADE_4.md) for full detail.

Branch: `feature/004-application-checklist-gap-close`, based on `development` (which
now includes the merged Round 3 PR #10 — regular merge, per convention).

## What just happened

1. PR #10 (Round 3) merged into `development` via regular merge commit.
2. Audited the existing checklist implementation end-to-end (schema → API → UI) before
   writing anything. Found: schema, list, create, complete/uncomplete, progress
   indicator, and ownership/IDOR protection **already implemented**; edit, delete,
   reorder, and input validation were **genuinely missing** (not even a DELETE route
   existed). Full reconciliation table in the feature doc.
3. Closed the real gaps: `DELETE`/label-edit on the existing checklist endpoint, a new
   `/move` endpoint (adjacent-position swap, mirroring `moveWidget`'s existing pattern),
   server-side label validation, and matching UI (edit/delete/move-up/move-down
   controls, error toasts, empty state). Added a new `frontend/src/features/checklist/
   groups.js` module that groups the checklist for *display* by lifecycle phase — a
   safe, read-time-only way to get real stage-awareness value without the
   duplicate-generation risk of making item *creation* stage-aware (deferred, see the
   feature doc's Known Debt).
4. Verified with a full manual curl smoke test against a real running server, plus new
   backend integration tests (create/edit/complete/reorder/delete/validation/ownership)
   and frontend unit tests (grouping/progress) — 16 frontend tests total (was 13).
5. First CI push failed on Postgres (a real dialect bug: mixing a `timestamptz`
   `CASE` branch with a `TEXT` column reference — fine on SQLite, not on Postgres).
   Fixed, verified against a local throwaway `postgres:17-alpine` container (Docker is
   available in this environment — corrected an earlier wrong assumption that it
   wasn't, see `brain/PROJECT_STATE.md`), then re-pushed.
6. Added real Playwright E2E coverage for the checklist (none existed before) —
   installed Chromium locally, ran it against Postgres across all 5 viewport projects.
   That work surfaced and fixed one real new a11y violation this round introduced
   (`.btn.small.danger` contrast) and two pre-existing unrelated ones on the same page
   (`#timeline-filter`/`#timeline-sort` missing labels) — fixed in passing since they
   were one-line and were blocking honest scanning of this round's own work. A third
   (`#detail-stage`) was left for the backlog, not fixed, to avoid scope creep into an
   unrelated page-wide audit.

## Next safe action

PR [#11](https://github.com/KrapaGoutam/JobQuest1.0/pull/11) is open into `development`
with all 8 CI jobs green (browser-and-visual: 18 passed/7 skipped/0 failed across 25
tests — the 5 new checklist tests all pass, and all 13 pre-existing baseline tests are
unchanged). Left unmerged for the user's review. Do not start Round 5 until this PR is
merged and the user has explicitly said to proceed.
