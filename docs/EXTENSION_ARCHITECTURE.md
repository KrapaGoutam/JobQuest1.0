# Extension Architecture — JobQuest Capture (Manifest V3)

## Overview

JobQuest Capture is a Manifest V3 browser extension for Chromium-based browsers (Google Chrome, Microsoft Edge) designed to capture job postings directly from web pages, extract structured details, check for existing application history, link tailored resume versions, and save records into the user's private JobQuest workspace.

---

## Architectural Components

```
┌────────────────────────────────────────────────────────┐
│                   Active Browser Tab                   │
│          (Job board / ATS / Company Career Site)       │
└───────────────────────────┬────────────────────────────┘
                            │ chrome.scripting.executeScript
                            ▼
┌────────────────────────────────────────────────────────┐
│              content.js (Extraction Engine)            │
│  1. JSON-LD (schema.org/JobPosting)                    │
│  2. Site Adapters (Greenhouse, Lever, Indeed)          │
│  3. Page Meta Tags (OG, Twitter Cards, Title)          │
│  4. DOM Heuristics & Fallback                          │
└───────────────────────────┬────────────────────────────┘
                            │ Captured Data Object
                            ▼
┌────────────────────────────────────────────────────────┐
│               Popup UI (extension/popup.html)          │
│  - Screen: Loading / Unconfigured / Capture / Success  │
│  - Duplicate Banner (EXACT_POSTING, SAME_ROLE,         │
│    COMPANY_ONLY, CHECK_ERROR)                          │
│  - Tailored Resume Mode Selector                       │
│    [Select Existing] [Enter Manually] [None]           │
│  - Editable Job Fields Form                            │
└─────────────┬───────────────────────────▲──────────────┘
              │                           │
  checkDuplicate() / createApplication()  │ JSON Responses
              ▼                           │
┌────────────────────────────────────────────────────────┐
│           extension/api/jobquest.js (Client)           │
│  Authorization: Bearer <64-char Extension Token>       │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / HTTP REST API
                            ▼
┌────────────────────────────────────────────────────────┐
│            JobQuest Backend (backend/src/)             │
│  - /api/extension/me (Bearer auth check)               │
│  - /api/extension/resumes (User active resumes)        │
│  - /api/extension/duplicate-check (Company-First logic)│
│  - /api/extension/applications (Save application)      │
│  - /api/extension/tokens (Generate/revoke via session) │
└───────────────────────────┬────────────────────────────┘
                            │ SQL Queries
                            ▼
┌────────────────────────────────────────────────────────┐
│             PostgreSQL (Neon) / SQLite Database        │
│  - extension_tokens (token_hash, user_id, revoked_at)  │
│  - applications (job_url, company, resume_version, ...)│
│  - resumes (id, version_name, target_role, ...)        │
└────────────────────────────────────────────────────────┘
```

---

## Authentication Model

Web browser sessions rely on `HttpOnly; SameSite=Strict` session cookies, which are strictly isolated from cross-origin browser extension contexts. JobQuest Capture uses a dedicated **Bearer Token** architecture:

1. **Token Generation**: In the web UI (Settings &rarr; Browser Extension), the user initiates `POST /api/extension/tokens` (protected by session auth and CSRF token).
2. **Storage & Scoping**:
   - Backend generates a 32-byte cryptographic random token (64 hex characters).
   - Only the SHA-256 hash (`token_hash`) is stored in `extension_tokens`.
   - The raw token is returned **once** to the client UI.
3. **Extension Configuration**:
   - User inputs JobQuest URL and raw token into extension Options.
   - Credentials are stored securely in `chrome.storage.local`.
4. **Request Authorization**:
   - Every API call sends `Authorization: Bearer <raw_token>`.
   - Backend hashes the incoming bearer token and queries `extension_tokens WHERE token_hash = ? AND revoked_at IS NULL`.
   - The user account (`user_id`) is retrieved and scopes all database operations.
   - Token revocation is instant: updating `revoked_at = CURRENT_TIMESTAMP` invalidates future requests.

---

## Company-First Duplicate Classification Pipeline

Duplicate detection models real-world job-search behavior. Rather than collapsing evaluation into a single boolean, the system evaluates five distinct states:

```text
Captured job (URL, company, role)
      │
      ▼
Exact normalized URL match in user's DB?
      ├── YES ──► EXACT_POSTING
      │
      └── NO
            │
            ▼
      Normalize company name
            │
            ▼
      User has existing applications for this company?
            ├── NO  ──► NONE
            │
            └── YES
                  │
                  ▼
            Compare role / title (conservative normalization)
                  │
                  ├── Role matches exactly? ──► SAME_ROLE
                  │
                  └── Role differs?         ──► COMPANY_ONLY
```

### Semantic States

| State | Severity | Semantic Meaning | User Presentation & Actions |
|---|---|---|---|
| `NONE` | None | Brand-new company with no prior applications. | No warning banner. Save is directly available. |
| `COMPANY_ONLY` | Informational | Same company, but a different role/job. This is NOT a duplicate. | Informational banner (`.banner.info`): "You already have another application at this company." Displays existing role vs current role. Standard save available without requiring duplicate override. Provides "View Existing Application" action. |
| `SAME_ROLE` | Warning | Existing application for the same role at this company. | Warning banner (`.banner.warning`): "An application already exists for this role at this company." Shows prior application details (stage, date applied). Actions: `[Open Existing]`, `[Save Anyway]`, `[Cancel]`. |
| `EXACT_POSTING` | Danger | Posting URL matches an existing saved posting. | High-priority danger banner (`.banner.danger`): "This job posting is already in JobQuest." Actions: `[Open Existing]`, `[Save Anyway]`, `[Cancel]`. |
| `CHECK_ERROR` | Warning | Network failure, HTTP 500, invalid auth, or server offline during check. | Non-blocking notice: "Could not check JobQuest for existing applications." Never represents error as an existing application. |

