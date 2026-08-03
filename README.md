# JobQuest

JobQuest is a secure, multi-user job-search manager for manually recording applications already submitted. It tracks the application pipeline, activity, interviews, rejections, follow-ups, networking, daily and weekly goals, imports, and user/manager dashboards. It does not scrape job boards, discover jobs, or apply on a user's behalf.

## Stack

- Node.js 24 HTTP service, PostgreSQL runtime driver, and migration-only built-in SQLite reader
- Versioned SQL migrations in `backend/jobsearch/migrations`
- Server-side opaque sessions, HttpOnly/SameSite cookies, CSRF tokens, and salted scrypt PIN hashes
- Responsive HTML/CSS/JavaScript single-page interface served by the backend
- Node's built-in test runner and GitHub Actions CI

The initial repository had no application source, database, authentication, tests, or build configuration. The empty `backend` and `frontend` folders were retained and turned into one application; the broken local `backend/venv` remains ignored and is not used. There were no obsolete tables or existing users to preserve.

## Run locally

Requirements: Node.js 24 or newer.

```powershell
cd backend
npm install
$env:DATABASE_URL = 'postgresql://jobquest:local-only@127.0.0.1:5432/jobquest_dev'
npm start
```

Open `http://127.0.0.1:3000`. Public registration creates regular users only. Production requires `DATABASE_URL` and never falls back to SQLite. SQLite remains available only for source backup, transfer tooling, and isolated compatibility tests. Environment files are not loaded automatically.

Create or reset a protected manager account by passing secrets through the environment, never the command line or repository:

```powershell
$env:MANAGER_USERNAME = "manager"
$env:MANAGER_PIN = "0123"
$env:MANAGER_FULL_NAME = "JobQuest Manager"
npm run seed
```

The seed is idempotent by username. Replace the example PIN. Existing password accounts use the protected “Existing password account” flow once to establish a four-digit PIN without changing identity or deleting their legacy hash.

## Commands

Run from `backend`:

| Command | Purpose |
| --- | --- |
| `npm run migrate` | Apply pending migrations to the configured database |
| `npm run migrate:check` | Apply every migration to a clean in-memory database and check foreign keys |
| `npm run migrate:postgres` | Apply controlled PostgreSQL migrations through `DIRECT_URL` or a guarded test URL |
| `npm run sqlite:inspect -- --source <path> --output <path>` | Validate and create raw/structured SQLite backups |
| `npm run migrate:sqlite-to-postgres -- --source <path> --dry-run` | Dry-run the SQLite mapping |
| `npm run migrate:sqlite-to-postgres -- --source <path>` | Transactionally import and validate SQLite data |
| `npm run seed` | Create/promote the environment-selected manager |
| `npm run dev` | Start with Node watch mode |
| `npm start` | Start normally |
| `npm test` | Run the complete automated suite serially |
| `npm run test:backend` | Run backend API and authorization tests |
| `npm run test:frontend` | Run frontend utility/component logic tests |
| `npm run test:integration` | Run cross-resource integration tests |
| `npm run test:e2e` | Run the authenticated end-to-end workflow test |
| `npm run lint` | Parse-check backend and frontend sources |
| `npm run typecheck` | Run the supported static syntax checks (the project is JavaScript, not TypeScript) |
| `npm run build` | Validate frontend source and clean-database migrations; no compilation is needed |

Use `npm ci` for repeatable installation. CI exercises PostgreSQL plus the SQLite migration fixture. End-to-end coverage exercises the browser-facing API workflow; focused frontend tests cover themes, dashboard bulk selection, calendar, aging, and accessible widget movement.

## Authentication, authorization, and ownership

- PINs are exactly four numeric characters, remain strings so leading zeros survive, and are stored as salted scrypt hashes.
- Five failed logins lock the account for five minutes; errors remain generic.
- Sessions are opaque random tokens stored only as SHA-256 hashes in SQLite and expire after 12 hours.
- Mutations require a session-bound CSRF token. Production cookies add `Secure` when `NODE_ENV=production`.
- Registration always stores role `USER`; only a manager-protected endpoint or protected seed can grant `MANAGER`.
- Regular-user queries include the authenticated user's ID. Detail, update, and delete operations return `404` for another user's IDs.
- Client owner fields are rejected. A manager selects `target_user_id` through protected controls; it is removed before application validation and never imported from row data.
- Related applications, interviews, and contacts must have the same owner. Manager actions retain the record owner while activity/audit rows retain the actor.
- The only active manager cannot be deactivated or demoted.

