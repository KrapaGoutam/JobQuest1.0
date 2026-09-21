# Extension Test Plan — JobQuest Capture (Round 11 Stabilization)

## Overview

This test plan defines the complete validation suite for the JobQuest Capture Manifest V3 browser extension across unit, integration, end-to-end, and manual validation tiers.

---

## Realistic Test Matrix (34 Scenarios)

| # | Scenario | Layer | Input State | Expected Outcome |
|---|---|---|---|---|
| **1** | **Brand-New Company** | Backend / UI | No application in database for Company A. | `match_type: "none"`, `has_duplicate: false`, `matches: []`. No warning banner in UI. Direct save available. |
| **2** | **Same Company, Different Role** | Backend / UI | Existing: Company A / Software Developer. Captured: Company A / QA Engineer. | `match_type: "company_only"`, `has_duplicate: false`. Informational banner: "You already have another application at this company." Shows prior role vs current role. Normal save enabled without override. View Existing link provided. |
| **3** | **Same Company, Same Role** | Backend / UI | Existing: Company A / QA Engineer. Captured: Company A / QA Engineer. | `match_type: "same_role"`, `has_duplicate: true`. Warning banner: "An application already exists for this role at this company." Actions: Open Existing, Save Anyway, Cancel. |
| **4** | **Exact Posting URL** | Backend / UI | Existing: `https://example.com/jobs/123`. Captured: `https://example.com/jobs/123?utm_medium=email`. | `match_type: "exact_posting"`, `has_duplicate: true`. Danger banner: "This job posting is already in JobQuest." Actions: Open Existing, Save Anyway, Cancel. |
| **5** | **Empty Match Array** | UI | API returns `{ match_type: "none", matches: [] }`. | No banner shown. Guard against truthy array evaluations. |
| **6** | **API Error (HTTP 500)** | UI | Duplicate API returns 500 Internal Server Error. | Non-blocking notice: "Could not check JobQuest for existing applications." Never shows "Existing application found". |
| **7** | **Network Failure / Offline** | UI | Backend server unreachable / network dropped. | Clear check-error notice. Duplicate warning never triggered. Normal form actions remain functional. |
| **8** | **Unauthorized Token** | Backend / UI | Invalid or expired bearer token. | HTTP 401. UI redirects to Setup/Authentication screen. |
| **9** | **Cross-User Isolation** | Backend | User A has Company A / QA Engineer. User B captures same job. | User B duplicate check returns `match_type: "none"`. No leakage of User A records across user_id boundaries. |
| **10** | **Missing Company** | Backend / UI | Captured role and description; company field empty. | `match_type: "none"` unless exact URL match exists. User can edit company field manually. |
| **11** | **Missing Title** | Backend / UI | Company populated; title field empty. | Shows `COMPANY_ONLY` if company exists in DB; never classifies as `SAME_ROLE`. |
| **12** | **Missing URL** | Backend / UI | Job URL blank; company and title populated. | Detects `SAME_ROLE` and `COMPANY_ONLY` cleanly without requiring a URL. |
| **13** | **Multiple Applications at Same Company** | Backend / UI | Existing: Company A / Roles 1, 2, 3. Captured: Company A / Role 4. | Returns `COMPANY_ONLY` with matches bounded to top 3 recent records. |
| **14** | **Multiple Same-Role Applications** | Backend / UI | Existing: Company A / QA Engineer (Applied & Interview). Captured: Company A / QA Engineer. | Returns `SAME_ROLE` with matches bounded to top 3 recent records. |
| **15** | **Case and Whitespace Invariance** | Backend / Unit | Existing: `ABC TECHNOLOGIES`. Captured: `  abc technologies  `. | Matches identical normalized company. |
| **16** | **Similar but Distinct Companies** | Backend / Unit | Existing: `ABC Technologies`. Captured: `ABC Consulting`. | Evaluated as distinct companies; returns `NONE`. |
| **17** | **Title Seniority Distinction** | Backend / Unit | Existing: `QA Engineer`. Captured: `Senior QA Engineer`. | Distinct roles. Evaluates to `COMPANY_ONLY`, not `SAME_ROLE`. |
| **18** | **Popup Stale State Reset** | UI | User captures duplicate, closes popup, opens on new job page. | All previous duplicate banners, messages, and action buttons are cleanly cleared. |
| **19** | **Extension Reload** | UI | Unpacked extension reloaded in `chrome://extensions`. | Stored settings persist; transient capture state initializes clean. |
| **20** | **Consecutive Captures** | UI | User captures Job 1, clicks "Capture Another", captures Job 2. | Job 2 starts with fresh state; no leakage of Job 1 inputs or warnings. |
| **21** | **Existing Resume Selection** | Backend / UI | User selects resume from dropdown. | Sends numeric `resume_id` and resume `version_name`. Saved with valid foreign key. |
| **22** | **Manual Resume Entry** | Backend / UI | User types "QA Automation v96". | Sends `resume_version: "QA Automation v96"` and `resume_id: null`. Saves successfully without "positive integer" error. |
| **23** | **Switch Existing &rarr; Manual** | UI | User picks resume, switches mode to manual, types custom text. | Selected `resume_id` is discarded; only manual `resume_version` transmitted. |
| **24** | **Switch Manual &rarr; Existing** | UI | User types manual version, switches mode to existing, selects resume. | Manual text is cleared; selected resume ID and version transmitted. |
| **25** | **Blank / None Resume Selection** | Backend / UI | User selects "None" mode. | Transmits `resume_id: null` and `resume_version: null`. Saves cleanly. |
| **26** | **Invalid Resume ID Guard** | Backend / UI | Payload with `0`, `-1`, `"text"`, or `""`. | Backend rejects invalid IDs if provided; normal UI never sends invalid values. |
| **27** | **Partial Page Capture** | Extractor / UI | Page has title and company, but no salary or location. | Missing fields left blank / null; never fabricated. |
| **28** | **Long Job Description** | Extractor / UI | 10,000+ character job description. | Captured cleanly; no UI freezing; HTML entities safely escaped. |
| **29** | **Special Characters & Symbols** | Backend / Unit | Company: "AT&T", "Johnson & Johnson", "H&M". Title: "QA — Platform". | Safe deterministic normalization preserves special characters and standardizes dashes. |
| **30** | **Duplicate Cancel** | UI | Duplicate detected; user clicks Cancel. | Popup closes or resets. Zero applications inserted. |
| **31** | **Save Anyway** | UI | Duplicate detected; user clicks Save Anyway. | Application saved with full validation intact. |
| **32** | **Duplicate Concurrency / Race** | Backend | Two identical save calls executed in rapid succession. | Both applications saved safely (no crash); duplicate warning is advisory, not a DB constraint. |
| **33** | **Local Server Restart** | UI | JobQuest server restarted while extension is active. | Extension reconnects cleanly on next action without stale crash state. |
| **34** | **Fresh Controlled Database** | Backend / E2E | Tests run against isolated test databases. | Deterministic test setup and teardown without impacting user local data. |

