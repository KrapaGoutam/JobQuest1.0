import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, migrate, rows } from "./db.js";
import {
  hashPassword,
  verifyPassword,
  newToken,
  tokenHash,
} from "./security.js";
import {
  createApplication,
  dashboard,
  executeImport,
  listApplications,
  ownedApplication,
  previewImport,
  updateApplication,
  changeStage,
} from "./service.js";
import { handleAdvanced } from "./advanced.js";
import { handleFeatureUpgrade } from "./feature-upgrade.js";

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(here, "..", "..", "frontend");
const LOCKOUT_ATTEMPTS = 5,
  LOCKOUT_MINUTES = 5,
  SESSION_HOURS = 12;

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function cookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const at = part.indexOf("=");
        return [
          part.slice(0, at).trim(),
          decodeURIComponent(part.slice(at + 1)),
        ];
      }),
  );
}

async function body(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 1_000_000)
      throw Object.assign(new Error("Request is too large"), { status: 413 });
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON"), {
      status: 400,
    });
  }
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    phone: user.phone,
    role: user.role,
    is_active: Boolean(user.is_active),
    theme: user.theme_preference || "system",
    created_at: user.created_at,
  };
}

function authenticate(db, request) {
  const token = cookies(request).jobquest_session;
  if (!token) return null;
  const record = db
    .prepare(
      "SELECT u.*,s.csrf_token,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP AND u.is_active=1",
    )
    .get(tokenHash(token));
  return record ? { ...record } : null;
}

function requireAuth(context, { manager = false, csrf = false } = {}) {
  if (!context.actor)
    throw Object.assign(new Error("Authentication required"), { status: 401 });
  if (manager && context.actor.role !== "MANAGER")
    throw Object.assign(new Error("Not found"), { status: 404 });
  if (
    csrf &&
    context.request.headers["x-csrf-token"] !== context.actor.csrf_token
  )
    throw Object.assign(new Error("Invalid CSRF token"), { status: 403 });
  return context.actor;
}

function targetOwner(db, actor, input) {
  if (actor.role !== "MANAGER") {
    if (input.user_id != null || input.owner_id != null)
      throw Object.assign(new Error("Owner fields are not allowed"), {
        status: 400,
      });
    return actor.id;
  }
  const id = Number(input.target_user_id || actor.id);
  const user = db
    .prepare("SELECT id FROM users WHERE id=? AND is_active=1")
    .get(id);
  if (!user)
    throw Object.assign(new Error("Target user not found"), { status: 400 });
  return id;
}

function createSession(db, userId) {
  const token = newToken(),
    csrf = newToken(24);
  db.prepare("DELETE FROM sessions WHERE expires_at<=CURRENT_TIMESTAMP").run();
  db.prepare(
    "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,datetime('now',?))",
  ).run(tokenHash(token), userId, csrf, `+${SESSION_HOURS} hours`);
  return { token, csrf };
}

const trackerConfig = {
  interviews: {
    required: [
      "application_id",
      "interview_round",
      "interview_type",
      "scheduled_at",
    ],
    application: "application_id",
    activity: "interview_added",
  },
  rejections: {
    required: ["application_id", "rejection_date", "stage_at_rejection"],
    application: "application_id",
    activity: "rejection_recorded",
  },
  follow_ups: {
    required: ["follow_up_type", "due_date"],
    activity: "follow_up_added",
  },
  networking_contacts: {
    required: ["contact_name"],
    application: "application_id",
    activity: "networking_contact_linked",
  },
  daily_goals: { required: ["goal_date"] },
  weekly_goals: { required: ["week_start", "week_end"] },
};

