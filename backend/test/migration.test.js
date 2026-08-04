import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { openDatabase, migrate } from "../src/db.js";
import { hashPassword } from "../src/security.js";
import { migrateSqliteToPostgres } from "../src/sqlite-to-postgres.js";

test(
  "SQLite fixture dry-runs, imports, and preserves IDs and hashes",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const url = process.env.TEST_DATABASE_URL;
    assert.ok(url, "TEST_DATABASE_URL is required");
    const source = join(
      mkdtempSync(join(tmpdir(), "jobquest-migration-")),
      "fixture.sqlite3",
    );
    const sqlite = openDatabase(source);
    migrate(sqlite);
    const hash = hashPassword("0123");
    sqlite
      .prepare(
        "INSERT INTO users(id,username,full_name,password_hash,pin_hash,auth_method,role) VALUES (42,?,?,?,?, 'pin','MANAGER')",
      )
      .run("fixture-manager", "Fixture Manager", hash, hash);
    sqlite
      .prepare(
        "INSERT INTO resumes(id,user_id,version_name,revision_label,is_default,change_summary) VALUES (64,42,'Fixture Resume','v1',1,'Preserved revision')",
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO applications(id,user_id,company,job_title,date_applied,stage,created_by,updated_by) VALUES (84,42,'Fixture Co','Tester','2026-08-03','Applied',42,42)",
      )
      .run();
    sqlite
      .prepare("UPDATE applications SET resume_id=64,board_order=7 WHERE id=84")
      .run();
    sqlite
      .prepare(
        "INSERT INTO application_view_preferences(user_id,dashboard_type,preferred_view,collapsed_columns_json,board_sort) VALUES (42,'manager','kanban','[\"Rejected\"]','custom')",
      )
      .run();
    sqlite.close();
    const dry = await migrateSqliteToPostgres({ source, url, dryRun: true });
    assert.equal(dry.status, "ok");
    const imported = await migrateSqliteToPostgres({ source, url });
    assert.equal(imported.status, "ok");
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const user = (
      await client.query(
        "SELECT id,password_hash,pin_hash,role FROM users WHERE id=42",
      )
    ).rows[0];
    const application = (
      await client.query("SELECT id,user_id FROM applications WHERE id=84")
    ).rows[0];
    const preference = (
      await client.query(
        "SELECT preferred_view,board_sort FROM application_view_preferences WHERE user_id=42",
      )
    ).rows[0];
    await client.end();
    assert.equal(Number(user.id), 42);
    assert.equal(user.password_hash, hash);
    assert.equal(user.pin_hash, hash);
    assert.equal(user.role, "MANAGER");
    assert.deepEqual(
      [Number(application.id), Number(application.user_id)],
      [84, 42],
    );
    assert.deepEqual(preference, {
      preferred_view: "kanban",
      board_sort: "custom",
    });
  },
);
