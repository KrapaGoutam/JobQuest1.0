# FEATURE_UPGRADE_11 — Browser Capture Extension

## Goal

Build a Chrome/Edge Manifest V3 browser extension ("JobQuest Capture") that lets a user capture a job posting from any page, review/edit it, select which resume they used, check for duplicate applications, and save directly to their JobQuest account — without ever leaving the browser tab.

## Scope

**In scope:**
- Manifest V3 extension (Chrome + Edge, load-unpacked only)
- Extension bearer-token authentication (new `extension_tokens` table, migration 013)
- Settings-page token manager (generate / copy / revoke)
- Popup: capture → preview → resume selection → duplicate check → save
- Duplicate detection: Level 1 (exact URL) + Level 2 (company + title)
- Site extractors: JSON-LD, Greenhouse, Lever, Indeed, generic fallback
- 7 new backend API routes under `/api/extension/*`
- Unit tests for extractors and API client
- Playwright E2E tests for the full extension flow
- CI integration (new `extension-tests` job)

**Out of scope (not this round):**
- React migration
- Firefox / Safari ports
- Chrome Web Store / Edge Add-ons publication
- AI/embedding duplicate detection
- Automatic resume selection
- Any change to `main` or production deployment

## Architecture

### Authentication Design

The existing session system uses `HttpOnly; SameSite=Strict` cookies — these are inaccessible to extensions by design. The extension uses a **dedicated bearer token** approach:

1. User navigates to JobQuest Settings → "Browser Extension" section
2. Clicks "Generate token" → backend creates an `extension_tokens` row (SHA-256 hash stored), returns raw token once
3. User copies token, opens extension Options page, pastes token + backend URL
4. Extension stores both in `chrome.storage.local`
5. All extension API calls use `Authorization: Bearer <token>` header
6. Backend validates hash, updates `last_used_at`, enforces `user_id` scoping

Benefits over session re-use:
- Revocable independently from web sessions
- Doesn't require the web UI to be open simultaneously  
- No CSRF surface (bearer token IS the CSRF protection)
- Clear separation of extension vs. web session concerns

### Backend Routes (`/api/extension/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/extension/tokens` | Session + CSRF | Generate extension token |
| `GET` | `/api/extension/tokens` | Session | List user's tokens (metadata only) |
| `DELETE` | `/api/extension/tokens/:id` | Session + CSRF | Revoke a token |
| `GET` | `/api/extension/me` | Bearer token | Verify auth, return user info |
| `GET` | `/api/extension/resumes` | Bearer token | List active resumes |
| `GET` | `/api/extension/duplicate-check` | Bearer token | Check for duplicate applications |
| `POST` | `/api/extension/applications` | Bearer token | Create an application |

### Database

Migration 013 adds `extension_tokens`:

```sql
CREATE TABLE extension_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'Extension',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX idx_ext_token_user ON extension_tokens(user_id, revoked_at);
```

No changes to existing tables or migrations.

### Extension Structure

```
extension/
├── manifest.json         # Manifest V3
├── popup.html            # Main popup (capture → save flow)
├── popup.css
├── popup.js
├── options.html          # Configuration (URL + token)
├── options.css
├── options.js
├── background.js         # Service worker (minimal)
├── content.js            # Page content extractor runner
├── api/
│   └── jobquest.js       # API client (auth, duplicate, save, resumes)
├── extractors/
│   ├── index.js          # Orchestrator
│   ├── jsonld.js         # schema.org JobPosting JSON-LD
│   ├── generic.js        # Meta tags + DOM heuristics
│   ├── greenhouse.js     # Greenhouse ATS adapter
│   ├── lever.js          # Lever ATS adapter
│   └── indeed.js         # Indeed adapter
├── fixtures/
│   ├── jsonld_job.html   # Test fixture: JSON-LD job
│   ├── greenhouse_job.html
│   └── no_data_job.html
├── tests/
│   ├── extractor.test.js # Node.js --test unit tests
│   └── api.test.js       # API client unit tests
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md
└── HANDOFF.md
```

### Extraction Priority

```
1. schema.org JobPosting JSON-LD  (highest confidence)
        ↓
2. Site-specific adapter (Greenhouse, Lever, Indeed)
        ↓
3. Page <meta> tags + <title>
        ↓
4. Generic DOM heuristics
        ↓
5. Blank (never fabricate)
```

### Internal Capture Object

