# JobQuest V2 — Release Notes

Covers everything built across Rounds 2–10 on `development`, since the last release
on `main`. Organized by feature area, not commit history — see
`docs/FINAL_MAIN_INTEGRATION_PLAN.md` for the technical merge plan and
`brain/AGENT_HANDOFF_LOG.md` for the round-by-round build log.

## New features

- **Task management** — a lightweight to-do layer alongside the application
  pipeline: Backlog/Today/Upcoming/Completed views, due dates, priority, daily/
  weekly/weekdays recurrence, optional linking to a specific application.
- **Habit tracker** — boolean and count-based habits, weekly progress rollups,
  streak tracking, archive/reactivate, full history.
- **Journal & Notes** — general notes and daily journal entries, searchable, with
  optional linking to an application (shows on that application's own detail page),
  pinning, and type categorization (General/Daily Journal/Interview/Company
  Research/Reflection).
- **Analytics** — a dedicated page: pipeline funnel, response/interview/offer rates
  by source and by resume version, with a configurable date range. Built entirely on
  existing backend aggregation endpoints and the app's existing dependency-free SVG
  chart primitives — no new chart library.

## Improvements

- **Dashboard & Applications workspace revamp**: table and Kanban views, saved
  filter views, quick filters, bulk selection, drag-free keyboard-accessible widget
  reordering.
- **Application checklist**: stage-grouped, reorderable, with completion tracking.
- **Contacts / networking**: linking to applications, edit support, safe unlink-on-
  delete.
- **Import / export hardening**: CSV/structured-text/JSON import with preview,
  duplicate detection, partial-failure handling; CSV/XLSX export with formula-
  injection protection on every field.
- **Tracker edit UI gap-close**: Interviews, Rejections, Follow-ups, Networking
  Contacts, and Goals records can now all be edited from the UI — the backend already
  supported it, but only Networking Contacts previously exposed it.
- **Accessibility**: full audit this round. Fixed the `#toast` notification's
  color-contrast finding at the root (a `visibility`-transition fix, not a scan
  exclusion), plus two more issues the same investigation surfaced (calendar
  "outside month" day contrast, the reminder-category filter's missing label).
  Every previously-excluded accessibility-scan pattern was individually re-justified
  or removed.
- **Performance**: closed a missing-index gap on `import_rows` (composite index
  covering the batch-history query's filter and sort). Evaluated and explicitly
  declined a CDN, load balancer, server-side cache, and API response caching — none
  justified at current, measured scale.
- **Frontend build tooling**: migrated to Vite; the previous ~2,700-line single
  `app.js` file has been progressively extracted into per-feature modules
  (`features/applications`, `features/contacts`, `features/tasks`,
  `features/habits`, `features/notes`, `features/import-export`,
  `features/analytics`, `features/checklist`, `features/dashboard`) for pure
  formatting/validation logic, while staying vanilla JS — no framework migration.

## Fixes

- Three real, previously-undiscovered UI-reliability bugs found and fixed during
  this round's full-suite validation pass (see `docs/FEATURE_UPGRADE_10_FINAL.md`,
  Phase 10H, for full technical detail):
  - The `#toast` notification's accessibility scan could catch it mid-animation
    under specific timing.
  - Two variants of a mobile-navigation-drawer race condition, one of which traced
    to a real (if narrow) application-code gap: a task-creation re-render that
    wasn't being awaited.
- A generic-tracker API response-shape improvement: creating/editing an Interview,
  Rejection, Follow-up, Networking Contact, or Goal now returns the full updated
  record (matching every other domain's convention) instead of just `{id}`.

## Security

Formal final audit this round across authorization, mass assignment, CSRF, XSS, SQL
injection, CSV injection, logging, CSP, and session handling. **No unresolved
CRITICAL or HIGH findings.** Full report in `docs/SECURITY.md`.

## Infrastructure

One `render.yaml` change ships with this release: `buildCommand` now runs
`npm run build:frontend` (the Vite production build) before starting the app —
required because the frontend build tooling migration (above) means the app can no
longer be served unbuilt. No other Render or Neon configuration changes. See
`docs/FINAL_MAIN_INTEGRATION_PLAN.md` for the full infrastructure-impact assessment.

## Known debt going into V2.1

See the Technical Debt Classification table in `docs/FEATURE_UPGRADE_10_FINAL.md`
for the complete, individually-triaged list. Highlights:

- Several `toast(); render*();` call sites in `app.js` don't `await` the re-render,
  which is real (if narrow) debt a full-suite validation pass surfaced.
- `prompt()`-based quick-edit dialogs (habit fields, category/tag rename, checklist
  item edit, etc.) are a deliberate, consistent, dependency-free pattern across 11
  call sites — not a defect, but a candidate for a shared modal component if the
  app ever wants richer inline editing.
- A rare, load-dependent E2E timing flake in the mobile navigation drawer and in one
  toast assertion, both understood at the root-cause level and both far less
  frequent after this round's fixes, but not fully eliminated under maximum
  concurrent test load.
