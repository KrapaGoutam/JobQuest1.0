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
**Checkpoint**: CP1 complete, CP2 in progress.
**Feature doc**: `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`
**Extension handoff**: `extension/HANDOFF.md`

## What just happened (Round 11 CP1 — Antigravity, 2026-09-20)

- Wrote `backend/jobsearch/migrations/013_extension_tokens.sql`.
- Wrote `backend/src/extension.js` (7 routes + bearer-token authentication helper).
- Wired `handleExtension` in `backend/src/server.js`.
- Added 16 comprehensive extension test cases to `backend/test/app.test.js`.
- All 49 backend test cases passing (100% green). Lint and typecheck clean.

## Next exact action

Implement CP2 (Frontend settings token manager):
1. Locate Settings view in `frontend/index.html` and `frontend/src/`
2. Add "Browser Extension" token management section in Settings
3. Implement token list, generate token modal (displaying raw token once with Copy), and revoke token action
4. Verify token creation/revocation UI and integration
5. Commit: `feat(settings): add extension token management UI [CP2]`

## Decisions made this session

- Auth: Extension bearer tokens (`extension_tokens` table, migration 013), NOT
  session cookie reuse. See `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`.
- Duplicate detection: Level 1 (exact normalized URL) + Level 2 (company+title).
- Resume selection: User must choose explicitly; never auto-inferred.
- Extension store: Load-unpacked only; no Chrome Web Store publication this round.
- No React, no new frontend framework (vanilla JS throughout).