```js
{
  jobTitle: "",      // → applications.job_title
  company: "",       // → applications.company
  location: "",      // → applications.location
  workArrangement: "",  // → applications.work_arrangement
  employmentType: "",   // → applications.employment_type
  salaryMin: null,   // → applications.salary_min
  salaryMax: null,   // → applications.salary_max
  salaryCurrency: "",   // → applications.salary_currency
  salaryRange: "",   // → applications.salary_range
  description: "",   // → applications.job_description
  jobUrl: "",        // → applications.job_url
  source: "",        // → applications.source (site name)
}
```

Missing fields remain `""` or `null` — never fabricated.

### Popup UX Flow

```
Open extension
       ↓
Not configured? → Open Options page
       ↓
Auth check (/api/extension/me)
       ↓ (fail) → Show "Not authenticated" + options button
       ↓ (pass)
Extract page content (via content.js)
       ↓
Show editable form (pre-filled from extraction, blank = blank)
       ↓
User reviews/edits fields
       ↓
User selects resume (optional, from dropdown)
       ↓
User clicks "Save to JobQuest"
       ↓
Duplicate check (/api/extension/duplicate-check)
       ↓
Duplicate found?
    YES → Show warning panel:
          - Match level (exact URL / company+title / similar)
          - Existing app details (title, company, stage, date, resume)
          - [Open Existing] [Save Anyway] [Cancel]
    NO  → Save (/api/extension/applications)
          → Show success ✅ + link to JobQuest
```

## Duplicate Detection Rules

**Level 1 — Exact URL match**: Normalize URL (lowercase, strip trailing slash, strip utm params). If normalized URLs match → `⚠ Already saved in JobQuest`.

**Level 2 — Company + title match**: Normalize both (trim, lowercase, collapse whitespace). If both match exactly → `⚠ Possible existing application found`.

No fuzzy/AI matching. No Level 3 in this round.

## Manifest V3 Permissions

```json
{
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": []
}
```

`content_scripts` with `"<all_urls>"` is needed to extract from any job board — the content script only reads page content, never modifies or injects anything. Permissions follow the principle of least privilege.

## Security Considerations

- Extension token: only SHA-256 hash stored server-side; raw token shown once
- All extension endpoints require valid token (403 otherwise)
- Duplicate check and save are scoped to `user_id` from token — IDOR impossible
- `job_url` reuses existing `validateApplication()` validation (http/https only, no javascript:/data:)
- Captured page content is plain text — no executable HTML stored
- Extension never accesses `DATABASE_URL`, Neon, or any credentials
- `chrome.storage.local` stores token + URL — never synced, never logged

## Testing Strategy

### Unit Tests (`extension/tests/`)
- Extractor: JSON-LD fields, Greenhouse DOM, blank fields for missing data
- API client: auth header, duplicate parsing, save payload mapping

### Backend Tests (`backend/test/`)
- Token generation/revocation (new test cases in app.test.js)
- Duplicate check: exact URL, company+title, cross-user isolation
- Extension save: reuses createApplication validation

### Playwright E2E (`extension/tests/`)
- Load extension via `--extension` flag
- Happy path: capture → resume → save
- Duplicate flows: cancel, save anyway
- Missing fields remain blank
- Cross-user authorization

## CI Integration

New `extension-tests` job (no Postgres needed — pure JS):
```yaml
extension-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 24 }
    - run: node --test extension/tests/extractor.test.js extension/tests/api.test.js
```

Playwright extension E2E added to existing `browser-and-visual` job.

## Implementation Status

### Checkpoints

