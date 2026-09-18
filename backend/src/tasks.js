import { rows } from "./db.js";
import { PRIORITIES } from "./service.js";

export const TASK_RECURRENCES = ["daily", "weekdays", "weekly", "monthly"];
const TASK_FIELDS = [
  "title",
  "notes",
  "priority",
  "due_date",
  "application_id",
  "recurrence",
];
const forbidden = new Set([
  "user_id",
  "userid",
  "owner_id",
  "ownerid",
  "id",
  "created_at",
  "updated_at",
  "completed_at",
  "status",
  "role",
  "is_manager",
]);

const isDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const clean = (value) => (typeof value === "string" ? value.trim() : value);

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

// Validates the "content" fields a client may write directly. `status` is
// deliberately excluded - completion/reopen is a state transition with its
// own side effects (recurrence, completed_at), handled separately in
// handleTasks so it stays idempotent and auditable, not a free-form field.
export function validateTask(input, { partial = false } = {}) {
  const data = {};
  const errors = [];
  for (const [rawKey, rawValue] of Object.entries(input || {})) {
    const lower = rawKey.toLowerCase();
    if (forbidden.has(lower)) {
      errors.push(`${rawKey} is not allowed`);
      continue;
    }
    if (!TASK_FIELDS.includes(lower)) {
      errors.push(`Unknown field: ${rawKey}`);
      continue;
    }
    data[lower] = clean(rawValue);
  }
  if (!partial || "title" in data) {
    data.title = String(data.title || "").trim();
    if (!data.title) errors.push("Title is required");
    else if (data.title.length > 200)
      errors.push("Title must be 200 characters or fewer");
  }
  if (data.notes !== undefined) {
    data.notes = String(data.notes ?? "").trim();
    if (data.notes.length > 4000)
      errors.push("Notes must be 4000 characters or fewer");
    if (!data.notes) data.notes = null;
  }
  if (data.priority && !PRIORITIES.includes(data.priority))
    errors.push(`Unsupported priority: ${data.priority}`);
  if (data.due_date === "") data.due_date = null;
  if (data.due_date != null && !isDate(data.due_date))
    errors.push("Due date must be YYYY-MM-DD");
  if (data.recurrence === "") data.recurrence = null;
  if (data.recurrence != null && !TASK_RECURRENCES.includes(data.recurrence))
    errors.push(`Unsupported recurrence: ${data.recurrence}`);
  if (data.application_id === "") data.application_id = null;
  if (data.application_id != null) {
    data.application_id = Number(data.application_id);
    if (!Number.isSafeInteger(data.application_id) || data.application_id < 1)
      errors.push("application_id must be a positive integer");
  }
  if (!partial) data.priority ??= "Medium";
  return { data, errors };
}

