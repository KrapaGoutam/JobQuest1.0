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
- **Duplicate levels**: URL exact + company/title exact — no fuzzy/AI
- **Resume selection**: Free-text `resume_version` populated from `resumes.version_name` + `resume_id` FK; user must explicitly choose, never auto-selected
- **Extension store**: Not publishing; load-unpacked only
- **No new frontend framework**: Vanilla JS, matching rest of project
