# Current task

**Status: Round 2 implemented, awaiting PR/CI/merge.** See
[docs/FEATURE_UPGRADE_2.md](../docs/FEATURE_UPGRADE_2.md) for full detail.

Branch: `feature/002-frontend-build-tooling`, based on latest `development`
(which now includes the merged planning-foundation docs, PR #8).

## What just happened

1. Planning-foundation PR #8 merged into `development` (squash), after fixing a
   self-inflicted CI failure (`docs/SECURITY.md` accidentally tripped the repo's own
   secret-pattern grep gate by quoting it verbatim — fixed).
2. Round 2 implemented: Vite build tooling for the vanilla-JS frontend. Files moved to
   `frontend/src/` + `frontend/public/fonts/`; backend now serves `frontend/dist`;
   `render.yaml`, CI, and the one test file with direct frontend-path imports all
   updated. No React, no HMR dev server (deliberate — see the feature doc).
3. Locally verified: lint/typecheck/build/test:frontend pass, `npm audit` clean in both
   `backend/` and `frontend/`, and a cold `npm start` correctly builds and serves the
   frontend end-to-end with unchanged CSP headers.

## Next safe action

Push `feature/002-frontend-build-tooling`, open a PR into `development`, and get the
full CI matrix green — **especially `browser-and-visual`/Playwright with zero
visual-regression baseline diffs**, since that's the real proof this round didn't
change any observable behavior. Do not merge to `main`. Do not start Round 3
(`Feature_Upgrade_2_Codex_Prompt.md`'s dashboard/applications work) until this is merged
and the user has explicitly said to proceed — see the stop condition in the round's
implementation instructions.
