# JobQuest V2 — Migration Timeline

A chronological, PR-by-PR reference. For the engineering narrative behind each round, see the [migration case study](../JOBQUEST_V2_MIGRATION_CASE_STUDY.md#the-migration-process--ten-rounds); for decision-level detail, see `brain/DECISIONS.md` and the individual `docs/FEATURE_UPGRADE_N.md` files this table is drawn from.

## Pre-V2 history (for context)

| Date | PR | Branch → base | What |
|---|---|---|---|
| 2026-08-06 | #1 | `feature/upgrade-lovable-ui-reference` → `development` | Adapt Dashboard/Applications from an approved Lovable design reference |
| 2026-08-06 | #2 | `development` → `main` | Promote: Lovable UI adaptation to production |
| 2026-08-07 | #3 | `feature/dashboard-applications-reskin` → `development` | Dashboard + Applications visual reskin (navy/indigo) |
| 2026-08-07 | #4 | `development` → `main` | Promote: dashboard and applications reskin |
| 2026-08-07 | #5 | `chore/refresh-visual-baselines` → `development` | Refresh Playwright visual baselines on Linux |
| 2026-08-07 | #6 | `development` → `main` | Promote: dashboard/applications reskin + Linux visual-baseline fix |
| 2026-08-20 | #7 | `bugfix/pg-pool-connection-crash` → `main` | Fix: handle pg connection errors to prevent crash on Neon compute suspend (`481c00b`) — preserved untouched through the entire V2 migration |

## V2 planning

| Date | PR | Branch → base | What |
|---|---|---|---|
| 2026-09-14 | #8 | `docs/v2-planning-foundation` → `development` | Establish V2 planning foundation: `CURRENT_STATE_AUDIT.md`, `docs/PRD.md` roadmap, agent scaffolding (`AGENTS.md`, `brain/`, `tasks/`) |

## The ten rounds

| Round | Date | PR | Branch → base | Title |
|---|---|---|---|---|
| 2 | 2026-09-15 | #9 | `feature/002-frontend-build-tooling` → `development` | Frontend build tooling (Vite, no React) |
| 3 | 2026-09-15 | #10 | `feature/003-dashboard-applications-revamp` → `development` | Dashboard information hierarchy + Applications quick filters |
| 4 | 2026-09-15 | #11 | `feature/004-application-checklist-gap-close` → `development` | Application checklist gap-close (edit, delete, reorder, validation) |
| 5 | 2026-09-16 | #12 | `feature/005-contacts-networking-gap-close` → `development` | Contacts/networking gap-close (application linkage, edit UI, detail-page surfacing) |
| 6 | 2026-09-16 | #13 | `feature/006-import-export-hardening` → `development` | Import/export hardening (CSV formula injection, `job_url` safety, CSV import) |
| 7 | 2026-09-17 | #14 | `feature/007-task-management` → `development` | Task management — genuinely net-new `tasks` domain |
| 8 | 2026-09-17 | #15 | `feature/008-habit-tracker` → `development` | Habit tracker — genuinely net-new `habits`/`habit_logs` |
| 9 | 2026-09-17 | #16 | `feature/009-journal-notes` → `development` | Journal/notes — genuinely net-new `notes` domain |
| 10 (FINAL) | 2026-09-18 | #17 | `feature/010-final-analytics-hardening` → `development` | Analytics + capstone hardening (9 internal phases, 10A–10I) |
| — | 2026-09-18 | #18 | `development` → `main` | Release: JobQuest V2 |

## Final integration, in detail

| Event | SHA / ref | Note |
|---|---|---|
| PR #17 merged into `development` | `41f3cd2` | Real two-parent merge commit (`ed84be5` + feature branch head), not squashed or fast-forwarded |
| Integrated `development` re-validated | — | Full CI-equivalent gate list re-run against the *merged* branch, not just the feature branch — real Postgres 17, real Chromium |
| `development` vs `main` re-audited post-merge | — | 87 commits ahead, 3 behind (a single already-preserved fix); zero-conflict dry-run merge confirmed twice |
| PR #18 opened | — | `development` → `main`, "release: JobQuest V2" |
| PR #18 merged into `main` | `4064502` | Real two-parent merge commit (`7b674f4` + `development` head) |
| Post-merge CI on `main` | — | All 8 jobs green |

## Database migration timeline

| Migration | Round | Table(s) added |
|---|---|---|
| 001–008 | pre-V2 | Core schema (see the case study's [Database migrations](../JOBQUEST_V2_MIGRATION_CASE_STUDY.md#database-migrations) section) |
| 009 `task_management.sql` | 7 | `tasks` |
| 010 `habit_tracker.sql` | 8 | `habits`, `habit_logs` |
| 011 `journal_notes.sql` | 9 | `notes` |
| 012 `final_performance_indexes.sql` | 10 | (index only — `import_rows(batch_id, row_number)`) |
