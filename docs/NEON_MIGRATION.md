# SQLite to Neon migration runbook

JobQuest production uses the pooled Neon `DATABASE_URL` at runtime. Controlled schema migration and the one-time SQLite transfer use the direct `DIRECT_URL`. `DATABASE_PATH` is not a PostgreSQL URL and must never be repurposed; `SQLITE_SOURCE_PATH` identifies the read-only legacy source.

## Path B: preserve and transfer the existing database

1. Before any Render redeploy, obtain the live `/tmp/jobsearch.sqlite3` through a secure Render shell or the disabled-by-default administrative backup process. A local development file is not proof that the Render file was preserved.
2. Inspect and back up the source outside Git:

   ```powershell
   $env:SQLITE_SOURCE_PATH = 'C:\secure\jobsearch.sqlite3'
   node src/sqlite-backup.js --source $env:SQLITE_SOURCE_PATH --output 'C:\secure\jobsearch-pre-neon-YYYYMMDD-HHMMSS.sqlite3'
   ```

   The command requires `PRAGMA integrity_check` to return `ok`, requires no `foreign_key_check` failures, creates a consistent raw backup plus a mode-restricted JSON backup, and reports SHA-256 and per-table counts. The JSON omits active sessions; neither backup may be committed.
3. Apply schema migrations through the direct connection:

   ```powershell
   $env:DIRECT_URL = '<Neon direct URL>'
   $env:CONFIRM_PRODUCTION_MIGRATION = 'yes-migrate-jobquest'
   npm run migrate:postgres
   ```
4. Dry-run the mapping without writes:

   ```powershell
   npm run migrate:sqlite-to-postgres -- --source $env:SQLITE_SOURCE_PATH --dry-run --report migration-dry-run.json
   ```
5. Run the transactional import and then validation:

   ```powershell
   npm run migrate:sqlite-to-postgres -- --source $env:SQLITE_SOURCE_PATH --report migration-result.json
   npm run migrate:sqlite-to-postgres -- --source $env:SQLITE_SOURCE_PATH --validate-only --report migration-validation.json
   ```

   The tool preserves IDs, hashes, roles, ownership, timestamps, and relationships; imports in foreign-key order; resets identity sequences; rolls back a failed import; and writes sanitized counts. It will not target a database whose name does not end in `_test` unless the explicit production confirmation flag is present.
6. Verify an existing user and manager login, ownership-scoped applications, timeline and resume links, dashboard preferences, creation/edit/import, and persistence across a restart.
7. Deploy the PostgreSQL runtime. Confirm `/api/health` and `/api/ready`, then verify the major flows again.
8. Only after backup, migration, count validation, login checks, production verification, and restart persistence have all succeeded may `DATABASE_PATH` be removed from the Render service. Retain both SQLite backups until the owner signs off.

## Test safety

CI and local destructive tests use only `TEST_DATABASE_URL`, whose database name must end in `_test`. Pull-request CI starts an isolated PostgreSQL service and needs no Neon secret. Never copy production Neon credentials into test configuration.

## Rollback

Restore the previous application version, restore the prior `DATABASE_PATH`, redeploy it, and verify the retained SQLite backup. Preserve Neon data for investigation. Do not reset Neon, overwrite the source backup, or delete either backup automatically.

## Secret handling

Connection URLs belong only in Render secret environment variables or a secure local shell. Commands sanitize URL-shaped error text. Do not paste URLs into issues, logs, reports, fixtures, `.env.example`, or Git.
