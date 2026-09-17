import { rows } from "./db.js";

export const NOTE_TYPES = [
  "general",
  "daily_journal",
  "interview",
  "company_research",
  "reflection",
];
const NOTE_FIELDS = [
  "title",
  "body",
  "note_type",
  "application_id",
  "entry_date",
  "pinned",
];
const forbidden = new Set([
  "user_id",
  "userid",
  "owner_id",
  "ownerid",
  "id",
  "created_at",
  "updated_at",
  "role",
  "is_manager",
]);
const PREVIEW_LENGTH = 160;
const TITLE_MAX = 200;
const BODY_MAX = 20_000;

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
const isDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

// Pure and exported for unit testing. Never renders the full body in a list -
// see docs/FEATURE_UPGRADE_9.md Performance/Note Previews.
export function notePreview(body, length = PREVIEW_LENGTH) {
  const text = String(body || "").trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}

export function validateNote(input, { partial = false } = {}) {
  const data = {};
  const errors = [];
  for (const [rawKey, rawValue] of Object.entries(input || {})) {
    const lower = rawKey.toLowerCase();
    if (forbidden.has(lower)) {
      errors.push(`${rawKey} is not allowed`);
      continue;
    }
    if (!NOTE_FIELDS.includes(lower)) {
      errors.push(`Unknown field: ${rawKey}`);
      continue;
    }
    data[lower] = typeof rawValue === "string" ? rawValue.trim() : rawValue;
  }
  if (data.title !== undefined) {
    data.title = String(data.title ?? "").trim();
    if (data.title.length > TITLE_MAX)
      errors.push(`Title must be ${TITLE_MAX} characters or fewer`);
    if (!data.title) data.title = null;
  }
  if (data.body !== undefined) {
    data.body = String(data.body ?? "");
    if (data.body.length > BODY_MAX)
      errors.push(`Body must be ${BODY_MAX} characters or fewer`);
  }
  // A note needs at least a title or some body text. For a full create this can
  // be checked here; a partial update must be checked by the caller against the
  // merged (existing + incoming) record, since either field alone may be absent
  // from this particular PATCH body.
  if (!partial) {
    const title = data.title ?? null;
    const body = (data.body ?? "").trim();
    if (!title && !body) errors.push("Enter a title or some body text");
  }
  if (data.note_type !== undefined && !NOTE_TYPES.includes(data.note_type))
    errors.push(`Unsupported note_type: ${data.note_type}`);
  if (!partial) data.note_type ??= "general";
  if (data.entry_date === "") data.entry_date = null;
  if (data.entry_date != null && !isDate(data.entry_date))
    errors.push("entry_date must be YYYY-MM-DD");
  if (data.application_id === "") data.application_id = null;
  if (data.application_id != null) {
    data.application_id = Number(data.application_id);
    if (!Number.isSafeInteger(data.application_id) || data.application_id < 1)
      errors.push("application_id must be a positive integer");
  }
  if (data.pinned !== undefined)
    data.pinned = [true, 1, "1", "true", "yes"].includes(data.pinned) ? 1 : 0;
  return { data, errors };
}

function applicationOwner(db, applicationId) {
  return db
    .prepare("SELECT user_id FROM applications WHERE id=?")
    .get(applicationId)?.user_id;
}

function fullNote(db, id) {
  return db
    .prepare(
      "SELECT n.*,a.company application_company,a.job_title application_job_title FROM notes n LEFT JOIN applications a ON a.id=n.application_id WHERE n.id=?",
    )
    .get(id);
}

