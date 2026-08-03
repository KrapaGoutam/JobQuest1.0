import { openDatabase, migrate } from "./db.js";

const check = process.argv.includes("--check");
const db = openDatabase(check ? ":memory:" : undefined);
migrate(db);
const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
const problems = db.prepare("PRAGMA foreign_key_check").all();
console.log(`Applied migrations: ${versions.map((row) => row.version).join(", ")}`);
console.log(`Foreign key problems: ${problems.length}`);
db.close();
if (problems.length) process.exitCode = 1;