## Applications and trackers

Applications support complete job metadata, validation, duplicate detection, stage history, visual timelines, tags, pinning, archive/restore, saved views, search/filter/sort/pagination, and manual, Quick Add, JSON, or structured-text entry. Related screens cover resumes and effectiveness analytics, interviews, rejections, calculated follow-ups, networking, reminders and custom categories, month/week/agenda calendars, goal snapshots/history/trends/streaks, application aging, stage duration, and versioned exports. Users and managers have persistent configurable dashboard layouts with accessible drag, keyboard, and mobile reordering.

Dashboard percentages use all tracked applications as the denominator and return zero for an empty dataset:

- Response rate: applications with `last_response_date` / total
- Interview conversion: applications currently at Interview, Final Interview, Offer, or Accepted / total
- Rejection rate: currently Rejected / total
- Offer rate: currently Offer or Accepted / total
- Acceptance rate: currently Accepted / total

Because activity preserves earlier stage changes, historical funnel analysis can be extended without changing application identity.

## Bulk import

Choose JSON or structured text, validate to preview without persistence, then import. Permanent import always reparses and revalidates.

JSON must be a non-empty array of objects. Structured text uses `field: value`, splits only at the first colon, ignores blank lines, and separates applications with `---`.

Canonical fields:

`company`, `job_title`, `job_url`, `location`, `work_arrangement`, `employment_type`, `date_applied`, `source`, `stage`, `priority`, `salary_min`, `salary_max`, `salary_currency`, `salary_range`, `resume_version`, `cover_letter_version`, `recruiter_name`, `recruiter_email`, `recruiter_phone`, `job_description`, `notes`, `next_action`, `next_action_date`, `last_response_date`, `external_job_id`, `tags`, `pinned`, `important`, and `favorite`.

Aliases: `company_name → company`, `title`/`role → job_title`, `application_status`/`status`/`application_stage → stage`, `applied_date`/`date → date_applied`, `url`/`job_link → job_url`, `work_type → work_arrangement`, `resume → resume_version`, and `cover_letter → cover_letter_version`.

Unknown and ownership/authorization fields are errors; nothing is silently discarded. Duplicate identity is normalized owner + company + title + date applied, with normalized URL comparison when present. Actions are `skip`, `import_anyway`, and `update_existing`. Modes are `valid_rows_only` and transactional `all_or_nothing`. Every permanent attempt and row outcome is retained in import history without storing raw inputs or secrets.

## Database migrations

- `001_jobsearch.sql`: users, applications, activity, interviews, rejections, follow-ups, networking, goals, import history, audit records, foreign keys, checks, and ownership/date indexes.
- `002_sessions.sql`: expiring server-side sessions and expiry index.
- `003_complete_manager.sql`: additive ownership-safe schema for timelines, stage history, resumes, reminders, goals, dashboard preferences, saved views, tags, and checklists, plus non-destructive backfills.
- `004_followup_completion.sql`: suggested and completed follow-up dates with supporting index.
- `005_four_digit_pin.sql`: additive PIN hash and backward-compatible authentication transition state.

Migrations are forward-only and transactional. Back up the SQLite file before production upgrades. Rollback requires restoring that backup; the application does not destructively reset databases.

## Git and CI

Development occurs on `development` with focused commits. `.github/workflows/ci.yml` runs on pushes and pull requests targeting `development`, `main`, or `master`, plus manual dispatch. It uses Node 24 and isolated PostgreSQL 17 services to gate schema migration, SQLite fixture transfer, lint/static checks, backend, frontend, integration and end-to-end tests, production build validation, dependency audit, and committed-secret/database checks.

The existing authenticated GitHub remote and Render deployment are used by the gated `development`-to-`main` workflow.

## Deployment boundary

Render uses the pooled Neon `DATABASE_URL` at runtime and the direct `DIRECT_URL` only in the controlled `preDeployCommand`. Do not remove the existing Render `DATABASE_PATH` setting until the live SQLite source is backed up, migrated, count-validated, verified in production, and proven durable after restart. See [docs/NEON_MIGRATION.md](docs/NEON_MIGRATION.md) for Path B, rollback, test isolation, and secret handling.
