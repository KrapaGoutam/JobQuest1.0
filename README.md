# JobQuest

JobQuest is a secure, multi-user job-search manager for manually recording applications already submitted. It tracks the application pipeline, activity, interviews, rejections, follow-ups, networking, daily and weekly goals, imports, and user/manager dashboards. It does not scrape job boards, discover jobs, or apply on a user's behalf.

## Stack

- Node.js 24 HTTP service and built-in SQLite driver; no runtime packages
- Versioned SQL migrations in `backend/jobsearch/migrations`
- Server-side opaque sessions, HttpOnly/SameSite cookies, CSRF tokens, and scrypt password hashes
- Responsive HTML/CSS/JavaScript single-page interface served by the backend
- Node's built-in test runner and GitHub Actions CI

The initial repository had no application source, database, authentication, tests, or build configuration. The empty `backend` and `frontend` folders were retained and turned into one application; the broken local `backend/venv` remains ignored and is not used. There were no obsolete tables or existing users to preserve.

## Run locally

Requirements: Node.js 24 or newer.

```powershell
cd backend
npm run migrate
npm start
```

Open `http://127.0.0.1:3000`. Public registration creates regular users only. The database defaults to `backend/data/jobsearch.sqlite3`, which is ignored by Git. Override `HOST`, `PORT`, or `DATABASE_PATH` as shown in `.env.example`; environment files are not loaded automatically and should be provided by the shell or process manager.

Create or reset a protected manager account by passing secrets through the environment, never the command line or repository:

```powershell
$env:MANAGER_USERNAME = "manager"
$env:MANAGER_PASSWORD = "use-a-long-random-password"
$env:MANAGER_FULL_NAME = "JobQuest Manager"
npm run seed
```

The seed is idempotent by username. Do not reuse the example password. Existing hashes and user IDs are retained by normal migrations.

## Commands

Run from `backend`:

| Command | Purpose |
| --- | --- |
| `npm run migrate` | Apply pending migrations to the configured database |
| `npm run migrate:check` | Apply every migration to a clean in-memory database and check foreign keys |
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

There is no dependency installation step because the project has no third-party runtime or development dependencies. End-to-end coverage exercises the complete browser-facing API workflow; focused frontend tests cover theme, calendar, aging, and accessible widget movement logic.

## Authentication, authorization, and ownership

- Passwords require at least 10 characters and are stored as salted scrypt hashes.
- Five failed logins lock the account for 15 minutes; errors remain generic.
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

Migrations are forward-only and transactional. Back up the SQLite file before production upgrades. Rollback requires restoring that backup; the application does not destructively reset databases.

## Git and CI

Development occurs on `development` with focused commits. `.github/workflows/ci.yml` runs on pushes and pull requests targeting `development`, `main`, or `master`, plus manual dispatch. It uses Node 24 and separately gates clean migrations, lint/static checks, backend, frontend, integration and end-to-end tests, production build validation, dependency audit, and committed-secret/database checks.

No remote or deployment target existed, so none was invented. After creating a GitHub repository:

```powershell
git remote add origin <your-repository-url>
git push -u origin development
```

The workflow will run once pushed. Continuous deployment remains intentionally unconfigured until a target and its security requirements are chosen.

## Deployment boundary

The service is designed for one Node process with persistent SQLite storage. Set a persistent `DATABASE_PATH`, run `npm run migrate` during release, and start with `npm start`. A free host without a persistent disk will lose SQLite data on rebuild or restart; use an external persistent database or a paid persistent disk before treating such a deployment as durable. No provider-specific deployment configuration is committed because the repository does not assume a deployment target.
