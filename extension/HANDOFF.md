# JobQuest Capture Extension — Agent Handoff

## Continuation Instructions

Before changing code:

1. Verify repository is KrapaGoutam/JobQuest1.0
2. Read AGENTS.md
3. Read tasks/CURRENT_TASK.md
4. Read tasks/BACKLOG.md
5. Read brain/PROJECT_STATE.md
6. Read brain/DECISIONS.md
7. Read brain/AGENT_HANDOFF_LOG.md
8. Read docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md
9. Read extension/HANDOFF.md (this file)
10. Run: git status
11. Confirm current branch: feature/011-jobquest-capture-extension
12. Inspect recent commits: git log --oneline -10
13. Review tests/CI state
14. Continue from Next Exact Action

## Repository
KrapaGoutam/JobQuest1.0

## Current Branch
feature/011-jobquest-capture-extension

## Base Branch
development (head: a61e26e)

## Current Checkpoint
Pre-Merge Stabilization & Real-World Local Validation completed. PR #20 updated targeting `development`.

## Current Objective
Stabilize JobQuest V2.1 Browser Capture Extension by resolving local real-world test defects, establishing company-first duplicate semantics, supporting tailored resume manual entry, and providing realistic test coverage and documentation.

## Completed
- CP0: Branch created off development; docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md written; this HANDOFF.md written; CURRENT_TASK.md and PROJECT_STATE.md updated
- CP1: Migration 013 (extension_tokens) + backend/src/extension.js (7 routes + bearer-token auth) + wired into server.js + 16 extension test cases in app.test.js (49/49 passing)
- CP2: Frontend Settings token manager UI (generate token with raw token display + copy, list active tokens, revoke token, navigation shortcut in settings tabs)
- CP3: Extension skeleton (Manifest V3 manifest.json, brand PNG icons 16/48/128, background service worker, options page HTML/CSS/JS with connection tester and storage persistence, API client module)
- CP4: Extractor engine + unit tests (schema.org JSON-LD parser, Greenhouse adapter, Lever adapter, Indeed adapter, generic meta/DOM fallback, orchestrator cascade, fixtures, and 6/6 passing unit tests)
- CP5: Popup core flow (content.js extractor runner, popup.html/css/js, auth check, active tab extraction, dynamic resumes dropdown, application saving, success view)
- CP6: Duplicate detection UX (Level-1 exact URL and Level-2 company+title duplicate warnings in popup with real-time field evaluation)
- CP7: Playwright E2E tests (`backend/e2e/extension.spec.js`, covering settings token UI, capture auth, duplicate check, and workspace UI reflection across 5 viewports — 10/10 passed)
- CP8: CI integration (`.github/workflows/ci.yml` matrix updated) and extension documentation (`extension/README.md`)
- CP9: Final verification sweep, documentation sync, branch pushed to origin, and PR #20 opened targeting `development`
- Pre-Merge Stabilization:
  - Defect 1 Fixed: CSS specificity override on `[hidden]` attribute resolved (`[hidden] { display: none !important; }`), static placeholder removed from HTML. Company-first duplicate classification (`EXACT_POSTING`, `SAME_ROLE`, `COMPANY_ONLY`, `NONE`) implemented in `backend/src/extension.js` and `extension/popup.js`.
  - Defect 2 Fixed: Support `resume_id: null` with `resume_version` in `backend/src/service.js` and `backend/src/extension.js`. Added 3-mode tailored resume interface in `extension/popup.html` and `popup.js`.
  - Defect 3 Fixed: Hardened generic extraction cascade prioritizing semantic rendered DOM headings over metadata marketing slogans; aggregator domain branding never treated as employer company; dual-suffix salary regex support.
  - Defect 4 Fixed: Extension stage alignment with JobQuest workflow actions. Added `GET /api/extension/stages`, removed invented `Bookmarked` stage in favor of canonical `Saved` stage for bookmarks and `Applied` default.
  - Defect 5 Fixed: Open Existing duplicate navigation deep-links directly to matched application via `?application=<id>` in `frontend/src/app.js`, origin-validated via `buildSecureJobQuestUrl`, with graceful 404 fallback to Applications view and toast notice.
  - Realistic Test Suite: Backend tests (57/57 passing), extension unit tests (23/23 passing), frontend unit tests (44/44 passing), Playwright E2E tests (6/6 passing).
  - Documentation Suite: Produced `docs/EXTENSION_ARCHITECTURE.md`, `docs/EXTENSION_TEST_PLAN.md`, `docs/EXTENSION_SECURITY.md`, `docs/EXTENSION_INSTALLATION.md`, updated `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`, and marked JobRight.ai support as deferred in `tasks/BACKLOG.md`.

## Partially Complete
- None

## Currently In Progress
- Final verification sweep before updating PR #20 with green CI

