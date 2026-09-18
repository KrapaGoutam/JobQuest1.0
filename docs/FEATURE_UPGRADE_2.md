# Feature Upgrade 2 — Frontend Build Tooling

**Status**: implemented on `feature/002-frontend-build-tooling`; PR #9 open into
`development`, full CI matrix green, awaiting the user's review/merge. Round 2 of
[docs/PRD.md](PRD.md) — see that document for the roadmap this fits into. Not yet
deployed to Render/production.

## Goal

Introduce a real build step (Vite) for the frontend without migrating to React and
without changing any observable product behavior. This is infra-only groundwork so the
already-spec'd Dashboard/Applications redesign (next round, `Feature_Upgrade_2_Codex_Prompt.md`)
and everything after it builds on package-managed dependencies, bundling, and cleaner
module boundaries instead of growing a single unbundled file further.

## Existing behavior (before this round)

- `frontend/` was five plain JS files (`app.js`, `application-table.js`,
  `application-preview.js`, `dashboard-config.js`, `icons.js`, `ui-utils.js`), one CSS
  file, and a `fonts/` folder, served byte-for-byte as-is by
  `backend/src/server.js` from `join(here, "..", "..", "frontend")`.
- `frontend/index.html` already loaded `app.js` as a native ES module
  (`<script type="module">`), and all the other files were already plain ES modules
  imported via relative `import`/`export` — there was no script-order dependency, no
  custom `window` globals, and no bundler-shaped rewrite needed. This significantly
  de-risked the migration.
- No `frontend/package.json`, no lockfile, no `node_modules` for the frontend.
- CSS referenced fonts via absolute `/fonts/*.woff2` URLs.

## Requirements

1. Add a build step producing a `dist/` output the backend can keep serving with its
   existing static-file logic and CSP, unchanged.
2. No React/Radix/shadcn/Tailwind/Framer Motion.
3. No visual or functional regression — same CSP, same routes, same auth/session
   behavior, same asset URLs where they're depended on (fonts).
4. Update every place that referenced the old flat `frontend/*.js` layout: backend
   static serving, backend's own lint/typecheck/build scripts, the one test file that
   imports frontend source directly, Render's build command, and CI.
5. Keep it minimal — no feature-folder refactor, no CSS tokenization, no HMR dev server.

## Design / architecture

- **Vite as a build tool, not a dev server.** The backend serves the page and owns the
  CSP (`script-src 'self'; style-src 'self'`, no `unsafe-inline`/`unsafe-eval`). Running
  Vite's own dev server would put the page on a second origin and require either a
  proxy for `/api/*` or CORS changes — both are unnecessary surface area and risk to
  auth/cookie behavior for what this round needs. `vite build --watch` gives a
  rebuild-on-save loop without any of that. This is a deliberate, documented trade-off:
  **no HMR** in this round. Revisit only if iteration speed genuinely becomes a problem.