function listNotes(db, actor, query) {
  const owner =
    actor.role === "MANAGER" && query.user_id
      ? Number(query.user_id)
      : actor.id;
  const where = ["n.user_id=?"];
  const params = [owner];
  if (query.type) {
    where.push("n.note_type=?");
    params.push(query.type);
  }
  if (query.application_id) {
    where.push("n.application_id=?");
    params.push(Number(query.application_id));
  }
  if (query.pinned === "true") where.push("n.pinned=1");
  else if (query.pinned === "false") where.push("n.pinned=0");
  const search = (query.search || "").trim();
  if (search) {
    where.push(
      "(lower(coalesce(n.title,'')) LIKE lower(?) OR lower(coalesce(n.body,'')) LIKE lower(?))",
    );
    const like = `%${search}%`;
    params.push(like, like);
  }
  const items = rows(
    db.prepare(
      `SELECT n.*,a.company application_company,a.job_title application_job_title FROM notes n LEFT JOIN applications a ON a.id=n.application_id WHERE ${where.join(" AND ")} ORDER BY n.pinned DESC,n.updated_at DESC LIMIT 100`,
    ),
    params,
  );
  return items.map(({ body, ...rest }) => ({
    ...rest,
    body_preview: notePreview(body),
  }));
}

function ownedNote(db, actor, id) {
  const record =
    actor.role === "MANAGER"
      ? db.prepare("SELECT * FROM notes WHERE id=?").get(id)
      : db.prepare("SELECT * FROM notes WHERE id=? AND user_id=?").get(id, actor.id);
  if (!record) fail("Not found", 404);
  return record;
}

export async function handleNotes(context, helpers) {
  const { db, request, response, url } = context;
  const { json, body, requireAuth, targetOwner } = helpers;
  const path = url.pathname;

  if (path === "/api/notes" && request.method === "GET") {
    const actor = requireAuth(context);
    return (
      json(
        response,
        200,
        listNotes(db, actor, Object.fromEntries(url.searchParams)),
      ),
      true
    );
  }

  if (path === "/api/notes" && request.method === "POST") {
    const actor = requireAuth(context, { csrf: true }),
      input = await body(request),
      owner = targetOwner(db, actor, input),
      { data, errors } = validateNote(input);
    if (data.application_id) {
      const appOwner = applicationOwner(db, data.application_id);
      if (appOwner == null) errors.push("Linked application was not found");
      else if (appOwner !== owner)
        errors.push("Linked application must belong to the same owner");
    }
    if (errors.length) return (json(response, 400, { errors }), true);
    const result = db
      .prepare(
        "INSERT INTO notes(user_id,application_id,title,body,note_type,entry_date,pinned) VALUES (?,?,?,?,?,?,?)",
      )
      .run(
        owner,
        data.application_id || null,
        data.title || null,
        data.body || "",
        data.note_type,
        data.entry_date || null,
        data.pinned ?? 0,
      );
    return (
      json(response, 201, fullNote(db, Number(result.lastInsertRowid))),
      true
    );
  }

  const noteMatch = path.match(/^\/api\/notes\/(\d+)$/);
  if (noteMatch) {
    const actor = requireAuth(context, { csrf: request.method !== "GET" }),
      id = Number(noteMatch[1]),
      note = ownedNote(db, actor, id);

    if (request.method === "GET")
      return (json(response, 200, fullNote(db, id)), true);

    if (request.method === "DELETE") {
      db.prepare("DELETE FROM notes WHERE id=?").run(id);
      return (json(response, 200, { message: "Deleted" }), true);
    }

    if (request.method === "PATCH") {
      const input = await body(request);
      if ("user_id" in input || "target_user_id" in input || "owner_id" in input)
        fail("Ownership cannot be changed");
      const { data, errors } = validateNote(input, { partial: true });
      const mergedTitle = "title" in data ? data.title : note.title;
      const mergedBody = "body" in data ? data.body : note.body;
      if (!mergedTitle && !String(mergedBody || "").trim())
        errors.push("Enter a title or some body text");
      if ("application_id" in data && data.application_id != null) {
        const appOwner = applicationOwner(db, data.application_id);
        if (appOwner == null) errors.push("Linked application was not found");
        else if (appOwner !== note.user_id)
          errors.push("Linked application must belong to the same owner");
      }
      if (errors.length) return (json(response, 400, { errors }), true);
      const fields = Object.keys(data);
      if (fields.length)
        db.prepare(
          `UPDATE notes SET ${fields.map((f) => `${f}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        ).run(...fields.map((f) => data[f]), id);
      return (json(response, 200, fullNote(db, id)), true);
    }
  }

  return false;
}