function tableColumns(db, table) {
  return new Set(
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((column) => column.name),
  );
}
function addConfiguredDays(start, count, business) {
  let current = start,
    remaining = Number(count);
  while (remaining > 0) {
    const next = new Date(`${current}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    current = next.toISOString().slice(0, 10);
    const day = next.getUTCDay();
    if (!business || (day !== 0 && day !== 6)) remaining--;
  }
  return current;
}

function listTracker(db, actor, table, query) {
  const where = [],
    params = [];
  if (actor.role !== "MANAGER") {
    where.push("t.user_id=?");
    params.push(actor.id);
  } else if (query.user_id) {
    where.push("t.user_id=?");
    params.push(Number(query.user_id));
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return rows(
    db.prepare(
      `SELECT t.*,u.username owner_username FROM ${table} t JOIN users u ON u.id=t.user_id ${clause} ORDER BY t.id DESC LIMIT 200`,
    ),
    params,
  );
}

function relatedOwner(db, input) {
  const checks = [
    ["application_id", "applications"],
    ["interview_id", "interviews"],
    ["networking_contact_id", "networking_contacts"],
  ];
  let owner = null;
  for (const [field, table] of checks)
    if (input[field]) {
      const record = db
        .prepare(`SELECT user_id FROM ${table} WHERE id=?`)
        .get(Number(input[field]));
      if (!record)
        throw Object.assign(new Error(`Related ${field} was not found`), {
          status: 400,
        });
      if (owner != null && owner !== record.user_id)
        throw Object.assign(
          new Error("Related records must have the same owner"),
          { status: 400 },
        );
      owner = record.user_id;
    }
  return owner;
}

function createTracker(db, actor, table, input) {
  const config = trackerConfig[table],
    related = relatedOwner(db, input);
  const owner = targetOwner(db, actor, input);
  if (related != null && related !== owner)
    throw Object.assign(new Error("Related record ownership mismatch"), {
      status: 400,
    });
  if (table === "follow_ups" && input.application_id) {
    const app = db
        .prepare("SELECT date_applied FROM applications WHERE id=?")
        .get(input.application_id),
      settings = db.prepare("SELECT * FROM users WHERE id=?").get(owner);
    input.suggested_date ||= addConfiguredDays(
      app.date_applied,
      settings.first_follow_up_delay,
      settings.follow_up_day_type === "business",
    );
    input.due_date ||= input.suggested_date;
  }
  const missing = config.required.filter(
    (field) => input[field] == null || input[field] === "",
  );
  if (missing.length)
    throw Object.assign(new Error(`Required: ${missing.join(", ")}`), {
      status: 400,
    });
  const columns = tableColumns(db, table);
  const fields = Object.keys(input).filter(
    (field) =>
      columns.has(field) &&
      !["id", "user_id", "created_at", "updated_at"].includes(field),
  );
  const result = db
    .prepare(
      `INSERT INTO ${table}(user_id,${fields.join(",")}) VALUES (?,${fields.map(() => "?").join(",")})`,
    )
    .run(owner, ...fields.map((field) => input[field]));
  const id = Number(result.lastInsertRowid);
  const applicationId =
    input.application_id ||
    (input.interview_id
      ? db
          .prepare("SELECT application_id FROM interviews WHERE id=?")
          .get(input.interview_id)?.application_id
      : null);
  if (config.activity && applicationId)
    db.prepare(
      "INSERT INTO activities(application_id,user_id,actor_user_id,activity_type,note) VALUES (?,?,?,?,?)",
    ).run(
      applicationId,
      owner,
      actor.id,
      config.activity,
      `${table.replaceAll("_", " ")} added`,
    );
  if (config.activity && applicationId) {
    const app = db
      .prepare("SELECT * FROM applications WHERE id=?")
      .get(applicationId);
    const category =
      table === "networking_contacts"
        ? "recruiter"
        : table === "rejections"
          ? "rejection"
          : table === "follow_ups"
            ? "follow_up"
            : "interview";
    db.prepare(
      "INSERT INTO timeline_events(application_id,user_id,actor_user_id,event_date,event_time,category,event_type,stage,title,description,source,related_record_type,related_record_id) VALUES (?,?,?,date('now'),time('now'),?,?,?,?,?,'automatic',?,?)",
    ).run(
      applicationId,
      owner,
      actor.id,
      category,
      config.activity,
      app.stage,
      `${table.replaceAll("_", " ")} added`,
      input.notes || null,
      table,
      id,
    );
  }
  if (table === "rejections") {
    const app = db
      .prepare("SELECT * FROM applications WHERE id=?")
      .get(input.application_id);
    if (app.stage !== "Rejected") changeStage(db, app, actor.id, "Rejected");
  }
  if (table === "follow_ups" && input.application_id) {
    const settings = db.prepare("SELECT * FROM users WHERE id=?").get(owner);
    if (settings.auto_create_follow_up_reminder) {
      const category = db
        .prepare(
          "SELECT id FROM reminder_categories WHERE stable_key='application-follow-up'",
        )
        .get();
      db.prepare(
        "INSERT INTO reminders(user_id,category_id,related_record_type,related_record_id,title,description,due_date,due_time,priority,status) VALUES (?,?, 'application',?,?,?,?,?,'Medium','Upcoming')",
      ).run(
        owner,
        category.id,
        input.application_id,
        `Follow up: ${input.follow_up_type}`,
        input.notes || null,
        input.due_date,
        settings.default_reminder_time,
      );
    }
  }
  return id;
}

function updateTracker(db, actor, table, id, input) {
  const record =
    actor.role === "MANAGER"
      ? db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id)
      : db
          .prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`)
          .get(id, actor.id);
  if (!record) throw Object.assign(new Error("Not found"), { status: 404 });
  if ("user_id" in input || "target_user_id" in input || "owner_id" in input)
    throw Object.assign(new Error("Ownership cannot be changed"), {
      status: 400,
    });
  const related = relatedOwner(db, input);
  if (related != null && related !== record.user_id)
    throw Object.assign(new Error("Related record ownership mismatch"), {
      status: 400,
    });
  const columns = tableColumns(db, table);
  const fields = Object.keys(input).filter(
    (field) =>
      columns.has(field) &&
      !["id", "user_id", "created_at", "updated_at"].includes(field),
  );
  if (fields.length)
    db.prepare(
      `UPDATE ${table} SET ${fields.map((field) => `${field}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).run(...fields.map((field) => input[field]), id);
  const applicationId =
    record.application_id ||
    (record.interview_id
      ? db
          .prepare("SELECT application_id FROM interviews WHERE id=?")
          .get(record.interview_id)?.application_id
      : null);
  if (applicationId && ["interviews", "follow_ups"].includes(table)) {
    const app = db
        .prepare("SELECT stage FROM applications WHERE id=?")
        .get(applicationId),
      completed = input.status === "Completed" || input.result === "Completed";
    if (table === "follow_ups" && completed)
      db.prepare(
        "UPDATE follow_ups SET completed_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(id);
    db.prepare(
      "INSERT INTO timeline_events(application_id,user_id,actor_user_id,event_date,event_time,category,event_type,stage,title,description,source,related_record_type,related_record_id) VALUES (?,?,?,date('now'),time('now'),?,?,?,?,?,'automatic',?,?)",
    ).run(
      applicationId,
      record.user_id,
      actor.id,
      table === "interviews" ? "interview" : "follow_up",
      completed
        ? `${table.slice(0, -1)}_completed`
        : `${table.slice(0, -1)}_updated`,
      app.stage,
      completed
        ? `${table.replaceAll("_", " ")} completed`
        : `${table.replaceAll("_", " ")} updated`,
      input.notes || null,
      table,
      id,
    );
  }
  return id;
}

export function createRequestHandler({ db = openDatabase() } = {}) {
  if (db.dialect === "postgres") {
    const ready = db
      .prepare("SELECT version FROM schema_migrations WHERE version=?")
      .get("006_feature_upgrade_one.sql");
    if (!ready)
      throw new Error(
        "PostgreSQL schema is not current; run the controlled migration command",
      );
  } else migrate(db);
  return async function handler(request, response) {
    const url = new URL(request.url, "http://localhost");
    const context = {
      db,
      request,
      response,
      url,
      actor: authenticate(db, request),
    };
    try {
      if (url.pathname === "/api/health")
        return json(response, 200, { status: "ok" });
      if (url.pathname === "/api/ready") {
        db.prepare("SELECT 1 ready").get();
        return json(response, 200, { status: "ready", database: "available" });
      }
      if (url.pathname === "/api/auth/register" && request.method === "POST") {
        const input = await body(request);
        if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(input.username || ""))
          throw Object.assign(
            new Error(
              "Username must be 3-40 letters, numbers, dots, dashes, or underscores",
            ),
            { status: 400 },
          );
        if (!/^\d{4}$/.test(String(input.pin || "")))
          throw Object.assign(
            new Error("PIN must contain exactly four digits"),
            { status: 400 },
          );
        if (input.pin !== input.confirm_pin)
          throw Object.assign(new Error("PIN confirmation does not match"), {
            status: 400,
          });
        if (!String(input.full_name || "").trim())
          throw Object.assign(new Error("Full name is required"), {
            status: 400,
          });
        try {
          const result = db
            .prepare(
              "INSERT INTO users(username,email,full_name,phone,password_hash,pin_hash,auth_method,role) VALUES (?,?,?,?,?,?, 'pin','USER')",
            )
            .run(
              input.username.trim(),
              input.email?.trim() || null,
              input.full_name.trim(),
              input.phone?.trim() || null,
              hashPassword(input.pin),
              hashPassword(input.pin),
            );
          const session = createSession(db, Number(result.lastInsertRowid));
          return json(
            response,
            201,
            {
              user: publicUser(
                db
                  .prepare("SELECT * FROM users WHERE id=?")
                  .get(result.lastInsertRowid),
              ),
              csrf_token: session.csrf,
            },
            {
              "Set-Cookie": `jobquest_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
            },
          );
        } catch (error) {
          if (String(error.message).includes("UNIQUE"))
            throw Object.assign(
              new Error("Username or email is already registered"),
              { status: 409 },
            );
          throw error;
        }
      }
      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const input = await body(request),
          user = db
            .prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE")
            .get(String(input.username || ""));
        const locked =
          user?.locked_until &&
          Date.parse(`${user.locked_until}Z`) > Date.now();
        if (
          !user ||
          !user.is_active ||
          locked ||
          !/^\d{4}$/.test(String(input.pin || "")) ||
          !user.pin_hash ||
          !verifyPassword(String(input.pin), user.pin_hash)
        ) {
          if (user && !locked)
            db.prepare(
              "UPDATE users SET failed_login_count=failed_login_count+1,locked_until=CASE WHEN failed_login_count+1>=? THEN datetime('now',?) ELSE locked_until END WHERE id=?",
            ).run(LOCKOUT_ATTEMPTS, `+${LOCKOUT_MINUTES} minutes`, user.id);
          throw Object.assign(new Error("Invalid username or PIN"), {
            status: 401,
          });
        }
        db.prepare(
          "UPDATE users SET failed_login_count=0,locked_until=NULL WHERE id=?",
        ).run(user.id);
        const session = createSession(db, user.id);
        return json(
          response,
          200,
          { user: publicUser(user), csrf_token: session.csrf },
          {
            "Set-Cookie": `jobquest_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
          },
        );
      }
      if (
        url.pathname === "/api/auth/transition-pin" &&
        request.method === "POST"
      ) {
        const input = await body(request),
          user = db
            .prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE")
            .get(String(input.username || "")),
          locked =
            user?.locked_until &&
            Date.parse(`${user.locked_until}Z`) > Date.now(),
          validPin =
            /^\d{4}$/.test(String(input.pin || "")) &&
            input.pin === input.confirm_pin,
          validLegacy =
            user &&
            user.auth_method === "legacy_password" &&
            verifyPassword(
              String(input.current_password || ""),
              user.password_hash,
            );
        if (!user || !user.is_active || locked || !validPin || !validLegacy) {
          if (user && !locked)
            db.prepare(
              "UPDATE users SET failed_login_count=failed_login_count+1,locked_until=CASE WHEN failed_login_count+1>=? THEN datetime('now',?) ELSE locked_until END WHERE id=?",
            ).run(LOCKOUT_ATTEMPTS, `+${LOCKOUT_MINUTES} minutes`, user.id);
          throw Object.assign(new Error("Unable to update credentials"), {
            status: 401,
          });
        }
        db.prepare(
          "UPDATE users SET pin_hash=?,auth_method='pin',failed_login_count=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(hashPassword(input.pin), user.id);
        const session = createSession(db, user.id);
        return json(
          response,
          200,
          { user: publicUser(user), csrf_token: session.csrf },
          {
            "Set-Cookie": `jobquest_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
          },
        );
      }
      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        requireAuth(context, { csrf: true });
        const token = cookies(request).jobquest_session;
        db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
          tokenHash(token),
        );
        return json(
          response,
          200,
          { message: "Signed out" },
          {
            "Set-Cookie":
              "jobquest_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
          },
        );
      }
      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        const actor = requireAuth(context);
        return json(response, 200, {
          user: publicUser(actor),
          csrf_token: actor.csrf_token,
        });
      }
      if (
        await handleFeatureUpgrade(context, {
          json,
          body,
          requireAuth,
          targetOwner,
        })
      )
        return;
      if (
        await handleAdvanced(context, { json, body, requireAuth, targetOwner })
      )
        return;
      if (url.pathname === "/api/applications" && request.method === "GET")
        return json(
          response,
          200,
          listApplications(
            db,
            requireAuth(context),
            Object.fromEntries(url.searchParams),
          ),
        );
      if (url.pathname === "/api/applications" && request.method === "POST") {
        const actor = requireAuth(context, { csrf: true }),
          input = await body(request),
          owner = targetOwner(db, actor, input),
          payload = { ...input };
        delete payload.target_user_id;
        const result = createApplication(db, owner, actor.id, payload);
        return json(response, result.errors ? 400 : 201, result);
      }
      const appMatch = url.pathname.match(
        /^\/api\/applications\/(\d+)(?:\/(stage|activity))?$/,
      );
      if (appMatch) {
        const actor = requireAuth(context, { csrf: request.method !== "GET" }),
          app = ownedApplication(db, actor, Number(appMatch[1]));
        if (!app) throw Object.assign(new Error("Not found"), { status: 404 });
        if (appMatch[2] === "activity" && request.method === "GET")
          return json(
            response,
            200,
            rows(
              db.prepare(
                "SELECT * FROM activities WHERE application_id=? ORDER BY created_at DESC,id DESC",
              ),
              [app.id],
            ),
          );
        if (appMatch[2] === "stage" && request.method === "PATCH") {
          const result = changeStage(
            db,
            app,
            actor.id,
            (await body(request)).stage,
          );
          return json(response, result.errors ? 400 : 200, result);
        }
        if (!appMatch[2] && request.method === "GET")
          return json(response, 200, { ...app });
        if (!appMatch[2] && request.method === "PATCH") {
          const result = updateApplication(
            db,
            app,
            actor.id,
            await body(request),
          );
          return json(response, result.errors ? 400 : 200, result);
        }
        if (!appMatch[2] && request.method === "DELETE") {
          db.prepare("DELETE FROM applications WHERE id=?").run(app.id);
          return json(response, 200, { message: "Application deleted" });
        }
      }
      if (url.pathname === "/api/import/preview" && request.method === "POST") {
        const actor = requireAuth(context, { csrf: true }),
          input = await body(request),
          owner = targetOwner(db, actor, input);
        return json(response, 200, {
          rows: previewImport(db, owner, input.format, input.text),
        });
      }
      if (url.pathname === "/api/import" && request.method === "POST") {
        const actor = requireAuth(context, { csrf: true }),
          input = await body(request),
          owner = targetOwner(db, actor, input);
        return json(response, 201, executeImport(db, owner, actor.id, input));
      }
      if (url.pathname === "/api/import/history" && request.method === "GET") {
        const actor = requireAuth(context),
          items =
            actor.role === "MANAGER"
              ? rows(
                  db.prepare(
                    "SELECT b.*,u.username owner_username FROM import_batches b JOIN users u ON u.id=b.user_id ORDER BY b.id DESC LIMIT 100",
                  ),
                )
              : rows(
                  db.prepare(
                    "SELECT * FROM import_batches WHERE user_id=? ORDER BY id DESC LIMIT 100",
                  ),
                  [actor.id],
                );
        return json(response, 200, items);
      }
      if (url.pathname === "/api/dashboard" && request.method === "GET")
        return json(response, 200, dashboard(db, requireAuth(context).id));
      if (
        url.pathname === "/api/manager/dashboard" &&
        request.method === "GET"
      ) {
        const actor = requireAuth(context, { manager: true }),
          userId = Number(url.searchParams.get("user_id"));
        if (userId) return json(response, 200, dashboard(db, userId));
        const users = db
          .prepare(
            "SELECT count(*) total,sum(is_active=1) active,sum(is_active=0) inactive FROM users",
          )
          .get();
        const applications = db
          .prepare(
            "SELECT count(*) total,sum(date_applied=date('now')) today,sum(stage='Offer') offers,sum(stage='Accepted') acceptances FROM applications",
          )
          .get();
        const byUser = rows(
          db.prepare(
            "SELECT u.id,u.username,u.full_name,count(a.id) applications FROM users u LEFT JOIN applications a ON a.user_id=u.id GROUP BY u.id ORDER BY applications DESC",
          ),
        );
        return json(response, 200, {
          users,
          applications,
          applications_by_user: byUser,
          recent_imports: rows(
            db.prepare(
              "SELECT * FROM import_batches ORDER BY id DESC LIMIT 10",
            ),
          ),
          actor: publicUser(actor),
        });
      }
      if (url.pathname === "/api/manager/users" && request.method === "GET") {
        requireAuth(context, { manager: true });
        const search = `%${url.searchParams.get("search") || ""}%`;
        return json(
          response,
          200,
          rows(
            db.prepare(
              "SELECT u.id,u.username,u.email,u.full_name,u.phone,u.role,u.is_active,u.created_at,count(distinct a.id) application_count,count(distinct i.id) interview_count,count(distinct f.id) follow_up_count,max(ac.created_at) last_activity FROM users u LEFT JOIN applications a ON a.user_id=u.id LEFT JOIN interviews i ON i.user_id=u.id LEFT JOIN follow_ups f ON f.user_id=u.id LEFT JOIN activities ac ON ac.user_id=u.id WHERE u.username LIKE ? OR u.full_name LIKE ? OR coalesce(u.email,'') LIKE ? GROUP BY u.id ORDER BY u.created_at DESC",
            ),
            [search, search, search],
          ),
        );
      }
      const userMatch = url.pathname.match(/^\/api\/manager\/users\/(\d+)$/);
      if (userMatch && request.method === "PATCH") {
        const actor = requireAuth(context, { manager: true, csrf: true }),
          input = await body(request),
          id = Number(userMatch[1]),
          current = db.prepare("SELECT * FROM users WHERE id=?").get(id);
        if (!current)
          throw Object.assign(new Error("Not found"), { status: 404 });
        const managerCount = db
          .prepare(
            "SELECT count(*) count FROM users WHERE role='MANAGER' AND is_active=1",
          )
          .get().count;
        if (
          current.role === "MANAGER" &&
          current.is_active &&
          managerCount === 1 &&
          (input.role === "USER" ||
            input.is_active === false ||
            input.is_active === 0)
        )
          throw Object.assign(
            new Error(
              "The only active manager cannot be demoted or deactivated",
            ),
            { status: 400 },
          );
        if (input.role && !["USER", "MANAGER"].includes(input.role))
          throw Object.assign(new Error("Invalid role"), { status: 400 });
        db.prepare(
          "UPDATE users SET role=coalesce(?,role),is_active=coalesce(?,is_active),updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(
          input.role || null,
          input.is_active == null ? null : Number(Boolean(input.is_active)),
          id,
        );
        db.prepare(
          "INSERT INTO audit_log(user_id,actor_user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?)",
        ).run(
          id,
          actor.id,
          "user_updated",
          "user",
          id,
          JSON.stringify({ role: input.role, is_active: input.is_active }),
        );
        return json(response, 200, {
          user: publicUser(
            db.prepare("SELECT * FROM users WHERE id=?").get(id),
          ),
        });
      }
      const trackerMatch = url.pathname.match(
        /^\/api\/(interviews|rejections|follow_ups|networking_contacts|daily_goals|weekly_goals)(?:\/(\d+))?$/,
      );
      if (trackerMatch) {
        const table = trackerMatch[1],
          id = Number(trackerMatch[2]);
        if (!id && request.method === "GET")
          return json(
            response,
            200,
            listTracker(
              db,
              requireAuth(context),
              table,
              Object.fromEntries(url.searchParams),
            ),
          );
        if (!id && request.method === "POST") {
          const actor = requireAuth(context, { csrf: true });
          return json(response, 201, {
            id: createTracker(db, actor, table, await body(request)),
          });
        }
        if (id && request.method === "PATCH") {
          const actor = requireAuth(context, { csrf: true });
          return json(response, 200, {
            id: updateTracker(db, actor, table, id, await body(request)),
          });
        }
        if (id && request.method === "DELETE") {
          const actor = requireAuth(context, { csrf: true }),
            record =
              actor.role === "MANAGER"
                ? db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id)
                : db
                    .prepare(`SELECT id FROM ${table} WHERE id=? AND user_id=?`)
                    .get(id, actor.id);
          if (!record)
            throw Object.assign(new Error("Not found"), { status: 404 });
          db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
          return json(response, 200, { message: "Deleted" });
        }
      }
      if (url.pathname.startsWith("/api/"))
        throw Object.assign(new Error("Not found"), { status: 404 });
      const requested =
        url.pathname === "/"
          ? "index.html"
          : normalize(url.pathname).replace(/^([/\\])+/, "");
      if (requested.includes(".."))
        throw Object.assign(new Error("Not found"), { status: 404 });
      try {
        const data = await readFile(join(frontendDir, requested));
        const types = {
          ".html": "text/html",
          ".css": "text/css",
          ".js": "text/javascript",
          ".svg": "image/svg+xml",
        };
        response.writeHead(200, {
          "Content-Type": `${types[extname(requested)] || "application/octet-stream"}; charset=utf-8`,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy":
            "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
        });
        response.end(data);
      } catch {
        const data = await readFile(join(frontendDir, "index.html"));
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(data);
      }
    } catch (error) {
      const status =
        error.status ||
        (String(error.message).includes("UNIQUE") ||
        String(error.message).includes("CHECK constraint")
          ? 400
          : 500);
      if (status === 500) console.error(error);
      json(response, status, {
        error: status === 500 ? "An unexpected error occurred" : error.message,
      });
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDatabase();
  const server = createServer(createRequestHandler({ db }));
  const port = Number(process.env.PORT || 3000);
  server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(
      `JobQuest running at http://${process.env.HOST || "127.0.0.1"}:${port}`,
    ),
  );
  const shutdown = () =>
    server.close(() => {
      db.close();
      process.exit(0);
    });
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
