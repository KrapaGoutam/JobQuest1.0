# JobQuest V2 — Screenshot Index

All screenshots below were captured live via Playwright against a real running instance of the actual `main`-branch codebase (commit `4064502`), backed by a real PostgreSQL 17 database with realistic seeded data — not mockups, not design comps. See the [migration case study](../JOBQUEST_V2_MIGRATION_CASE_STUDY.md) for the full narrative these screenshots support.

Captured at the viewport sizes defined in `backend/playwright.config.js`: `desktop` (1440×1000) and `mobile` (390×844).

| # | File | Page / state | What it shows |
|---|---|---|---|
| 01 | `screenshots/01-dashboard-desktop.png` | Dashboard, dark theme | The Round 3 information hierarchy: Needs Your Attention / Current Pipeline / Trends & Context tiers, with real pipeline data (6 applications across 5 active stages) |
| 02 | `screenshots/02-applications-table-desktop.png` | Applications, table view | Per-column filter dialogs, quick filters, saved views, sortable columns — all pre-existing machinery Round 3 audited and reused rather than rebuilt |
| 03 | `screenshots/03-applications-kanban-desktop.png` | Applications, Kanban view | Stage-grouped board with date sub-grouping, showing applications distributed across Applied/Recruiter Screen/Interview/Final Interview/Offer/Rejected |
| 04 | `screenshots/04-application-detail-checklist-desktop.png` | Application detail page | The Round 4 checklist gap-close — full CRUD, reorder, lifecycle-phase grouping, on the Nimbus Analytics application |
| 05 | `screenshots/05-tasks-desktop.png` | Tasks | Round 7's net-new Tasks domain: Today/Backlog/Upcoming/Completed views, priority, application linking |
| 06 | `screenshots/06-habits-desktop.png` | Habits, Today view | Round 8's Habit Tracker mid-interaction: a completed daily habit, an in-progress count habit ("Apply to 2 roles," 1 of 2), and a weekly habit — demonstrating the unified boolean+count completion model |
| 07 | `screenshots/07-notes-desktop.png` | Journal & Notes | Round 9's net-new Notes domain: a general note linked to an application, and an undated daily-journal entry |
| 08 | `screenshots/08-analytics-desktop.png` | Analytics | Round 10's Analytics page: pipeline funnel, by-source and by-resume-version performance, built on backend aggregation that mostly pre-existed this round |
| 09 | `screenshots/09-networking-desktop.png` | Networking | The Round 5 fix in action — a contact genuinely linked to its application (the pre-existing UI had this field but never rendered it) |
| 10 | `screenshots/10-bulk-import-desktop.png` | Bulk Import | The import workspace including the CSV format option added in Round 6 |
| 11 | `screenshots/11-dashboard-mobile.png` | Dashboard, mobile (390×844) | Responsive layout at the narrowest fully-supported viewport |
| 12 | `screenshots/12-mobile-nav-drawer.png` | Mobile navigation, open | The mobile nav drawer whose `nav-open` scroll-lock bug was found and fixed during Round 10's final CI validation |
| 13 | `screenshots/13-applications-mobile.png` | Applications, mobile | Responsive card-based layout replacing the desktop table |
| 14 | `screenshots/14-dashboard-light-theme.png` | Dashboard, light theme | The app is dark-themed by default (`:root` is the dark palette); this shows the `data-theme="light"` override |

## Reproducing these screenshots

```bash
# 1. Start a throwaway Postgres 17 container
docker run -d --name jq-demo -e POSTGRES_USER=jobquest -e POSTGRES_PASSWORD=demo-password \
  -e POSTGRES_DB=jobquest_demo_test -p 5450:5432 postgres:17-alpine

# 2. Apply migrations
cd backend
TEST_DATABASE_URL="postgresql://jobquest:demo-password@127.0.0.1:5450/jobquest_demo_test" \
  npm run migrate:postgres

# 3. Build the frontend and start the server
npm run build:frontend
DATABASE_URL="postgresql://jobquest:demo-password@127.0.0.1:5450/jobquest_demo_test" \
  PORT=3900 node src/server.js

# 4. Register an account at http://127.0.0.1:3900, seed a few applications/
#    tasks/habits/notes through the UI (or via authenticated fetch() calls),
#    then use any Playwright-driven browser to navigate and screenshot.
```
