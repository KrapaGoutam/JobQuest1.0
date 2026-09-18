# Architecture

## Current state (as of 2026-09-14 — see [CURRENT_STATE_AUDIT.md](../CURRENT_STATE_AUDIT.md))

```
Browser
  └─ static HTML/CSS/vanilla JS (frontend/) — no bundler, no framework
        │  fetch() with credentials, CSRF header on mutations
        ▼
Node.js 24 HTTP service (backend/src/server.js) — no framework
  ├─ service.js / advanced.js / feature-upgrade.js — business logic, raw SQL via pg
  ├─ security.js — scrypt PIN hashing, session token hashing
  └─ postgres-db.js / postgres-worker.js — pg Pool, Neon-suspend-safe reconnect
        │
        ▼
PostgreSQL on Neon (production) — versioned SQL migrations, no ORM
```

- One deployable unit on Render (`render.yaml`): Node service serves both the API and
  the static frontend files. No separate frontend host, no containers.
- SQLite exists only as a migration-source/backup format, never a runtime fallback.

## Data model (from `backend/jobsearch/migrations/001`–`008`)

Core: `users`, `sessions`, `applications`, `activities`, `stage_history`,
`timeline_events`, `audit_log`.

Interviews & outcomes: `interviews`, `rejections`, `follow_ups`.

Networking: `networking_contacts`.

Documents/resumes: `resumes`, `resume_history` (parent/revision metadata, immutable
history — added in Feature Upgrade 1).

Organization: `tags`, `application_tags`, `saved_views`, `application_view_preferences`,
`dashboard_preferences`.

Checklists: `checklist_items`.

Goals/reminders: `daily_goals`, `weekly_goals`, `goal_settings`, `goal_snapshots`,
`reminder_categories`, `reminders`.

Import/export: `import_batches`, `import_rows`, `export_preferences`.

**Important**: several modules the wider product brief describes as "new" — application
checklist, contacts/networking, tags/saved views, import/export — already have schema
and backend endpoints (confirmed live in `service.js`, `advanced.js`,
`feature-upgrade.js`, `server.js`). Before scoping any round touching these, audit the
existing implementation against the target vision first and scope only the *gap* — see
[docs/PRD.md](PRD.md) for which rounds are "gap-close" vs. genuinely net-new.

Genuinely absent from the schema today: task management, habit tracking, journal/notes.
These are net-new domains.

## Current state, post Round 2

Implemented on `feature/002-frontend-build-tooling`, pending merge — see
[docs/FEATURE_UPGRADE_2.md](FEATURE_UPGRADE_2.md).

Same runtime/deploy shape (Render + Neon unchanged — this is a frontend-only change).
The difference is build-time, not run-time:

```
frontend/src/**  →  Vite build  →  frontend/dist/** (served as today's static files)
```

- `app.js` (2726 lines) gets split into cohesive ES modules (views, api client, state,
  utils) instead of one file; `styles.css` may be split by feature area.
- No new client-side framework, no virtual DOM, no JSX. Plain ES modules + the DOM APIs
  already in use.
- Render's build command changes to run the frontend build before `npm start`; the
  Node backend still serves the output — no new hosting surface.
- Every visual/behavioral output must be pixel- and behavior-identical to today's,
  proven via the existing Playwright visual-regression and accessibility suites before
  merge. This round changes tooling only, not product behavior.

## Non-goals (explicitly rejected for this revamp)

- React, Radix/shadcn, Tailwind, Framer Motion — none of these get introduced (decision
  logged in [brain/DECISIONS.md](../brain/DECISIONS.md)).
- A second database, a second hosting provider, containerization — no driver to change
  any of this has been identified.
- An ORM — raw SQL via `pg` has worked fine at this scale and this team is already
  fluent in the existing migration style; revisit only if a specific pain point emerges.

## Note for a possible future framework migration (not planned, not scoped)

As of the end of V2 (Round 10), `frontend/src/app.js` still holds most of the app's
view-rendering and event-wiring logic, with pure formatting/validation logic already
extracted into per-feature `features/*/format.js` modules (`applications`,
`contacts`, `checklist`, `dashboard`, `tasks`, `habits`, `notes`, `import-export`,
`analytics`). If a component-framework migration (React or otherwise) is ever
pursued, that extraction boundary is the natural starting seam: the pure modules
would need no rewrite, only new components consuming them; the render/event-wiring
code in `app.js` is what would actually need porting. This is not a proposal to do
that migration — the vanilla-JS/Vite decision above stands for V2 and is not
revisited by this note — it's a pointer for whoever scopes that question later, so
they aren't starting from zero.