const isoDate = (date = new Date()) => date.toISOString().slice(0, 10);
const addDays = (dateStr, count) => {
  const result = new Date(`${dateStr}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + count);
  return isoDate(result);
};
function addMonthsClamped(dateStr, count) {
  const start = new Date(`${dateStr}T12:00:00Z`);
  const day = start.getUTCDate();
  const target = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + count, 1, 12),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return isoDate(target);
}
function nextWeekday(dateStr) {
  let next = addDays(dateStr, 1);
  while ([0, 6].includes(new Date(`${next}T12:00:00Z`).getUTCDay()))
    next = addDays(next, 1);
  return next;
}
// Pure and exported for unit testing - see backend/test/frontend.test.js.
// "complete current occurrence -> generate the next one" (not pre-generating
// a run of future rows) per docs/FEATURE_UPGRADE_7.md Recurrence Strategy.
export function nextOccurrence(dueDate, recurrence) {
  if (!dueDate || !TASK_RECURRENCES.includes(recurrence)) return null;
  if (recurrence === "daily") return addDays(dueDate, 1);
  if (recurrence === "weekly") return addDays(dueDate, 7);
  if (recurrence === "monthly") return addMonthsClamped(dueDate, 1);
  if (recurrence === "weekdays") return nextWeekday(dueDate);
  return null;
}

// Pure and exported for unit testing. Mirrors the exact SQL predicates used
// by listTasks below, so the two can never silently drift apart.
export function classifyTaskView(task, today = isoDate()) {
  if (task.status === "completed") return "completed";
  if (!task.due_date) return "backlog";
  return task.due_date <= today ? "today" : "upcoming";
}

const PRIORITY_RANK = "CASE priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END";

function listTasks(db, actor, query) {
  const owner =
    actor.role === "MANAGER" && query.user_id
      ? Number(query.user_id)
      : actor.id;
  const today = isoDate();
  const where = ["user_id=?"];
  const params = [owner];
  if (query.application_id) {
    where.push("application_id=?");
    params.push(Number(query.application_id));
  }
  let order;
  const view = query.view || "today";
  if (view === "completed") {
    where.push("status='completed'");
    order = "ORDER BY completed_at DESC LIMIT 100";
  } else if (view === "backlog") {
    where.push("status='open'", "due_date IS NULL");
    order = `ORDER BY ${PRIORITY_RANK}, created_at DESC`;
  } else if (view === "upcoming") {
    where.push("status='open'", "due_date>?");
    params.push(today);
    order = `ORDER BY due_date ASC, ${PRIORITY_RANK}`;
  } else if (view === "all") {
    where.push("status='open'");
    order = `ORDER BY due_date IS NULL, due_date ASC, ${PRIORITY_RANK}`;
  } else {
    where.push("status='open'", "due_date IS NOT NULL", "due_date<=?");
    params.push(today);
    order = `ORDER BY due_date ASC, ${PRIORITY_RANK}`;
  }
  return rows(
    db.prepare(`SELECT * FROM tasks WHERE ${where.join(" AND ")} ${order}`),
    params,
  );
}

function applicationOwner(db, applicationId) {
  return db
    .prepare("SELECT user_id FROM applications WHERE id=?")
    .get(applicationId)?.user_id;
}

function ownedTask(db, actor, id) {
  const record =
    actor.role === "MANAGER"
      ? db.prepare("SELECT * FROM tasks WHERE id=?").get(id)
      : db
          .prepare("SELECT * FROM tasks WHERE id=? AND user_id=?")
          .get(id, actor.id);
  if (!record) fail("Not found", 404);
  return record;
}

export async function handleTasks(context, helpers) {
  const { db, request, response, url } = context;
  const { json, body, requireAuth, targetOwner } = helpers;
  const path = url.pathname;

  if (path === "/api/tasks" && request.method === "GET") {
    const actor = requireAuth(context);
    return (
      json(
        response,
        200,
        listTasks(db, actor, Object.fromEntries(url.searchParams)),
      ),
      true
    );
  }

  if (path === "/api/tasks" && request.method === "POST") {
    const actor = requireAuth(context, { csrf: true }),
      input = await body(request),
      owner = targetOwner(db, actor, input),
      { data, errors } = validateTask(input);
    if (data.recurrence && !data.due_date)
      errors.push("Recurring tasks require a due date");
    if (data.application_id) {
      const appOwner = applicationOwner(db, data.application_id);
      if (appOwner == null) errors.push("Linked application was not found");
      else if (appOwner !== owner)
        errors.push("Linked application must belong to the same owner");
    }
    if (errors.length) return (json(response, 400, { errors }), true);
    const result = db
      .prepare(
        "INSERT INTO tasks(user_id,application_id,title,notes,priority,due_date,recurrence) VALUES (?,?,?,?,?,?,?)",
      )
      .run(
        owner,
        data.application_id || null,
        data.title,
        data.notes || null,
        data.priority,
        data.due_date || null,
        data.recurrence || null,
      );
    const task = db
      .prepare("SELECT * FROM tasks WHERE id=?")
      .get(Number(result.lastInsertRowid));
    return (json(response, 201, task), true);
  }

  const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
  if (taskMatch) {
    const actor = requireAuth(context, { csrf: request.method !== "GET" }),
      id = Number(taskMatch[1]),
      record = ownedTask(db, actor, id);

    if (request.method === "DELETE") {
      db.prepare("DELETE FROM tasks WHERE id=?").run(id);
      return (json(response, 200, { message: "Deleted" }), true);
    }

    if (request.method === "PATCH") {
      const input = await body(request);
      if ("user_id" in input || "target_user_id" in input || "owner_id" in input)
        fail("Ownership cannot be changed");
      let statusChange = null;
      const { status, ...content } = input;
      if (status !== undefined) {
        if (!["open", "completed"].includes(status))
          fail("Unsupported status");
        statusChange = status;
      }
      const { data, errors } = validateTask(content, { partial: true });
      const mergedDueDate = "due_date" in data ? data.due_date : record.due_date;
      const mergedRecurrence =
        "recurrence" in data ? data.recurrence : record.recurrence;
      if (mergedRecurrence && !mergedDueDate)
        errors.push("Recurring tasks require a due date");
      if ("application_id" in data && data.application_id != null) {
        const appOwner = applicationOwner(db, data.application_id);
        if (appOwner == null) errors.push("Linked application was not found");
        else if (appOwner !== record.user_id)
          errors.push("Linked application must belong to the same owner");
      }
      if (errors.length) return (json(response, 400, { errors }), true);

      db.exec("BEGIN");
      try {
        const fields = Object.keys(data);
        if (fields.length)
          db.prepare(
            `UPDATE tasks SET ${fields.map((f) => `${f}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          ).run(...fields.map((f) => data[f]), id);
        let createdNextId = null;
        if (statusChange === "completed" && record.status !== "completed") {
          db.prepare(
            "UPDATE tasks SET status='completed',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          ).run(id);
          const current = db.prepare("SELECT * FROM tasks WHERE id=?").get(id);
          const next = nextOccurrence(current.due_date, current.recurrence);
          if (next)
            createdNextId = Number(
              db
                .prepare(
                  "INSERT INTO tasks(user_id,application_id,title,notes,priority,due_date,recurrence) VALUES (?,?,?,?,?,?,?)",
                )
                .run(
                  current.user_id,
                  current.application_id,
                  current.title,
                  current.notes,
                  current.priority,
                  next,
                  current.recurrence,
                ).lastInsertRowid,
            );
        } else if (statusChange === "open" && record.status !== "open") {
          db.prepare(
            "UPDATE tasks SET status='open',completed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          ).run(id);
        }
        db.exec("COMMIT");
        const updated = db.prepare("SELECT * FROM tasks WHERE id=?").get(id);
        return (
          json(response, 200, { ...updated, created_next_task_id: createdNextId }),
          true
        );
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  }

  return false;
}
