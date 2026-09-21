# JobQuest V2 — Architecture (Before / After)

Diagram-first companion to the [migration case study](../JOBQUEST_V2_MIGRATION_CASE_STUDY.md). See that document for the reasoning behind each change; this one is the visual/structural reference. Grounded in `CURRENT_STATE_AUDIT.md` (baseline) and `docs/ARCHITECTURE.md` (current), not invented.

## Before V2

```
Browser
  └─ static HTML/CSS/JS (frontend/) — five plain files, no bundler, no framework
        │  fetch() with credentials, CSRF header on mutations
        ▼
Node.js 24 HTTP service (backend/src/server.js) — no framework
  ├─ service.js / advanced.js / feature-upgrade.js — business logic, raw SQL via pg
  ├─ security.js — scrypt PIN hashing, session token hashing
  └─ postgres-db.js / postgres-worker.js — pg connection, Neon-suspend-safe reconnect
        │
        ▼
PostgreSQL on Neon (production) — 8 versioned SQL migrations, no ORM
```

One deployable unit on Render: the Node service serves both the API and the static frontend files directly, unbundled. SQLite exists only as a migration-source/backup format.

## After V2

```
Browser
  └─ frontend/dist/** — Vite production build of frontend/src/**
        │  ES modules: app.js (views/events) + features/<domain>/format.js (pure logic)
        │  fetch() with credentials, CSRF header on mutations
        ▼
Node.js 24 HTTP service (backend/src/server.js) — same, no framework
  ├─ service.js / advanced.js / feature-upgrade.js — unchanged core logic
  ├─ tasks.js / habits.js / notes.js — 3 new domain modules (Rounds 7–9)
  ├─ security.js — unchanged
  └─ postgres-db.js / postgres-worker.js — byte-identical to pre-V2 main
        │
        ▼
PostgreSQL on Neon (production) — 12 versioned SQL migrations, no ORM
  (+4 tables: tasks, habits, habit_logs, notes; +1 index-only migration)
```

**What changed:** a build step in front of the frontend, three new backend domain modules, four new tables. **What didn't:** the HTTP server has no framework, the database access layer has no ORM, Render's service shape, Neon as the sole database, and the entire auth/session/CSRF model.

## Request flow (unchanged shape, before and after)

```
Client                          Server (server.js)                    Database
  │  fetch('/api/applications', │                                        │
  │    {credentials:'include',  │                                        │
  │     headers:{X-CSRF-Token}})│                                        │
  ├─────────────────────────────▶                                        │
  │                              │ requireAuth(context, {csrf:true})     │
  │                              │  → session cookie → hash → lookup     │
  │                              │  → 401 if invalid/expired             │
  │                              │                                        │
  │                              │ route dispatch (server.js /           │
  │                              │  service.js / advanced.js /           │
  │                              │  feature-upgrade.js / tasks.js /      │
  │                              │  habits.js / notes.js)                │
  │                              │                                        │
  │                              │ WHERE user_id = ? on every query ─────▶│
  │                              │◀──────────────────────────────── rows │
  │                              │ (cross-user access → 404, not 403)    │
  │◀─────────────────────────────┤                                        │
  │  JSON response                                                        │
```

This is the pattern every new V2 domain (Tasks, Habits, Notes) plugged into — never a new authorization mechanism, always the existing one.

## The Postgres worker RPC path (where the one deferred V2.1 issue lives)

```
Main thread (server.js, service.js, ...)      Worker thread (postgres-worker.js)
        │                                               │
        │  rpc({op:"query", sql, params})               │
        │  via SharedArrayBuffer + Atomics.wait ────────▶│
        │  (main thread BLOCKS synchronously)            │  pg.Client.query(...)
        │                                                │  (holds the one live
        │                                                │   Neon connection)
        │◀─────────────── publish(result) ───────────────┤
        │  Atomics.notify wakes the waiter                │
        │                                                │
   ⚠ no request-correlation ID in this protocol — a late response from an
     already-timed-out call can be written into a buffer a *different*,
     newer call is waiting on. Confirmed twice on GitHub Actions CI (never
     locally). Root-caused, not yet fixed — see the case study's "final
     release" section and docs/FEATURE_UPGRADE_10_FINAL.md's Known
     Deferred Debt for the full analysis and the recommended V2.1 fix
     (add a correlation ID to the message/response pair).
```

## Deployment topology (unchanged across all ten rounds)

```
GitHub (main / development / feature branches)
        │  push / PR
        ▼
GitHub Actions (.github/workflows/ci.yml)
  static-quality → tests (real Postgres) → security → migration test → browser+visual (real Chromium)
        │  merge to main (PR-gated, regular merge commit)
        ▼
Render (single web service)
  buildCommand: npm ci && npm run build:frontend
  preDeployCommand: npm run migrate:postgres
  startCommand: npm start
  healthCheckPath: /api/health  (fast, DB-independent)
        │
        ▼
Neon (sole database, production and local dev)
```

No containerization, no second hosting provider, no CDN, no load balancer, no cache layer — each evaluated during Round 10's performance audit and explicitly declined for lack of a measured problem to solve.