## Pending
- User approval and merge into `development`

## Roadmap Remaining
- PR #20 user review. (JobRight.ai support deferred to V2.1/V2.2).

## Files Currently Being Modified
- (none yet — CP1 about to begin)

## Architecture Decisions

### Authentication
Extension bearer tokens (NOT session cookie reuse):
- New table: extension_tokens (SHA-256 hash stored, raw token returned once)
- User generates token in Settings → pastes into extension Options
- Extension sends: Authorization: Bearer <raw_token>
- Backend validates hash, enforces user_id scoping, updates last_used_at
- All extension endpoints except /api/extension/tokens/* require bearer token

### API Endpoints
- POST   /api/extension/tokens        (session + CSRF: generate token)
- GET    /api/extension/tokens        (session: list tokens metadata)
- DELETE /api/extension/tokens/:id    (session + CSRF: revoke)
- GET    /api/extension/me            (bearer: verify auth)
- GET    /api/extension/resumes       (bearer: list active resumes)
- GET    /api/extension/duplicate-check (bearer: check duplicates)
- POST   /api/extension/applications  (bearer: create application)

## Resume Integration Decision
- Dropdown in popup populated from GET /api/extension/resumes
- User must explicitly choose; null/empty = no resume (allowed)
- Selected resume.version_name → applications.resume_version
- Selected resume.id → applications.resume_id
- Never auto-selected (not newest, not most used, not inferred)

## Duplicate Matching Rules
All matching is backend-side, scoped to authenticated user.
- Level 1: Exact normalized URL match → "⚠ Already saved in JobQuest"
  - Normalize: lowercase, strip trailing slash, strip utm_* query params
- Level 2: Exact normalized company + exact normalized title → "⚠ Possible existing application found"
  - Normalize: trim, lowercase, collapse internal whitespace
- No fuzzy, no AI, no embedding-based matching in this round
- Duplicate check is read-only — never creates an application

## Duplicate Warning UX
On duplicate found, popup shows:
- Match level + message
- Existing application details: title, company, date_applied, stage, source, location, resume_version, priority, updated_at, job_url
- Three buttons: [Open Existing] [Save Anyway] [Cancel]
- "Save Anyway" creates a new application with full validation intact
- "Open Existing" opens the JobQuest web app (new tab) with the existing application

## Supported Sites (Extractor)
Planned for CP4:
- JSON-LD generic (schema.org JobPosting) — highest priority
- Greenhouse ATS
- Lever ATS
- Indeed
- Generic fallback (meta tags + DOM heuristics)

## MCP / Tooling Status

### Available
- Git, Node.js 24, Playwright, linkedom (devDep), gh CLI (assumed from prior rounds)

### Installed During Feature
- Nothing new yet

### Missing but Optional
- None identified

### Requires User Authorization
- None currently

## Tests Passing
- All prior round tests (backend 52, frontend 44, extension extractor 16, extension api 10, e2e 10 across 5 viewports) — all green
- Total extension tests passing: 36/36 (16 extractor unit, 10 API client unit, 10 E2E across 5 viewports)

## Tests Failing
- None

## Known Bugs
- None

## Fixed Bugs
- Defect 1: False duplicate banner on fresh captures due to CSS specificity overriding [hidden]
- Defect 2: HTTP 400 when submitting tailored resume manual entry with resume_id: null
- Defect 3: Non-standard career page and job aggregator extraction failure (marketing slogan/brand captured instead of job title/company, dual-suffix salary truncation, missing workplace fallback). Solved architecturally via source-quality hierarchy: high-confidence semantic DOM headings outrank metadata slogans; aggregator domain platform brand never assigned as employer company; employer domains attribute domain name; dual-suffix salary regex; multi-location semicolon joining.

## Technical Debt
- JobRight.ai support deferred to V2.1/V2.2 (logged in tasks/BACKLOG.md)

## Current CI Status
All local CI checks passing (backend 52/52, frontend 44/44, extension extractor 16/16, extension api 10/10, e2e 10/10 across 5 viewports, lint clean, typecheck clean, build:frontend clean)

## Current PR Status
PR #20 open against `development`: https://github.com/KrapaGoutam/JobQuest1.0/pull/20

## Next Exact Action
Await CI completion and user review/merge of PR #20. Do not merge without user approval. Do not touch `main`.



## Do Not Change
- Work only in KrapaGoutam/JobQuest1.0.
- Leave unrelated repositories untouched.
- React remains on hold.
- Do not work directly on main.
- Do not merge to main.
- Do not deploy production.
- Do not connect extension directly to Neon.
- Do not invent missing captured values.
- Do not infer resume selection.
- Do not bypass duplicate warnings.
- Do not weaken security.
- Do not install unnecessary MCP servers.
- Do not modify historical migrations (001–012).
