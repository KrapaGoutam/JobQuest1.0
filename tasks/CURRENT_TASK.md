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
**Checkpoint**: CP6 complete, CP7 in progress.
**Feature doc**: `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`
**Extension handoff**: `extension/HANDOFF.md`

## What just happened (Round 11 CP5 & CP6 — Antigravity, 2026-09-20)

- Implemented `extension/content.js`: dynamic content script runner for active tabs.
- Implemented `extension/popup.html`, `extension/popup.css`, `extension/popup.js`:
  - Loading, unconfigured (with settings shortcut), capture form, and success screens.
  - Live connection & token validation against backend.
  - Active resumes dropdown dynamically populated from `/api/extension/resumes` (empty default, requiring user choice).
  - Pre-fills extracted job details into editable form.
  - Level-1 exact URL and Level-2 company+title duplicate detection banner with real-time field evaluation.
  - Application submission via bearer token to `/api/extension/applications`.
  - Success screen with direct "Open in JobQuest" button.
- Updated `backend/package.json` lint and typecheck scripts to check all extension JavaScript files.
- All 49 backend test cases passing; all 44 frontend unit tests passing; all 6 extension tests passing; all lint/typecheck clean.

## Next exact action

Implement CP7 (Playwright E2E tests):
1. Review existing Playwright tests in `backend/test/` and `playwright.config.js`
2. Add E2E tests for extension token management workflow in settings (generate token, copy, revoke)
3. Add E2E tests validating the capture API flow and duplicate detection
4. Commit: `test(extension): add Playwright E2E tests for extension workflows [CP7]`

## Decisions made this session

- Auth: Extension bearer tokens (`extension_tokens` table, migration 013), NOT
  session cookie reuse. See `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`.
- Duplicate detection: Level 1 (exact normalized URL) + Level 2 (company+title).
- Resume selection: User must choose explicitly; never auto-inferred.
- Extension store: Load-unpacked only; no Chrome Web Store publication this round.
- No React, no new frontend framework (vanilla JS throughout).
