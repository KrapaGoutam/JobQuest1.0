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
**Checkpoint**: CP2 complete, CP3 in progress.
**Feature doc**: `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`
**Extension handoff**: `extension/HANDOFF.md`

## What just happened (Round 11 CP2 — Antigravity, 2026-09-20)

- Added Browser Extension token management section to Settings in `frontend/src/app.js`.
- Implemented token generation with label, displaying raw token once in warning banner with copy button.
- Implemented active tokens listing (label, created_at, last_used_at) with Revoke button.
- Added "Browser Extension" button in Settings tabs for quick navigation.
- Verified frontend build with Vite (0 errors), backend lint/typecheck, and 44 frontend unit tests.

## Next exact action

Implement CP3 (Extension skeleton + options page):
1. Create `extension/` directory structure with `manifest.json` (MV3)
2. Create icons (`extension/icons/icon16.png`, `icon48.png`, `icon128.png`)
3. Create `extension/options.html`, `extension/options.js`, and `extension/options.css`
4. Implement connection testing (`GET /api/extension/me`) and settings persistence (`chrome.storage.local`)
5. Create minimal `extension/background.js` (service worker)
6. Commit: `feat(extension): add MV3 manifest, options page, and storage layer [CP3]`

## Decisions made this session

- Auth: Extension bearer tokens (`extension_tokens` table, migration 013), NOT
  session cookie reuse. See `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`.
- Duplicate detection: Level 1 (exact normalized URL) + Level 2 (company+title).
- Resume selection: User must choose explicitly; never auto-inferred.
- Extension store: Load-unpacked only; no Chrome Web Store publication this round.
- No React, no new frontend framework (vanilla JS throughout).
