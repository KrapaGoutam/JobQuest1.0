import { parentPort, workerData } from "node:worker_threads";
import pg from "pg";

const { Client, types } = pg;
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1114, (value) => value);
types.setTypeParser(1184, (value) => value.replace("T", " ").replace("Z", "+00"));
types.setTypeParser(20, (value) => Number(value));

const header = new Int32Array(workerData.buffer, 0, 2);
const output = new Uint8Array(workerData.buffer, 8);
const encoder = new TextEncoder();

function publish(value) {
  const encoded = encoder.encode(JSON.stringify(value));
  if (encoded.length > output.length) value = { error: "Database response exceeded the safe IPC limit" };
  const bytes = encoder.encode(JSON.stringify(value));
  output.set(bytes.subarray(0, output.length));
  Atomics.store(header, 1, Math.min(bytes.length, output.length));
  Atomics.store(header, 0, 1);
  Atomics.notify(header, 0);
}

function placeholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function castBooleanSums(sql) {
  let at = 0;
  while ((at = sql.toLowerCase().indexOf("sum(", at)) >= 0) {
    let end = at + 4, depth = 1, quoted = false;
    for (; end < sql.length && depth; end++) {
      if (sql[end] === "'" && sql[end - 1] !== "\\") quoted = !quoted;
      if (!quoted && sql[end] === "(") depth++;
      if (!quoted && sql[end] === ")") depth--;
    }
    const expression = sql.slice(at + 4, end - 1);
    if (/[=<>]|\sIS\s|\sIN\s/i.test(expression)) {
      const replacement = `sum((${expression})::int)`;
      sql = sql.slice(0, at) + replacement + sql.slice(end);
      at += replacement.length;
    } else at = end;
  }
  return sql;
}

function postgresSql(original) {
  const tableInfo = original.match(/^\s*PRAGMA\s+table_info\(([^)]+)\)/i);
  if (tableInfo)
    return `SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name='${tableInfo[1].replaceAll("'", "''")}' ORDER BY ordinal_position`;
  let sql = original
    .replace(/COLLATE\s+NOCASE/gi, "")
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO")
    .replace(/datetime\('now',\s*\?\)/gi, "(CURRENT_TIMESTAMP + ?::interval)::text")
    .replace(/date\('now'\)/gi, "CURRENT_DATE")
    .replace(/\bdate_applied\s*=\s*CURRENT_DATE/gi, "date_applied::date = CURRENT_DATE")
    .replace(/time\('now'\)/gi, "CURRENT_TIME")
    .replace(/\bexpires_at\s*<=\s*CURRENT_TIMESTAMP/gi, "expires_at::timestamp <= CURRENT_TIMESTAMP")
    .replace(/\bexpires_at\s*>\s*CURRENT_TIMESTAMP/gi, "expires_at::timestamp > CURRENT_TIMESTAMP")
    .replace(/group_concat\(([^,]+),\s*'([^']*)'\)/gi, "string_agg($1, '$2')")
    .replace(/\(\?\s+IS\s+NULL/gi, "(CAST(? AS TEXT) IS NULL")
    .replace(/strftime\('%Y-%m-%d',\s*([^)]+)\)/gi, "to_char(($1)::date, 'YYYY-MM-DD')")
    .replace(/strftime\('%Y-%m',\s*([^)]+)\)/gi, "to_char(($1)::date, 'YYYY-MM')")
    .replace(/strftime\('%Y-W%W',\s*([^)]+)\)/gi, "to_char(($1)::date, 'IYYY-\"W\"IW')")
    .replace(/julianday\('now'\)\s*-\s*julianday\(([^)]+)\)/gi, "EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ($1)::timestamp))/86400")
    .replace(/julianday\(([^)]+)\)\s*-\s*julianday\(([^)]+)\)/gi, "EXTRACT(EPOCH FROM (($1)::timestamp - ($2)::timestamp))/86400");
  sql = castBooleanSums(sql);
  sql = sql.replace(/\)\s+(today|week|month|active|rejected|ghosted|interviewed|offered|accepted|responded|due_today|overdue)\b/gi, ') AS "$1"');
  sql = placeholders(sql);
  if (/^\s*INSERT\s+/i.test(sql) && !/\bRETURNING\b/i.test(sql)) {
    const table = sql.match(/^\s*INSERT\s+INTO\s+([a-z_]+)/i)?.[1];
    if (/INSERT\s+OR\s+IGNORE/i.test(original)) sql += " ON CONFLICT DO NOTHING";
    if (table && !["sessions", "application_tags", "schema_migrations"].includes(table)) sql += " RETURNING id";
  }
  return sql;
}

const connectionString = workerData.url;
const local = /(?:localhost|127\.0\.0\.1)/i.test(connectionString);

function createClient() {
  const c = new Client({
    connectionString,
    ssl: local ? false : { rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    application_name: "jobquest",
  });
  // Without this handler, a connection dropped out from under the client (e.g. Neon
  // suspending its compute after idle) emits an unhandled 'error' event, which is
  // fatal to the whole Node process. Log it and let reconnect-on-demand below recover.
  c.on("error", (error) => {
    console.error("[postgres] connection error:", error.message);
  });
  return c;
}

async function connectWithRetry() {
  const c = createClient();
  for (let attempt = 1; ; attempt++) {
    try {
      await c.connect();
      return c;
    } catch (error) {
      if (attempt >= 3) throw new Error("PostgreSQL connection failed");
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

function isConnectionError(error) {
  return /Connection terminated|ECONNRESET|Client has encountered a connection error|connection is closed/i.test(
    String(error?.message || error)
  );
}

let client = await connectWithRetry();

workerData.port.on("message", async ({ op, sql, params = [] }) => {
  try {
    if (op === "close") {
      await client.end();
      publish({ ok: true });
      return;
    }
    const translated = postgresSql(sql);
    let result;
    try {
      result = await client.query(translated, params);
    } catch (error) {
      if (!isConnectionError(error)) throw error;
      // The connection died between requests (e.g. Neon suspended its compute).
      // Reconnect once and retry this query instead of letting the error bubble up.
      client = await connectWithRetry();
      result = await client.query(translated, params);
    }
    publish({
      rows: result.rows || [],
      changes: result.rowCount || 0,
      lastInsertRowid: result.rows?.[0]?.id ?? null,
    });
  } catch (error) {
    publish({ error: String(error.message || "Database operation failed").replace(/postgres(?:ql)?:\/\/\S+/gi, "[database-url]") });
  }
});
workerData.port.start();
parentPort.postMessage("ready");