### Normalization Rules

- **URL Normalization (`normalizeJobUrl`)**:
  - Lowercase scheme, host, and path.
  - Strips all `utm_*` marketing and campaign tracking parameters.
  - Sorts remaining query parameters deterministically.
  - Strips trailing slash when no query string is present.
- **Text Normalization (`normalizeText`)**:
  - Trim leading and trailing whitespace.
  - Convert to lowercase.
  - Collapse repeated internal whitespace sequences to a single space.
  - Normalize unicode hyphens/dashes (`\u2010`–`\u2015`) to ASCII hyphen `-`.
  - Normalize curly quotes (`\u2018`, `\u2019`, `\u201C`, `\u201D`) to ASCII `'` and `"`.
  - Preserve alphanumeric characters, symbols (`&`, `/`, `@`), and distinct words.
  - **Conservative rule**: Never auto-collapse seniority ("QA Engineer" vs "Senior QA Engineer" remain distinct) or job variants ("QA Analyst" vs "QA Engineer" remain distinct).

### Result Bounding
- The duplicate check queries user applications ordered by `updated_at DESC, id DESC`.
- Results are bounded to a maximum of **3 most recent matches** to conserve memory and network bandwidth.

---

## Tailored Resume Architecture

JobQuest supports linking applications to resumes in two canonical ways:
1. **Existing Resume (`resume_id`)**: A foreign-key integer reference to an entry in the `resumes` table, carrying a designated `version_name`.
2. **Free-Text Version (`resume_version`)**: A text field (max 100 chars) representing custom or external versions (e.g. `"QA Automation v96"`) without requiring a separate resume entity.

### Mode Switching & Contract

The extension popup provides an explicit segmented control with three modes:

```text
Tailored Resume
(●) Select existing    (○) Enter manually    (○) None
[ Resume v2 (QA Lead) ▼ ]
```

- **Select Existing**:
  - Populates `<select>` from `GET /api/extension/resumes`.
  - Transmits payload: `{ resume_id: 12, resume_version: "Resume v2" }`.
- **Enter Manually**:
  - Exposes `<input type="text" id="input-resume-manual">`.
  - Validates character set and length &le; 100 on client before dispatch.
  - Transmits payload: `{ resume_id: null, resume_version: "QA Automation v96" }`.
  - `resume_id` is explicitly null or omitted—never sent as string or invalid number.
- **None Selected**:
  - Transmits payload: `{ resume_id: null, resume_version: null }`.
- **Mode Switching Safety**:
  - Switching to manual resets and clears any selected `resume_id`.
  - Switching to existing clears any entered manual text.
  - Switching to none clears both.
  - Backend validation in `service.js` handles `resume_id: null` cleanly without error.

---

## Extractor Engine Cascade & Source-Quality Hierarchy

Page extraction runs inside `content.js` and `extension/extractors/` following strict source-quality confidence ranking:

```text
Priority 1: schema.org/JobPosting JSON-LD (highest precision structured data)
    ↓
Priority 2: Verified Site Adapters (Greenhouse, Lever, Indeed)
    ↓
Priority 3: Semantic Rendered Job DOM
            - Scored candidate headings (main h1, article h1, [class*='job'] h1)
            - Proximity to job metadata (location, salary, employment type)
            - Excludes hidden elements, nav, headers, footers, modals, cookie notices
    ↓
Priority 4: Job-Specific Metadata
            - og:title / twitter:title / meta description
            - Subject to Title Sanity Guard (rejects marketing slogans, e.g. "Copilot", and site brands)
    ↓
Priority 5: Low-Confidence Fallbacks
            - document.title (lowest priority, stripped of site suffix)
            - Direct employer hostname brand (only for non-aggregator/non-board sites)
    ↓
Fallback: Blank fields (never fabricate missing information; editable in popup)
```

### Source-Quality Principles

1. **Actual Job Data Outranks Site Branding**:
   - Site-level SEO or marketing metadata (e.g. `"Jobright: Your AI Job Search Copilot"` or `<title>Tensor</title>`) must never overwrite a credible rendered job heading (e.g. `"QA Automation Engineer (SDET) AI-Enhanced Testing"` or `"FPGA Engineer: ISP"`).
2. **Platform / Aggregator vs Hiring Employer**:
   - For job boards and aggregators (`jobright.ai`, `linkedin.com`, `indeed.com`, `greenhouse.io`, etc.), the platform domain is recorded as `source`, while `company` is extracted from the job content itself. Platform branding is never assigned to `company`.
   - For direct employer websites (e.g. `tensor.auto`), the site brand may be used as `company` when no conflicting company name is specified.
3. **Company / Title Cross-Check**:
   - If a proposed job title is identical to the extracted company name (e.g. `jobTitle === "Tensor"` and `company === "Tensor"`), the title is replaced by the semantic role heading.
4. **Multiple Locations**:
   - When multiple locations are listed (e.g. Tensor's four locations), they are preserved cleanly in a semicolon-delimited string (`"San Jose, California, US; Singapore; Dubai, UAE; Barcelona, Spain"`) rather than picking one arbitrarily.
5. **No Speculation**:
   - If a field (salary, arrangement, location) is not explicitly present, it remains null/blank. Missing values are filled by the user in the popup.

