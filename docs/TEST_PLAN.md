# Test plan

## What already exists — preserve, don't rebuild

- `node --test`: backend, frontend-logic, integration, e2e suites
  (`npm run test:backend|frontend|integration|e2e`).
- Playwright (`backend/e2e/jobquest.spec.js`): functional, accessibility (axe-core),
  responsive, visual-regression (with committed baselines under `*-snapshots/`).
- GitHub Actions CI (`.github/workflows/ci.yml`): static-quality, tests matrix (real
  Postgres 17 service container), security, sqlite→postgres migration test, and a
  browser+visual job with failure-artifact upload. Runs on every PR to
  `development`/`main`.

Every round below runs the full existing suite unmodified, plus whatever it adds.

## Per-round expectations

| Round | New coverage required |
|---|---|
| 2 (build tooling) | Full visual-regression suite must produce **zero** baseline diffs; a manual smoke pass of every page in dev mode |
| 3 (dashboard/apps redesign) | Unit tests for search/filter/sort/pagination logic; Playwright coverage for state persistence across navigation (draft prompt already lists this); mobile filter usability check |
| 4 (checklist) | Backend tests for per-stage template defaults + completion state; a11y check on any new checklist UI |
| 5 (contacts) | Backend tests for contact–application linking; ownership tests (can't see another user's contacts) |
| 6 (import/export) | Import preview/mapping/duplicate-detection unit tests with malformed/partial-failure fixtures; round-trip JSON backup/restore test |
| 7 (tasks) | Full CRUD + ownership tests; recurring-task logic tests if implemented; application-linking tests |
| 8 (habits) | Streak-calculation unit tests (including timezone/day-boundary edge cases); completion-history tests |
| 9 (journal) | Ownership tests; application-linking tests; no unintended manager visibility (see open question in `docs/SECURITY.md`) |
| 10 (analytics) | Tests asserting metrics are suppressed/caveated below a defined sample-size threshold; funnel math correctness tests |
| 11 (capstone) | Full a11y sweep (axe) across every page; visual regression at desktop/tablet/mobile breakpoints for every page touched in Rounds 3–10 |

## Non-negotiables carried from the existing draft prompt (Round 3)

- Existing features still work; no dashboard widget name/type-ID changes.
- No table column removed.
- Missing dates/salary values must not error.
- No unrelated page redesigned as a side effect.

## Responsive testing

Desktop, tablet, and mobile are each explicitly tested — not just desktop with a
narrower viewport smoke-check. `playwright.config.js` already defines five viewport
projects (`desktop`, `compact-desktop`, `tablet`, `mobile`, `small-mobile`); reuse them
rather than adding a parallel viewport scheme. `test:accessibility` currently runs only
`--project=desktop --project=mobile` — consider adding `--project=tablet` there once a
round introduces tablet-specific layout changes worth checking.
