import pg from "pg";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectSqlite } from "./sqlite-backup.js";
import { assertSafeDatabaseUrl } from "./postgres-migrate.js";

const ORDER = [
  "users", "resumes", "applications", "activities", "stage_history",
  "timeline_events", "interviews", "rejections", "networking_contacts",
  "follow_ups", "daily_goals", "weekly_goals", "import_batches", "import_rows",
  "reminder_categories", "reminders", "goal_settings", "goal_snapshots",
  "tags", "application_tags", "dashboard_preferences", "saved_views",
  "checklist_items", "audit_log",
];

const hashFile = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const quoted = (name) => `"${name.replaceAll('"', '""')}"`;

function normalize(value) {
  if (value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  return value;
}

export async function migrateSqliteToPostgres({ source, url, dryRun = false, validateOnly = false, allowProduction = false, reportPath }) {
  assertSafeDatabaseUrl(url, { allowProduction });
  const inspection = inspectSqlite(source);
  if (inspection.integrity[0]?.integrity_check !== "ok" || inspection.foreign_key_problems.length)
    throw new Error("SQLite source integrity validation failed");
  const local = /(?:localhost|127\.0\.0\.1)/i.test(url);
  const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: true }, connectionTimeoutMillis: 10_000 });
  await client.connect();
  const report = {
    migration_run_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    source_checksum: hashFile(resolve(source)),
    mode: validateOnly ? "validate" : dryRun ? "dry-run" : "import",
    source_counts: inspection.row_counts,
    target_counts: {},
    imported_counts: {},
    warnings: [],
  };
  try {
    const schema = await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'");
    const columns = new Map();
    for (const row of schema.rows) {
      if (!columns.has(row.table_name)) columns.set(row.table_name, new Set());
      columns.get(row.table_name).add(row.column_name);
    }
    for (const table of ORDER)
      if (inspection.tables[table] && !columns.has(table)) throw new Error(`Target schema is missing table ${table}`);
    if (!dryRun && !validateOnly) await client.query("BEGIN");
    if (!dryRun && !validateOnly) {
      for (const table of ORDER) {
        const rows = inspection.tables[table] || [];
        let imported = 0;
        for (const row of rows) {
          const fields = Object.keys(row).filter((field) => columns.get(table)?.has(field));
          if (!fields.length) continue;
          const values = fields.map((field) => normalize(row[field]));
          const placeholders = fields.map((_, index) => `$${index + 1}`).join(",");
          const identity = fields.includes("id") ? " OVERRIDING SYSTEM VALUE" : "";
          const result = await client.query(
            `INSERT INTO ${quoted(table)} (${fields.map(quoted).join(",")})${identity} VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values,
          );
          imported += result.rowCount;
        }
        report.imported_counts[table] = imported;
        if (columns.get(table)?.has("id"))
          await client.query(`SELECT setval(pg_get_serial_sequence($1,'id'), GREATEST(COALESCE((SELECT max(id) FROM ${quoted(table)}),1),1), true)`, [table]);
      }
    }
    for (const table of ORDER.filter((name) => columns.has(name))) {
      report.target_counts[table] = Number((await client.query(`SELECT count(*)::int count FROM ${quoted(table)}`)).rows[0].count);
      if (!dryRun && (inspection.row_counts[table] || 0) > report.target_counts[table])
        throw new Error(`Row-count validation failed for ${table}`);
    }
    const fk = await client.query("SELECT conname FROM pg_constraint WHERE contype='f' AND NOT convalidated");
    if (fk.rowCount) throw new Error("PostgreSQL contains unvalidated foreign keys");
    if (!dryRun && !validateOnly) await client.query("COMMIT");
    report.status = "ok";
  } catch (error) {
    if (!dryRun && !validateOnly) await client.query("ROLLBACK").catch(() => {});
    report.status = "failed";
    report.error = error.message;
    throw error;
  } finally {
    await client.end();
    if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  return report;
}

function value(name) { const at = process.argv.indexOf(name); return at < 0 ? null : process.argv[at + 1]; }
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const allowProduction = process.env.CONFIRM_PRODUCTION_MIGRATION === "yes-migrate-jobquest";
  migrateSqliteToPostgres({
    source: value("--source") || process.env.SQLITE_SOURCE_PATH,
    url: process.env.DIRECT_URL || process.env.TEST_DATABASE_URL,
    dryRun: process.argv.includes("--dry-run"),
    validateOnly: process.argv.includes("--validate-only"),
    allowProduction,
    reportPath: value("--report"),
  }).then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => {
    console.error(String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, "[database-url]"));
    process.exitCode = 1;
  });
}
