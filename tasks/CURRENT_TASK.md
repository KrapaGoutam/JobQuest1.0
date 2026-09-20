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

# Round 11 — Browser Capture Extension (ACTIVE)

**Branch**: `feature/011-jobquest-capture-extension` (off `development`)
**Checkpoint**: CP3 complete, CP4 in progress.
**Feature doc**: `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`
**Extension handoff**: `extension/HANDOFF.md`

## What just happened (Round 11 CP3 — Antigravity, 2026-09-20)

- Created `extension/manifest.json` (Manifest V3, permissions: storage, activeTab, scripting, tabs).
- Generated real PNG brand icons (`extension/icons/icon16.png`, `icon48.png`, `icon128.png`).
- Created `extension/background.js` (minimal service worker opening options on install).
- Created `extension/api/jobquest.js` (API client for settings, connection test, resumes, duplicate check, and application creation).
- Created `extension/options.html`, `extension/options.css`, and `extension/options.js` (configuration UI, connection testing, storage persistence).
- Syntax-checked all extension scripts with `node --check`.

## Next exact action

Implement CP4 (Extractor engine + unit tests):
1. Create `extension/extractors/jsonld.js` (schema.org JobPosting parser)
2. Create `extension/extractors/greenhouse.js` (Greenhouse ATS parser)
3. Create `extension/extractors/lever.js` (Lever ATS parser)
4. Create `extension/extractors/indeed.js` (Indeed parser)
5. Create `extension/extractors/generic.js` (meta tags og/twitter, title heuristics, DOM headings)
6. Create `extension/extractors/index.js` (orchestrator with priority cascade)
7. Create test fixtures in `extension/fixtures/` and unit tests in `extension/tests/extractor.test.js`
8. Run and pass extractor tests with `node --test`
9. Commit: `feat(extension): implement multi-tier job posting extractor engine [CP4]`

## Decisions made this session

- Auth: Extension bearer tokens (`extension_tokens` table, migration 013), NOT
  session cookie reuse. See `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`.
- Duplicate detection: Level 1 (exact normalized URL) + Level 2 (company+title).
- Resume selection: User must choose explicitly; never auto-inferred.
- Extension store: Load-unpacked only; no Chrome Web Store publication this round.
- No React, no new frontend framework (vanilla JS throughout).