---

## Real-World Local Validation Checklist

To validate JobQuest Capture in real-world local conditions, execute this manual checklist:

```markdown
### Real-World Local Validation Checklist

- [ ] 1. Brand-new company / brand-new role: verify no duplicate banner displays.
- [ ] 2. Existing company / different role: verify informational "COMPANY_ONLY" banner appears without blocking normal save.
- [ ] 3. Existing company / same role: verify warning "SAME_ROLE" banner appears with [Open Existing], [Save Anyway], and [Cancel].
- [ ] 4. Exact same posting URL: verify danger "EXACT_POSTING" banner appears.
- [ ] 5. Empty match response: verify `#dup-banner` remains completely hidden.
- [ ] 6. Duplicate API unavailable: stop server, verify non-blocking check notice appears (no false duplicate).
- [ ] 7. Invalid token: enter bad token in Options, verify auth failure message.
- [ ] 8. Revoked token: revoke token in Settings, verify 401 error displayed.
- [ ] 9. Extension reload: reload unpacked extension, verify options persist and state is clean.
- [ ] 10. Consecutive captures: capture Job A, click "Capture Another", capture Job B; verify Job A data is not carried over.
- [ ] 11. Missing company: capture job with no company; verify manual company entry works.
- [ ] 12. Missing title: verify role is not classified as duplicate.
- [ ] 13. Missing optional fields (salary, location, source): verify fields remain empty, not fabricated.
- [ ] 14. Existing tailored resume: pick from dropdown; verify application saves with resume linked in JobQuest.
- [ ] 15. Manual tailored resume: type "QA Automation v96"; verify application saves cleanly with NO positive-integer error.
- [ ] 16. Switch existing → manual: verify selected ID is discarded and manual text is used.
- [ ] 17. Switch manual → existing: verify manual text is cleared and selected ID is used.
- [ ] 18. Duplicate Cancel: click Cancel; verify no row added to JobQuest.
- [ ] 19. Duplicate Save Anyway: click Save Anyway; verify application is created.
- [ ] 20. Restart local JobQuest server: verify extension reconnects smoothly.
```

---

## Generic Career Page Extraction Validation

Non-standard employer career portals and job aggregator sites often lack structured JSON-LD schemas or present marketing slogans in `<title>` and OpenGraph tags. The hardened generic extraction pipeline enforces a strict source-quality hierarchy: high-confidence semantic DOM headings outrank site-level metadata.

### Generic Extraction Test Matrix

| # | Scenario | Test Input / Condition | Expected Extraction Behavior |
|---|---|---|---|
| **G1** | **Employer Career Portal (`tensor.auto`)** | `<title>Tensor</title>`, `<h1>FPGA Engineer: ISP</h1>`, 4 locations | Title: `"FPGA Engineer: ISP"`, Company: `"Tensor"` (derived from non-aggregator domain), Locations: 4 items joined by `"; "`. |
| **G2** | **Job Aggregator (`jobright.ai`)** | `og:title="Jobright: Your AI Job Search Copilot"`, `og:site_name="Jobright AI"`, rendered DOM `<h1>QA Automation Engineer...</h1>`, company badge `"GetInsured"`, `$120K/yr - $140K/yr` | Title: `"QA Automation Engineer..."` (marketing slogan rejected), Company: `"GetInsured"` (aggregator brand rejected), Salary: `"$120K/yr - $140K/yr"`, Workplace: `"Onsite"`. |
| **G3** | **Marketing Slogan Rejection** | `<title>Acme: The #1 Platform for Hiring</title>`, `<h1>Staff Engineer</h1>` | Slogan rejected via `isGenericTitle()`. DOM `<h1>` selected as title: `"Staff Engineer"`. |
| **G4** | **Site Branding vs Employer Separation** | Page on `myaggregatorsite.com/jobs/456` with employer name in DOM badge `"FinTech Corp"` | Aggregator domain recognized via `AGGREGATOR_AND_BOARD_DOMAINS`. Company set to `"FinTech Corp"`, never `"Myaggregatorsite"`. |
| **G5** | **Direct Employer Brand Attribution** | Page on direct employer site `https://tensor.auto/careers/role` with no explicit company tag | Direct employer domain clean name `"Tensor"` used as fallback company. |
| **G6** | **Multiple Location Handling** | Role with multiple locations across distinct tags or list items | All locations preserved and formatted with delimiter (e.g. `"San Jose, CA; Austin, TX; London, UK"`). |
| **G7** | **Work Arrangement Fallback** | Workplace tag missing, but location tag contains `"Remote"` or `"Hybrid"` | Workplace arrangement correctly inferred (`"Remote"` or `"Hybrid"`) from location text. |
| **G8** | **Salary Period Suffix Parsing** | Salary range formatted with dual suffixes: `"$120K/yr - $140K/yr"` or `"$60/hr - $75/hr"` | Full range preserved without truncation or suffix corruption. |
| **G9** | **Title / Company Collision Check** | Title extracted from `<title>` equals Company name (e.g. both `"Tensor"`) | Collision detected; title replaced by dominant role heading from rendered DOM. |

