import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function checksum(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function inspectSqlite(sourcePath) {
  const source = resolve(sourcePath);
  const db = new DatabaseSync(source, { readOnly: true });
  const integrity = db.prepare("PRAGMA integrity_check").all();
  const foreignKeyProblems = db.prepare("PRAGMA foreign_key_check").all();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map(({ name }) => name);
  const data = {};
  for (const table of tables) {
    const safe = `"${table.replaceAll('"', '""')}"`;
    data[table] = db.prepare(`SELECT * FROM ${safe} ORDER BY rowid`).all();
  }
  db.close();
  return {
    source,
    integrity,
    foreign_key_problems: foreignKeyProblems,
    tables: data,
    row_counts: Object.fromEntries(
      Object.entries(data).map(([table, rows]) => [table, rows.length]),
    ),
  };
}

export function backupSqlite(sourcePath, outputPath) {
  const inspection = inspectSqlite(sourcePath);
  if (
    inspection.integrity.length !== 1 ||
    inspection.integrity[0].integrity_check !== "ok" ||
    inspection.foreign_key_problems.length
  ) {
    throw new Error("SQLite integrity validation failed; backup was not created");
  }
  const output = resolve(outputPath);
  mkdirSync(dirname(output), { recursive: true });
  const source = new DatabaseSync(inspection.source, { readOnly: true });
  source.exec(`VACUUM INTO ${quote(output)}`);
  source.close();
  const rawChecksum = checksum(output);
  const structuredPath = `${output}.json`;
  const structuredTables = { ...inspection.tables, sessions: [] };
  writeFileSync(
    structuredPath,
    `${JSON.stringify(
      {
        backup_version: 1,
        source: "sqlite",
        created_at: new Date().toISOString(),
        source_checksum: checksum(inspection.source),
        raw_backup_checksum: rawChecksum,
        source_name: basename(inspection.source),
        tables: structuredTables,
        row_counts: inspection.row_counts,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  chmodSync(output, 0o400);
  chmodSync(structuredPath, 0o400);
  return {
    ...inspection,
    tables: Object.keys(inspection.tables),
    backup_path: output,
    structured_backup_path: structuredPath,
    backup_checksum: rawChecksum,
  };
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const source = arg("--source") || process.env.SQLITE_SOURCE_PATH;
    const output = arg("--output");
    if (!source) throw new Error("Set SQLITE_SOURCE_PATH or pass --source");
    const result = output ? backupSqlite(source, output) : inspectSqlite(source);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
