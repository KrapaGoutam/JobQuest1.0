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
**Checkpoint**: CP0 complete, CP1 in progress.
**Feature doc**: `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`
**Extension handoff**: `extension/HANDOFF.md`

## What just happened (Round 11 CP0 — Antigravity, 2026-09-20)

- `feature/011-jobquest-capture-extension` created off `development` (head `a06c7cf`).
- `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md` written (full feature spec).
- `extension/HANDOFF.md` written (initial state, CP1 pending).
- `tasks/CURRENT_TASK.md` and `brain/PROJECT_STATE.md` updated.
- Note: Codex was given the extension master prompt (`JobQuestExtensionV1.md`)
  but never executed it. Antigravity is implementing from scratch — this is
  correct, not a lost session.

## Next exact action

Implement CP1:
1. Write `backend/jobsearch/migrations/013_extension_tokens.sql`
2. Write `backend/src/extension.js` (7 routes + authenticateExtension helper)
3. Wire `handleExtension` into `backend/src/server.js`
4. Add extension test cases to `backend/test/app.test.js`
5. Run `npm run lint` + `npm run test:backend`
6. Commit: `feat(api): add extension token auth and capture endpoints [CP1]`

## Decisions made this session

- Auth: Extension bearer tokens (`extension_tokens` table, migration 013), NOT
  session cookie reuse. See `docs/FEATURE_UPGRADE_11_BROWSER_EXTENSION.md`.
- Duplicate detection: Level 1 (exact normalized URL) + Level 2 (company+title).
- Resume selection: User must choose explicitly; never auto-inferred.
- Extension store: Load-unpacked only; no Chrome Web Store publication this round.
- No React, no new frontend framework (vanilla JS throughout).