### Generic Career Page Manual Checklist

```markdown
### Generic Career Page Extraction Checklist
- [ ] 1. Non-standard career page title resolution: verify role heading is extracted instead of `<title>` when title contains only company name.
- [ ] 2. Non-standard career page company resolution: verify company is extracted from employer domain or DOM badge, not left blank.
- [ ] 3. Marketing slogan rejection: verify phrases like "Copilot", "AI Job Search", "Search Jobs" in metadata are rejected in favor of DOM heading.
- [ ] 4. Site branding vs. employer separation: verify aggregator branding is NEVER saved as employer company name on aggregator listings.
- [ ] 5. Multiple location handling: verify multi-office or remote+onsite options are captured as semicolon-separated list.
- [ ] 6. Work arrangement fallback: verify "Remote" / "Hybrid" inside location chips is properly mapped to work arrangement field.
- [ ] 7. Salary period suffix parsing: verify salaries with dual suffixes ($120K/yr - $140K/yr) capture cleanly.
- [ ] 8. Aggregator vs. employer career page behavior: verify employer sites attribute domain brand while aggregators require DOM employer badge.
- [ ] 9. JobRight-specific adapter remains deferred: verify JobRight pages are parsed using generic fallback without hardcoded adapters or rules.
```

---

## Supported Extractors & Status

