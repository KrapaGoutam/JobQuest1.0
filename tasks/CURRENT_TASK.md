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
- **Fixed Defect 3 (Non-Standard Career Page & Aggregator Extraction Failure)**:
  - Root cause: Extractor unconditionally checked metadata (`og:title`, `<title>`) before rendered DOM headings, capturing marketing slogans ("Jobright: Your AI Job Search Copilot") and platform branding ("Jobright AI") on aggregators, or capturing company name as title ("Tensor") and leaving company blank on employer career pages. Also failed on dual-suffix salaries (`$120K/yr - $140K/yr`).
  - Solution: Enforced strict source-quality hierarchy: high-confidence semantic DOM headings outrank metadata slogans; implemented `isGenericTitle()`; separated aggregator domains (branding never assigned as employer) from direct employer sites (safe domain brand attribution); added multi-location joining (`"; "`), workplace arrangement fallback from location chips, and dual-suffix salary regex.
  - Fixtures: `extension/fixtures/tensor_career_job.html` & `extension/fixtures/aggregator_jobright_job.html`.
  - Zero hardcoding of company names or role titles; JobRight-specific adapter remains DEFERRED / ON HOLD.
- **Fixed Defect 4 (Extension Stage Alignment with JobQuest Workflow Actions)**:
  - Root cause: Extension maintained an independent, hardcoded stage list (`["Bookmarked", "Applied", "Screening", "Interviewing", "Offer"]`). In JobQuest's canonical workflow model, bookmarking before applying is canonically represented by `"Saved"`, and valid stages are defined in `backend/src/service.js:STAGES`. Submitting `"Bookmarked"` failed with HTTP 400 (`Unsupported stage: Bookmarked`).
  - Solution: Exposed `GET /api/extension/stages` and `GET /api/extension/workflow-actions`. Updated `extension/popup.html` and `popup.js` (`loadWorkflowStages()`) to fetch and dynamically render canonical options. Display labels map to valid stored values (`"Saved"` for pre-application bookmarking, `"Applied"` as default). Robust failure handling displays an error banner and disables save button if fetch fails.
- **Fixed Defect 5 ("Open Existing" / "View Existing Application" Deep-Linking UX Gap)**:
  - Root cause: Duplicate warning buttons navigated to `${instanceUrl}/` (landing on Dashboard) instead of opening the matched application.
  - Solution: Added `buildSecureJobQuestUrl()` in `extension/api/jobquest.js` to build `/?application=${targetId}` with protocol (`http:`, `https:`) and origin boundary security. Updated `backend/src/extension.js` duplicate-check endpoint to include stable `id` and `application_id` across all match tiers. Added `resolveInitialRoute()` in `frontend/src/app.js` supporting `?application=<id>`, `?id=<id>`, `#detail:<id>`. Preserved target parameter across unauthenticated PIN login flow. Added graceful 404 fallback in `renderDetail()` navigating to `applications` with `toast("Application could not be found.")`.
- **Real-World Test Suite & Verification**:
  - `backend/test/app.test.js`: 57/57 passing (added tests for canonical stages endpoint, all 13 canonical stages, `Bookmarked` rejection with 400, forged stage rejection, and duplicate response IDs).
  - `extension/tests/api.test.js` & `extractor.test.js`: 23/23 passing (added unit tests for canonical stages parity, unsupported stage regression, label mapping, URL security, duplicate IDs, and extractor fixtures).
  - `backend/e2e/extension.spec.js`: 6/6 passing (covering exact duplicate deep-linking, unauthenticated deep-link preservation, deleted target fallback, and `Saved` stage capture).
  - `npm run test:frontend`: 44/44 passing.
  - `npm run lint` & `npm run typecheck`: clean.
  - `npm run build:frontend`: clean production bundle.
- **Documentation Suite Delivered**:
  - `docs/EXTENSION_ARCHITECTURE.md`: Full architecture specification + Extractor Engine Cascade + Canonical Stage Synchronization + Duplicate Deep-Linking.
  - `docs/EXTENSION_TEST_PLAN.md`: Complete test matrix + real-world manual testing checklists.
  - `docs/EXTENSION_SECURITY.md`: Auth scoping, IDOR, input sanitation, URL security, and deep-link validation.
  - `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`: Updated with Defect 4 and Defect 5 analyses and decisions.
  - `brain/DECISIONS.md`: Logged `2026-09-21 — Round 11: Canonical Workflow Stages Synchronization & Duplicate Deep-Linking`.

## Next exact action

Awaiting user review and approval of PR #20 into `development`.
DO NOT merge PR #20. DO NOT merge to `development` or `main`. DO NOT deploy to production. DO NOT publish extension to store.

## Key Decisions

- Duplicate detection: Company-first 4-state model (`EXACT_POSTING`, `SAME_ROLE`, `COMPANY_ONLY`, `NONE`).
- Company-only matches are informational only (`banner.info`), non-blocking.
- Manual tailored resume strings supported (`resume_id: null`, `resume_version: string`).
- Generic extraction hierarchy: Semantic rendered DOM headings outrank site-level metadata; marketing slogans and generic portal words rejected; aggregator platform brands never assigned as employer company.
- JobRight.ai support is explicitly DEFERRED / ON HOLD.
- No React, no Tailwind, no Selenium (Playwright + vanilla JS only).


