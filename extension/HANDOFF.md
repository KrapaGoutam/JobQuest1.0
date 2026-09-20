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
CP8 completed. CP9 in progress.

## Current Objective
Implement the JobQuest V2.1 Browser Capture Extension — a Manifest V3 Chrome/Edge extension for capturing job postings and saving them to JobQuest.

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

## Partially Complete
- None

## Currently In Progress
- CP9: Review, final docs, and PR to development

## Pending
- CP9: Review + PR to development

## Roadmap Remaining
1. CP9: Final verification sweep, documentation sync, and PR to `development`

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
- All prior round tests (backend 33, frontend 44, integration 33, e2e 33, browser 63) — unchanged

## Tests Failing
- None

## Known Bugs
- None

## Fixed Bugs
- N/A (new feature)

## Technical Debt
- None introduced yet

## Last Successful Command
git switch -c feature/011-jobquest-capture-extension

## Last Failing Command
N/A

## Last Commit
8f9fccd feat(extension): implement capture popup and duplicate detection UX [CP5, CP6]

## Current CI Status
All local CI checks passing (backend, frontend, extension, e2e, lint, typecheck)

## Current PR Status
Pending completion of CP9

## Next Exact Action
Commit CP7/CP8 work, update docs (PROJECT_STATE.md, FEATURE_UPGRADE_11_BROWSER_EXTENSION.md), run final test sweep, push to origin, and create PR into `development`.

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