| Target Source | Status | Strategy |
|---|---|---|
| **schema.org/JobPosting JSON-LD** | ✅ Active | High-fidelity structured JSON-LD parsing |
| **Greenhouse ATS (`greenhouse.io`)** | ✅ Active | Dedicated DOM adapter |
| **Lever ATS (`jobs.lever.co`)** | ✅ Active | Dedicated DOM adapter |
| **Indeed (`indeed.com`)** | ✅ Active | Dedicated DOM adapter |
| **Generic DOM / Meta Fallback** | ✅ Active | Hardened source-quality hierarchy: semantic DOM heading outranks metadata slogans; aggregator vs employer domain separation; dual-suffix salary parser |
| **JobRight.ai** | ⏸️ **ON HOLD** | **DEFERRED TO V2.1/V2.2**. Parsed via hardened generic extractor fallback without site-specific adapter. |

---

## Canonical Stage Alignment & Open Existing Deep-Link Test Plan

### Canonical Stage Test Matrix

| # | Scenario | Test Input / Condition | Expected Behavior |
|---|---|---|---|
| **S1** | **Canonical Stage Parity** | `GET /api/extension/stages` | Returns all 13 canonical JobQuest `STAGES` matching `backend/src/service.js`. Default is `"Applied"`. First stage is `"Saved"`. |
| **S2** | **Bookmarked Stage Regression** | Extension options or forged API input with `stage: "Bookmarked"` | Normal UI no longer offers `"Bookmarked"`. Direct API submission returns HTTP 400 with `Unsupported stage: Bookmarked`. |
| **S3** | **Pre-Application Bookmark Capture** | User selects `"Saved"` in popup and submits | Backend accepts `"Saved"`, saves application with `stage: "Saved"` (201 Created). |
| **S4** | **Every Supported Stage** | Loop testing all 13 canonical stages | Every canonical stage succeeds with 201 Created. |
| **S5** | **Workflow Action Mapping** | Workflow action items `{ label, value }` | Every label maps to a valid, supported canonical stage value. |
| **S6** | **Arbitrary Stage Forgery** | `POST /api/extension/applications` with `{ stage: "InvalidStage" }` | Backend rejects with HTTP 400 `Unsupported stage: InvalidStage`. |
| **S7** | **Stage Loading Failure Guard** | Unreachable server or invalid token during stage fetch | Popup displays error notice and disables save button rather than falling back to unvalidated stages. |

### Open Existing Deep-Link Test Matrix

| # | Scenario | Test Input / Condition | Expected Behavior |
|---|---|---|---|
| **D1** | **Exact Duplicate Navigation** | Duplicate check returns `EXACT_POSTING` with matched `application.id = 123`. User clicks `Open Existing`. | Browser opens `http://localhost:3000/?application=123`. Application #123 detail view is displayed. Dashboard is NOT the terminal destination. |
| **D2** | **Same-Role Duplicate Navigation** | Duplicate check returns `SAME_ROLE` with matched `application.id = 234`. User clicks `Open Existing`. | Browser opens `http://localhost:3000/?application=234`. Application #234 detail view is displayed. |
| **D3** | **Company-Only History Navigation** | Duplicate check returns `COMPANY_ONLY` with prior application `id = 345`. User clicks `View Existing Application`. | Browser opens `http://localhost:3000/?application=345`. Prior application #345 detail view is displayed. |
| **D4** | **Unauthenticated Deep-Link** | User opens `/?application=123` in logged-out session. | JobQuest shows auth form (`#auth-form`). After PIN login, user is immediately routed to application #123 detail view. |
| **D5** | **Deleted / Non-Existent Target** | User opens `/?application=999999` (deleted or invalid ID). | App does not crash. Navigates gracefully to Applications view and displays toast: `"Application could not be found."`. |
| **D6** | **Open-Redirect Prevention** | Crafted path: `//evil.com` or `javascript:...` | `buildSecureJobQuestUrl` rejects navigation outside configured JobQuest origin. |
| **D7** | **Configured Origin Preserved** | Custom instance URL: `https://my-jobquest.example.com` | Navigation is strictly bound to `https://my-jobquest.example.com/?application=123`. No localhost hardcoding. |

### Test Plan Checklist

```markdown
- [x] Every extension Stage option is backend-supported
- [x] Bookmarked unsupported-stage regression
- [x] Workflow label -> canonical value mapping
- [x] Invalid stage still rejected by backend
- [x] Exact duplicate -> Open Existing
- [x] Correct application ID opened
- [x] Same-role duplicate -> correct application opened
- [x] Company-only history -> correct prior application opened
- [x] Missing target ID handled safely
- [x] Deleted target handled with Applications fallback and toast
- [x] Different configured JobQuest origin preserved
- [x] Open redirect prevented
- [x] Authentication preserved through login
- [x] Dashboard is not final destination when target exists
```
