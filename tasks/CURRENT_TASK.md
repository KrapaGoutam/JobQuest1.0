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
**Checkpoint**: CP4 complete, CP5 in progress.
**Feature doc**: `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`
**Extension handoff**: `extension/HANDOFF.md`

## What just happened (Round 11 CP4 — Antigravity, 2026-09-20)

- Implemented 5-tier extraction engine:
  - `extension/extractors/jsonld.js`: parses schema.org JobPosting structures, salary, telecommute/work arrangement, employment type, location.
  - `extension/extractors/greenhouse.js`: parses Greenhouse ATS boards and URL path heuristics.
  - `extension/extractors/lever.js`: parses Lever ATS boards, workplace types, and commitment.
  - `extension/extractors/indeed.js`: parses Indeed job headers, company cards, and salary snippets.
  - `extension/extractors/generic.js`: parses OpenGraph, Twitter Cards, document.title patterns, and DOM heuristics.
  - `extension/extractors/index.js`: orchestrates cascade without fabricating missing fields.
- Created test fixtures in `extension/fixtures/` and unit test suite in `extension/tests/`.
- All 6 extension unit tests passing; all 49 backend test cases passing; all lint/typecheck clean.

## Next exact action

Implement CP5 (Popup core flow):
1. Create `extension/content.js` (extracts page data via orchestrator and responds to popup request)
2. Create `extension/popup.html`, `extension/popup.css`, and `extension/popup.js`:
   - Connection/auth verification with graceful setup screen
   - Extraction execution on active tab
   - Form fields pre-filled from extraction with full inline editing capability
   - Dynamic active resumes dropdown loaded via `GET /api/extension/resumes` (empty by default, requires explicit user choice)
   - Application save (`POST /api/extension/applications`)
   - Success state with direct link to view application in JobQuest workspace
3. Commit: `feat(extension): implement capture popup and content extraction flow [CP5]`

## Decisions made this session

- Auth: Extension bearer tokens (`extension_tokens` table, migration 013), NOT
  session cookie reuse. See `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`.
- Duplicate detection: Level 1 (exact normalized URL) + Level 2 (company+title).
- Resume selection: User must choose explicitly; never auto-inferred.
- Extension store: Load-unpacked only; no Chrome Web Store publication this round.
- No React, no new frontend framework (vanilla JS throughout).
