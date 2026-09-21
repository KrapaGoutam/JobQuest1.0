# Current task

**Status: FINAL RELEASE INTEGRATION — Round 10 merged into `development`; a
`development → main` release-candidate PR is open (PR #18), validated, and
waiting for explicit user approval before merge.** PR #18 is on hold pending
user approval — it does not block Round 11 work.

## Round 10 / Release Integration summary

See [brain/PROJECT_STATE.md](../brain/PROJECT_STATE.md) for full detail.
Key: PR #18 (`development → main`) is open and green, not merged, awaiting user
approval. Do not merge PR #18 without explicit instruction.

---

# Round 11 — Browser Capture Extension (PRE-MERGE STABILIZATION & REAL-WORLD VALIDATION)

**Branch**: `feature/011-jobquest-capture-extension` (off `development`)
**Status**: Pre-merge stabilization & defect fixes complete. PR #20 updated on origin.
**Feature doc**: `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`
**Extension handoff**: `extension/HANDOFF.md`
**PR**: #20 (`feature/011-jobquest-capture-extension` &rarr; `development`)

## What just happened (Round 11 Pre-Merge Stabilization — Antigravity, 2026-09-20)

- **Fixed Defect 1 (False Duplicate Banner on First Capture)**:
  - Root cause: CSS rule `.banner { display: flex; }` overrode the browser user-agent's `[hidden]` attribute.
  - Solution: Added `[hidden] { display: none !important; }` in `extension/popup.css`. Removed static placeholder text from `extension/popup.html`.
  - Refactored `GET /api/extension/duplicate-check` with Company-First semantics: `EXACT_POSTING` (exact URL), `SAME_ROLE` (company + title), `COMPANY_ONLY` (informational only, non-blocking banner for prior roles at the same company), and `NONE` (clean).
- **Fixed Defect 2 (Tailored Resume Manual Entry HTTP 400)**:
  - Root cause: `validateApplication` in `backend/src/service.js` checked `data.resume_id !== undefined && data.resume_id !== ""`. When payload passed `resume_id: null`, `Number(null)` became 0, failing `0 < 1`.
  - Solution: Explicitly allowed `data.resume_id === null` in `service.js` and updated `POST /api/extension/applications`. Added 3-mode resume picker in `extension/popup.html` / `popup.js` (Select from library, Enter manually, None).
- **Real-World Test Suite & Verification**:
  - `backend/test/app.test.js`: 52/52 passing (added tests for `COMPANY_ONLY`, `SAME_ROLE`, bounded results, and manual resume entry; fixed weekly recurrence date-flake for 2028).
  - `extension/tests/api.test.js`: 10/10 passing (added unit tests for `normalizeJobUrl`, `normalizeText`, resume payload formatting, and duplicate classification).
  - `backend/e2e/extension.spec.js`: 10/10 passing across all 5 responsive viewports.
  - `npm run test:frontend`: 44/44 passing.
  - `npm run lint` & `npm run typecheck`: clean.
- **Documentation Suite Delivered**:
  - `docs/EXTENSION_ARCHITECTURE.md`: Full architecture specification.
  - `docs/EXTENSION_TEST_PLAN.md`: 34-scenario matrix & real-world manual testing checklist.
  - `docs/EXTENSION_SECURITY.md`: Auth scoping, IDOR, input sanitation, rate-limiting, and URL validation posture.
  - `docs/EXTENSION_INSTALLATION.md`: Step-by-step developer unpacked installation guide.
  - `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`: Updated with stabilization defect analyses and decisions.
  - `tasks/BACKLOG.md`: Formalized JobRight.ai deferred status (ON HOLD).

## Next exact action

Awaiting user review and approval of PR #20 into `development`.
DO NOT merge PR #20. DO NOT merge to `development` or `main`. DO NOT deploy to production. DO NOT publish extension to store.

## Key Decisions

- Duplicate detection: Company-first 4-state model (`EXACT_POSTING`, `SAME_ROLE`, `COMPANY_ONLY`, `NONE`).
- Company-only matches are informational only (`banner.info`), non-blocking.
- Manual tailored resume strings supported (`resume_id: null`, `resume_version: string`).
- JobRight.ai support is explicitly DEFERRED / ON HOLD.
- No React, no Tailwind, no Selenium (Playwright + vanilla JS only).

