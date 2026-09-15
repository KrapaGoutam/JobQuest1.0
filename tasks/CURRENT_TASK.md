# Current task

**Status: Round 4 implemented locally, ready to push/PR.** See
[docs/FEATURE_UPGRADE_4.md](../docs/FEATURE_UPGRADE_4.md) for full detail.

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

## Next safe action

Push the branch, open a PR into `development`, and get CI green (this round's UI change
is modest — grouped sections + inline controls — but per Round 3's finding, don't
assume "green" vs "needs a baseline update" either way; check the actual result). Do not
merge to `main`. Do not start Round 5 until this PR is merged and the user has
explicitly said to proceed.
