import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrationDir = join(here, "..", "jobsearch", "migrations");

export function openDatabase(path = process.env.DATABASE_PATH || join(here, "..", "data", "jobsearch.sqlite3")) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  return db;
}

export function migrate(db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const applied = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?");
  const record = db.prepare("INSERT INTO schema_migrations(version) VALUES (?)");
  for (const filename of readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort()) {
    if (applied.get(filename)) continue;
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(join(migrationDir, filename), "utf8"));
      record.run(filename);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function rows(statement, params = []) {
  return statement.all(...params).map((row) => ({ ...row }));
}

