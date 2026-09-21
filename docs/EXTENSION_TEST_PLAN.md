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

## Supported Extractors & Status

| Target Source | Status | Strategy |
|---|---|---|
| **schema.org/JobPosting JSON-LD** | ✅ Active | High-fidelity structured JSON-LD parsing |
| **Greenhouse ATS (`greenhouse.io`)** | ✅ Active | Dedicated DOM adapter |
| **Lever ATS (`jobs.lever.co`)** | ✅ Active | Dedicated DOM adapter |
| **Indeed (`indeed.com`)** | ✅ Active | Dedicated DOM adapter |
| **Generic DOM / Meta Fallback** | ✅ Active | OpenGraph, Twitter Cards, `<title>`, heading heuristics |
| **JobRight.ai** | ⏸️ **ON HOLD** | **DEFERRED TO V2.1/V2.2**. Not part of current acceptance criteria. |