| CP | Status | Description | Commit |
|----|--------|-------------|--------|
| CP0 | ✅ Done | Branch + planning docs | `59cff25` |
| CP1 | ✅ Done | Migration 013 + backend extension module | `bcd8e8e` |
| CP2 | ✅ Done | Frontend settings token manager | `829dd95` |
| CP3 | ✅ Done | Extension skeleton + options page | `c482486` |
| CP4 | ✅ Done | Extractor engine + unit tests | `fd64fd0` |
| CP5 | ✅ Done | Popup core flow | `8f9fccd` |
| CP6 | ✅ Done | Duplicate detection UX | `8f9fccd` |
| CP7 | ✅ Done | Playwright E2E tests | `920c40f` |
| CP8 | ✅ Done | CI integration + extension docs | `920c40f` |
| CP9 | ✅ Done | Review + PR to development (PR #20) | `5415396` |

### Tool / MCP Readiness

| Tool | Available? | Required? | Purpose |
|------|-----------|-----------|---------|
| Git / GitHub | ✅ Yes | Yes | Branch, commits, PR |
| gh CLI | Likely (used in prior rounds) | Yes | PR creation |
| Node.js 24 | ✅ Yes | Yes | Backend + tests |
| Playwright | ✅ Yes | Yes | E2E tests |
| linkedom | ✅ Yes (devDep) | Yes | Extractor unit tests |

## Decisions

- **Auth**: Extension bearer tokens (Option A) — not session cookie reuse
- **Duplicate levels**: URL exact (`EXACT_POSTING`) + Company history (`SAME_ROLE` vs `COMPANY_ONLY`) + `NONE`
- **Resume selection**: Segmented choice supporting existing resume selection, manual version text entry, and none
- **JobRight.ai adapter**: Explicitly deferred to V2.1/V2.2
- **Extension store**: Not publishing; load-unpacked only
- **No new frontend framework**: Vanilla JS, matching rest of project

---

## Pre-Merge Stabilization & Real-World Validation

During local end-to-end validation of PR #20, two real-world defects were discovered, root-caused, and resolved.

### Defect 1: False Duplicate on First Capture
- **Symptom**: On the first capture of a job from a company with no prior application in the database, the extension still displayed a warning banner: `"Existing application found"`.
- **Root Cause**:
  1. In `extension/popup.html`, `#dup-banner` had default static markup: `<span id="dup-heading">Existing application found</span>` with attribute `hidden`.
  2. In `extension/popup.css`, `.banner { display: flex; }` was declared without an author-level `[hidden]` rule. Because class selector `.banner` (specificity 0,1,0) overrides the user agent stylesheet's `[hidden] { display: none; }` (specificity 0,0,0), the banner remained permanently visible on screen regardless of whether `dupBanner.hidden = true` was set.
  3. The duplicate endpoint previously returned an ambiguous boolean (`has_duplicate`) and did not distinguish having previous history at a company for a different role (`COMPANY_ONLY`) from a true duplicate.
- **Resolution**:
  1. Added global `[hidden] { display: none !important; }` and `.banner[hidden] { display: none !important; }` in `extension/popup.css`.
  2. Removed static fallback text from `popup.html`, ensuring banner text is strictly dynamic.
  3. Refactored `/api/extension/duplicate-check` and popup controller into four distinct semantic states:
     - `NONE`: No warning banner, normal save.
     - `COMPANY_ONLY`: Informational banner ("You already have another application at this company"); normal save available without duplicate override; provides "View Existing" link.
     - `SAME_ROLE`: Warning banner with `[Open Existing]`, `[Save Anyway]`, `[Cancel]`.
     - `EXACT_POSTING`: Danger banner with `[Open Existing]`, `[Save Anyway]`, `[Cancel]`.
     - `CHECK_ERROR`: Network/server failure notice; never misclassified as an existing application.
- **Regression Tests**: Added in `backend/test/app.test.js`, `extension/tests/api.test.js`, and `backend/e2e/extension.spec.js`.

### Defect 2: Manual Tailored Resume `resume_id must be a positive integer`
- **Symptom**: When entering a custom tailored resume version or saving without selecting a resume, the application save failed with HTTP 400: `"resume_id must be a positive integer"`.
- **Root Cause**:
  1. In `backend/src/service.js`, `validateApplication()` evaluated `if (data.resume_id !== undefined && data.resume_id !== "")`. When JSON transmitted `resume_id: null`, `Number(null)` coerced to `0`, which failed `0 < 1` and pushed the error.
  2. The popup UI only offered a single `<select>` without an explicit manual entry mode for users wishing to record tailored versions (e.g. `"QA Automation v96"`) without creating a formal resume record in JobQuest.
- **Resolution**:
  1. Updated `backend/src/service.js` to treat `null` and empty string as clean `null` values for `resume_id`, only validating positive integer when a non-null value is provided.
  2. Enhanced `extension/popup.html` and `extension/popup.js` with a 3-mode selector:
     - **Select existing**: maps to `resume_id` integer and `resume_version` text.
     - **Enter manually**: maps to `resume_version` text with `resume_id: null`.
     - **None**: maps to `resume_id: null` and `resume_version: null`.
  3. Added client-side character set and length (&le; 100) validation for manual input.
  4. Added mode-switch cleanup ensuring stale IDs or manual strings are discarded on mode transition.
- **Regression Tests**: Added in `backend/test/app.test.js`, `extension/tests/api.test.js`, and `backend/e2e/extension.spec.js`.

---

## JobRight.ai Support Status

**Explicitly ON HOLD / Deferred to V2.1/V2.2.**

- No JobRight-specific extractors or selectors were implemented in this round.
- No Selenium dependencies were added.
- Dedicated adapter and SPA exploration will be conducted in a subsequent round after inspecting JobRight's rendered DOM and structured metadata.