- **Layout**: `frontend/src/**` (all six JS files + `styles.css`, moved verbatim, no
  internal changes) → `vite build` → `frontend/dist/**`. `frontend/public/fonts/**`
  copied through untouched (Vite's `publicDir`), preserving the exact `/fonts/*.woff2`
  URLs already baked into the CSS.
- `frontend/index.html` stays at the frontend project root (Vite's convention); only its
  two asset references were repointed at `/src/...` so Vite's HTML transform picks them
  up as the module/CSS entry points.
- `backend/src/server.js`'s `frontendDir` now points at `frontend/dist` instead of
  `frontend/` — so only the build output is ever web-servable, never `src/`,
  `node_modules/`, or `package.json`.
- No feature-folder (`features/`, `components/`, `api/`) restructuring in this round —
  deferred to when a later round actually touches that code (see
  [docs/ARCHITECTURE.md](ARCHITECTURE.md) "target direction"). No CSS token extraction
  either — `styles.css` moved unchanged; deferred to the Round 11 capstone pass to avoid
  visual-regression risk for no product benefit right now.
- **Render**: `render.yaml`'s `buildCommand` changed from `npm ci` to
  `npm ci && npm run build:frontend` (new backend script:
  `npm ci --prefix ../frontend && npm run build --prefix ../frontend`). This runs once
  during Render's build phase, producing `frontend/dist` before `npm start` ever runs.
- **Deliberately no `prestart` hook.** Render re-runs `startCommand` (not `buildCommand`)
  on every process restart, including crash-restarts — the exact scenario the recent
  Neon-pool fix (`481c00b`) exists to survive gracefully. Making `npm start` rebuild the
  frontend on every restart would add a network dependency (npm registry reachability)
  to that restart path for no benefit, since the build phase already guarantees
  `frontend/dist` exists. Local `npm run dev` keeps a `predev` hook (one-shot, manually
  invoked, not a crash-restart path, so the same risk doesn't apply).

## Tasks (completed)

- [x] `git mv` the six JS files + `styles.css` into `frontend/src/`, fonts into
      `frontend/public/fonts/`.
- [x] Update `frontend/index.html` asset references.
- [x] Add `frontend/package.json` + `frontend/vite.config.js`; install; verify build.
- [x] Point `backend/src/server.js`'s `frontendDir` at `frontend/dist`.
- [x] Update `backend/package.json`: new `build:frontend` script; `lint`/`typecheck`/
      `build` paths updated to `frontend/src/...`; `test:browser`/`test:accessibility`/
      `test:visual`/`test:visual:update` now build the frontend first; `predev` added;
      no `prestart` (see rationale above).
- [x] Update `backend/test/frontend.test.js` import/read paths to `frontend/src/...`.
- [x] Update `render.yaml` `buildCommand`.
- [x] Update `.github/workflows/ci.yml`: explicit Vite build step in `static-quality`
      (fast-fail before the longer browser job), a frontend `npm audit` step in
      `security`, and `frontend/package-lock.json` added to the npm cache paths.
- [x] Update `README.md`'s stack summary, run-locally steps, and commands table.
- [x] Manual smoke test: cold `npm start` (no pre-existing `dist`/`node_modules`)
      correctly built the frontend via the build phase equivalent and served
      index.html, the hashed JS/CSS bundle, and a font file, all with the unchanged CSP
      header; `/api/health` unaffected.

## Acceptance criteria

- [x] `npm run build:frontend` produces a working `frontend/dist` from a clean checkout.
- [x] Backend serves the built output with identical CSP headers and content-types.
- [x] Font URLs referenced from CSS are unchanged (`/fonts/*.woff2`).
- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:frontend` pass
      locally against the new layout.
- [x] `npm audit --audit-level=high` clean for the new frontend dependency (Vite).
- [x] Full CI matrix green on the PR (backend/frontend/integration/e2e tests,
      sqlite-postgres-migration, security, static-quality including the new Vite build
      step, and browser-and-visual/Playwright with **zero** visual-regression baseline
      diffs: 13 passed / 7 skipped / 0 failed — identical to the pre-Round-2 baseline
      run on PR #8). See CI status below.
- [ ] Render deploy of this branch's equivalent build succeeds — not performed (would
      require deploying to protected infrastructure); CI's `browser-and-visual` job
      exercising a full `node src/server.js` boot against the built output is the
      closest available proxy short of an actual Render deploy.

## Tests

Ran locally (no local Postgres available, so DB-backed suites are validated via CI —
same pattern used for the planning-foundation PR):

- `npm run lint`, `npm run typecheck`, `npm run build` — pass.
- `npm run test:frontend` (9 tests, linkedom-based) — pass, unchanged.
- `npm audit --audit-level=high` in both `backend/` and `frontend/` — clean.
- Manual smoke test of `npm start` end-to-end (see Tasks).

Deferred to CI on this branch's PR (Postgres-backed / browser-based, matching this
repo's existing pattern of validating those in GitHub Actions rather than locally):
`test:backend`, `test:integration`, `test:e2e`, `sqlite-postgres-migration`, and
`test:browser` (functional + accessibility + **visual-regression** — this is the real
proof of pixel parity called for by this round's acceptance criteria, and Playwright's
snapshots are Linux-baseline-sensitive per this repo's own history, so it must run on
the same `ubuntu-latest` CI runner the baselines were captured on, not a local Windows
machine).

## Security impact

- No secrets exposed to the browser: `vite.config.js` sets no client-visible env vars at
  all; nothing in `frontend/src` reads `import.meta.env`.
- Source maps disabled (`build.sourcemap: false`) — no new debugging surface shipped.
- CSP unchanged; static-file serving code unchanged except the source directory it
  reads from, which now excludes `src/`, `node_modules/`, and `package.json` from being
  web-servable (an improvement over the old behavior, which served the entire
  `frontend/` folder as-is — though nothing sensitive lived there either way).
- New dependency surface: `vite` (frontend devDependency only, not shipped to the
  browser or to the running server process). Audited clean; CI now audits it on every
  run (see `.github/workflows/ci.yml` security job).
- Auth/session/CSRF/cookie behavior: untouched — no code in that path was changed.

## Performance impact / opportunities recorded for the backlog

- Not measured in depth this round (out of scope — see `docs/PRD.md` ground rules).
  Observed in passing while building: minified output is `~104KB` JS / `~38KB` CSS
  (pre-gzip) for what was previously five unminified files — a net improvement, not the
  goal of this round.
- Opportunity noted for a later round: `app.js` is still a single 2726-line module;
  code-splitting/lazy-loading only becomes worthwhile once real feature boundaries exist
  (Round 3+), not before.

## Decisions

See [brain/DECISIONS.md](../brain/DECISIONS.md) for the standing decisions this round
follows (stack direction, branch convention). New to this round:

- **Vite as build-only, no dev server/HMR** — see Design/architecture above.
- **No `prestart` hook** — see Design/architecture above; this is a deliberate
  deviation from "just make `npm start` always rebuild," chosen for production
  restart-loop safety.
- **`frontend/src` kept flat (no `features/`/`components/`/`api/` split yet)** — per
  the "do not over-refactor" instruction for this round; real module boundaries are
  deferred to the round that actually needs them.

## Files changed

```
.github/workflows/ci.yml
README.md
backend/package.json
backend/src/server.js
backend/test/frontend.test.js
docs/ARCHITECTURE.md            (this doc)
docs/FEATURE_UPGRADE_2.md       (new)
docs/PRD.md                     (naming fix: FEATURE_UPGRADE_0N -> FEATURE_UPGRADE_N)
frontend/index.html
frontend/package.json           (new)
frontend/package-lock.json      (new)
frontend/vite.config.js         (new)
frontend/app.js                 -> frontend/src/app.js
frontend/application-preview.js -> frontend/src/application-preview.js
frontend/application-table.js   -> frontend/src/application-table.js
frontend/dashboard-config.js    -> frontend/src/dashboard-config.js
frontend/icons.js               -> frontend/src/icons.js
frontend/ui-utils.js            -> frontend/src/ui-utils.js
frontend/styles.css             -> frontend/src/styles.css
frontend/fonts/*                -> frontend/public/fonts/*
render.yaml
tasks/BACKLOG.md, tasks/CURRENT_TASK.md, brain/PROJECT_STATE.md, brain/AGENT_HANDOFF_LOG.md
```

## CI status

PR [#9](../../../pull/9) into `development`, run [34910943865](../../../actions/runs/34910943865):
all 8 jobs pass — `static-quality` (including the new Vite build step), `security`
(including the new frontend audit), `sqlite-postgres-migration`, `tests` × 4
(backend/frontend/integration/e2e), and `browser-and-visual`. The Playwright run itself:
13 passed, 7 skipped, 0 failed — an exact match to PR #8's pre-Round-2 baseline run,
confirming no functional or visual regression.

## Completion notes

PR #9 is open and green but **not merged** — left for the user's review, per the Round 2
stop condition. Nothing in Round 3+ ([docs/PRD.md](PRD.md)) has started; do not begin
Round 3 until this PR is merged and the user has explicitly said to proceed.
