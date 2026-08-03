import { rows } from "./db.js";

export const STAGES = [
  "Saved",
  "Preparing",
  "Applied",
  "Assessment",
  "Recruiter Screen",
  "Interview",
  "Final Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Ghosted",
  "Position Closed",
  "Accepted",
];
export const PRIORITIES = ["Low", "Medium", "High"];
export const WORK_ARRANGEMENTS = ["Remote", "Hybrid", "Onsite"];
export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Temporary",
  "Other",
];
export const IMPORT_MODES = ["valid_rows_only", "all_or_nothing"];
export const DUPLICATE_ACTIONS = ["skip", "import_anyway", "update_existing"];

export const APPLICATION_FIELDS = [
  "company",
  "job_title",
  "job_url",
  "location",
  "work_arrangement",
  "employment_type",
  "date_applied",
  "source",
  "stage",
  "priority",
  "salary_min",
  "salary_max",
  "salary_currency",
  "salary_range",
  "resume_version",
  "cover_letter_version",
  "recruiter_name",
  "recruiter_email",
  "recruiter_phone",
  "job_description",
  "notes",
  "next_action",
  "next_action_date",
  "last_response_date",
  "external_job_id",
  "resume_id",
  "pinned",
  "important",
  "favorite",
];
const aliases = {
  company_name: "company",
  title: "job_title",
  role: "job_title",
  application_status: "stage",
  status: "stage",
  application_stage: "stage",
  applied_date: "date_applied",
  date: "date_applied",
  url: "job_url",
  job_link: "job_url",
  work_type: "work_arrangement",
  resume: "resume_version",
  cover_letter: "cover_letter_version",
};
const forbidden = new Set([
  "user_id",
  "userid",
  "owner_id",
  "ownerid",
  "created_by",
  "createdby",
  "updated_by",
  "updatedby",
  "role",
  "is_manager",
]);

const isDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const clean = (value) => (typeof value === "string" ? value.trim() : value);

export function validateApplication(input, { partial = false } = {}) {
  const data = {};
  const errors = [];
  for (const [rawKey, rawValue] of Object.entries(input || {})) {
    const lower = rawKey.toLowerCase();
    if (forbidden.has(lower)) {
      errors.push(`${rawKey} is not allowed`);
      continue;
    }
    const key = aliases[lower] || lower;
    if (key === "tags") {
      data.tags = Array.isArray(rawValue)
        ? rawValue
        : String(rawValue || "").split(",");
      continue;
    }
    if (!APPLICATION_FIELDS.includes(key)) {
      errors.push(`Unknown field: ${rawKey}`);
      continue;
    }
    data[key] = clean(rawValue);
  }
  if (!partial || "company" in data)
    if (!data.company) errors.push("Company is required");
  if (!partial || "job_title" in data)
    if (!data.job_title) errors.push("Job title is required");
  if (!partial || "date_applied" in data)
    if (!isDate(data.date_applied))
      errors.push("Date applied must be YYYY-MM-DD");
  for (const field of ["next_action_date", "last_response_date"])
    if (data[field] && !isDate(data[field]))
      errors.push(`${field} must be YYYY-MM-DD`);
  if (data.stage && !STAGES.includes(data.stage))
    errors.push(`Unsupported stage: ${data.stage}`);
  if (data.priority && !PRIORITIES.includes(data.priority))
    errors.push(`Unsupported priority: ${data.priority}`);
  if (
    data.work_arrangement &&
    !WORK_ARRANGEMENTS.includes(data.work_arrangement)
  )
    errors.push(`Unsupported work arrangement: ${data.work_arrangement}`);
  if (data.employment_type && !EMPLOYMENT_TYPES.includes(data.employment_type))
    errors.push(`Unsupported employment type: ${data.employment_type}`);
  if (data.job_url) {
    try {
      new URL(data.job_url);
    } catch {
      errors.push("Job URL must be a valid URL");
    }
  }
  if (
    data.recruiter_email &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.recruiter_email)
  )
    errors.push("Recruiter email is invalid");
  for (const field of ["salary_min", "salary_max"])
    if (data[field] !== undefined && data[field] !== "") {
      data[field] = Number(data[field]);
      if (!Number.isFinite(data[field]) || data[field] < 0)
        errors.push(`${field} must be a non-negative number`);
    }
  if (
    data.salary_min != null &&
    data.salary_max != null &&
    data.salary_min > data.salary_max
  )
    errors.push("salary_min cannot exceed salary_max");
  for (const field of ["pinned", "important", "favorite"])
    if (field in data)
      data[field] = [true, 1, "1", "true", "yes"].includes(data[field]) ? 1 : 0;
  if (data.resume_id !== undefined && data.resume_id !== "")
    data.resume_id = Number(data.resume_id);
  data.stage ??= "Applied";
  data.priority ??= "Medium";
  return { data, errors };
}

export function parseBulk(format, text) {
  if (!String(text || "").trim()) throw new Error("Input is required");
  if (format === "json") {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Input is not valid JSON");
    }
    if (!Array.isArray(parsed) || !parsed.length)
      throw new Error("JSON input must be a non-empty array");
    if (
      parsed.some(
        (item) => !item || Array.isArray(item) || typeof item !== "object",
      )
    )
      throw new Error("Every JSON row must be an object");
    return parsed;
  }
  if (format !== "structured_text") throw new Error("Unsupported input format");
  return text
    .split(/^\s*---\s*$/m)
    .map((block, index) => {
      const item = {};
      for (const line of block.split(/\r?\n/).filter((value) => value.trim())) {
        const colon = line.indexOf(":");
        if (colon < 1)
          throw new Error(`Row ${index + 1}: malformed line: ${line}`);
        item[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
      }
      return item;
    })
    .filter((item) => Object.keys(item).length);
}

function duplicate(db, userId, data) {
  const normalizedUrl = data.job_url?.replace(/\/+$/, "") || null;
  return db
    .prepare(
      `SELECT * FROM applications WHERE user_id=? AND lower(trim(company))=lower(trim(?)) AND lower(trim(job_title))=lower(trim(?)) AND date_applied=? AND (? IS NULL OR rtrim(coalesce(job_url,''),'/')=?) LIMIT 1`,
    )
    .get(
      userId,
      data.company,
      data.job_title,
      data.date_applied,
      normalizedUrl,
      normalizedUrl,
    );
}

export function previewImport(db, userId, format, text) {
  const parsed = parseBulk(format, text);
  return parsed.map((item, index) => {
    const { data, errors } = validateApplication(item);
    const match = errors.length ? null : duplicate(db, userId, data);
    return {
      row_number: index + 1,
      data,
      errors,
      valid: !errors.length,
      duplicate: Boolean(match),
      duplicate_id: match?.id || null,
      result: errors.length
        ? "Invalid"
        : match
          ? "Possible duplicate"
          : "Valid",
    };
  });
}

function insertApplication(db, userId, actorId, data) {
  if (
    data.resume_id &&
    !db
      .prepare("SELECT 1 FROM resumes WHERE id=? AND user_id=?")
      .get(data.resume_id, userId)
  )
    throw Object.assign(
      new Error("Selected resume does not belong to the application owner"),
      { status: 400 },
    );
  const fields = APPLICATION_FIELDS.filter(
    (field) => data[field] !== undefined,
  );
  const result = db
    .prepare(
      `INSERT INTO applications (user_id,created_by,updated_by,${fields.join(",")}) VALUES (?,?,?,${fields.map(() => "?").join(",")})`,
    )
    .run(
      userId,
      actorId,
      actorId,
      ...fields.map((field) => (data[field] === "" ? null : data[field])),
    );
  db.prepare(
    "INSERT INTO activities(application_id,user_id,actor_user_id,activity_type,note) VALUES (?,?,?,?,?)",
  ).run(
    result.lastInsertRowid,
    userId,
    actorId,
    "application_created",
    `Added ${data.job_title} at ${data.company}`,
  );
  db.prepare(
    "INSERT INTO stage_history(application_id,user_id,actor_user_id,previous_stage,new_stage,entered_at,note) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?)",
  ).run(
    result.lastInsertRowid,
    userId,
    actorId,
    null,
    data.stage,
    "Application created",
  );
  db.prepare(
    "INSERT INTO timeline_events(application_id,user_id,actor_user_id,event_date,event_time,category,event_type,stage,title,description,source) VALUES (?,?,?,date('now'),time('now'),'application','application_created',?,?,?,'automatic')",
  ).run(
    result.lastInsertRowid,
    userId,
    actorId,
    data.stage,
    "Application created",
    `${data.job_title} at ${data.company}`,
  );
  const defaults = [
    "Resume tailored",
    "Correct resume selected",
    "Cover letter included",
    "Application submitted",
    "Recruiter identified",
    "Recruiter contacted",
    "Follow-up sent",
    "Assessment completed",
    "Interview prepared",
    "Thank-you note sent",
    "References prepared",
  ];
  const addChecklist = db.prepare(
    "INSERT INTO checklist_items(application_id,user_id,label,is_custom,position) VALUES (?,?,?,0,?)",
  );
  defaults.forEach((label, position) =>
    addChecklist.run(result.lastInsertRowid, userId, label, position),
  );
  setApplicationTags(db, Number(result.lastInsertRowid), userId, data.tags);
  return Number(result.lastInsertRowid);
}

function setApplicationTags(db, applicationId, userId, names) {
  if (!names) return;
  db.prepare("DELETE FROM application_tags WHERE application_id=?").run(
    applicationId,
  );
  const addTag = db.prepare(
    "INSERT INTO tags(user_id,name) VALUES (?,?) ON CONFLICT(user_id,name) DO UPDATE SET archived_at=NULL RETURNING id",
  );
  const link = db.prepare(
    "INSERT INTO application_tags(application_id,tag_id,user_id) VALUES (?,?,?)",
  );
  for (const raw of names) {
    const name = String(raw).trim();
    if (!name) continue;
    const tag = addTag.get(userId, name);
    link.run(applicationId, tag.id, userId);
  }
}

export function createApplication(db, userId, actorId, input) {
  const checked = validateApplication(input);
  if (checked.errors.length) return { errors: checked.errors };
  const match = duplicate(db, userId, checked.data);
  if (match)
    return {
      errors: ["Possible duplicate application"],
      duplicate_id: match.id,
    };
  return { id: insertApplication(db, userId, actorId, checked.data) };
}

export function updateApplication(db, application, actorId, input) {
  const checked = validateApplication(input, { partial: true });
  if (checked.errors.length) return { errors: checked.errors };
  if (
    checked.data.resume_id &&
    !db
      .prepare("SELECT 1 FROM resumes WHERE id=? AND user_id=?")
      .get(checked.data.resume_id, application.user_id)
  )
    return {
      errors: ["Selected resume does not belong to the application owner"],
    };
  const fields = Object.keys(checked.data).filter(
    (field) => APPLICATION_FIELDS.includes(field) && field !== "stage",
  );
  if (fields.length)
    db.prepare(
      `UPDATE applications SET ${fields.map((field) => `${field}=?`).join(",")}, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).run(
      ...fields.map((field) =>
        checked.data[field] === "" ? null : checked.data[field],
      ),
      actorId,
      application.id,
    );
  if (input.stage && input.stage !== application.stage)
    changeStage(db, application, actorId, input.stage);
  else {
    db.prepare(
      "INSERT INTO activities(application_id,user_id,actor_user_id,activity_type,note) VALUES (?,?,?,?,?)",
    ).run(
      application.id,
      application.user_id,
      actorId,
      "application_updated",
      "Application details updated",
    );
    const resumeChanged =
      checked.data.resume_id !== undefined &&
      Number(checked.data.resume_id || 0) !==
        Number(application.resume_id || 0);
    db.prepare(
      "INSERT INTO timeline_events(application_id,user_id,actor_user_id,event_date,event_time,category,event_type,stage,title,description,source) VALUES (?,?,?,date('now'),time('now'),?,?,?,?,?,'automatic')",
    ).run(
      application.id,
      application.user_id,
      actorId,
      resumeChanged ? "resume" : "application",
      resumeChanged ? "resume_changed" : "application_updated",
      application.stage,
      resumeChanged ? "Resume changed" : "Application updated",
      "Application details were updated",
    );
  }
  setApplicationTags(
    db,
    application.id,
    application.user_id,
    checked.data.tags,
  );
  return { id: application.id };
}

export function changeStage(db, application, actorId, stage) {
  if (!STAGES.includes(stage))
    return { errors: [`Unsupported stage: ${stage}`] };
  db.prepare(
    "UPDATE applications SET stage=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).run(stage, actorId, application.id);
  db.prepare(
    "INSERT INTO activities(application_id,user_id,actor_user_id,activity_type,previous_stage,new_stage,note) VALUES (?,?,?,?,?,?,?)",
  ).run(
    application.id,
    application.user_id,
    actorId,
    "stage_changed",
    application.stage,
    stage,
    `Stage changed from ${application.stage} to ${stage}`,
  );
  db.prepare(
    "UPDATE stage_history SET left_at=CURRENT_TIMESTAMP WHERE application_id=? AND left_at IS NULL",
  ).run(application.id);
  db.prepare(
    "INSERT INTO stage_history(application_id,user_id,actor_user_id,previous_stage,new_stage,entered_at,note) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,?)",
  ).run(
    application.id,
    application.user_id,
    actorId,
    application.stage,
    stage,
    `Stage changed from ${application.stage} to ${stage}`,
  );
  db.prepare(
    "INSERT INTO timeline_events(application_id,user_id,actor_user_id,event_date,event_time,category,event_type,stage,title,description,source) VALUES (?,?,?,date('now'),time('now'),'stage','stage_changed',?,?,?,'automatic')",
  ).run(
    application.id,
    application.user_id,
    actorId,
    stage,
    `Stage: ${stage}`,
    `Moved from ${application.stage} to ${stage}`,
  );
  return { id: application.id, previous_stage: application.stage, stage };
}

export function listApplications(db, actor, query) {
  const where = [],
    params = [];
  if (actor.role !== "MANAGER") {
    where.push("a.user_id=?");
    params.push(actor.id);
  } else if (query.user_id) {
    where.push("a.user_id=?");
    params.push(Number(query.user_id));
  }
  if (query.stage) {
    where.push("a.stage=?");
    params.push(query.stage);
  }
  if (query.priority) {
    where.push("a.priority=?");
    params.push(query.priority);
  }
  if (query.archived === "true") where.push("a.archived_at IS NOT NULL");
  else if (query.archived !== "all") where.push("a.archived_at IS NULL");
  if (query.pinned === "true") where.push("a.pinned=1");
  if (query.source) {
    where.push("a.source=?");
    params.push(query.source);
  }
  if (query.work_arrangement) {
    where.push("a.work_arrangement=?");
    params.push(query.work_arrangement);
  }
  if (query.employment_type) {
    where.push("a.employment_type=?");
    params.push(query.employment_type);
  }
  if (query.date_from) {
    where.push("a.date_applied>=?");
    params.push(query.date_from);
  }
  if (query.date_to) {
    where.push("a.date_applied<=?");
    params.push(query.date_to);
  }
  if (query.tag_id) {
    where.push(
      "EXISTS(SELECT 1 FROM application_tags at WHERE at.application_id=a.id AND at.tag_id=?)",
    );
    params.push(Number(query.tag_id));
  }
  if (query.search) {
    where.push("(a.company LIKE ? OR a.job_title LIKE ? OR a.location LIKE ?)");
    params.push(...Array(3).fill(`%${query.search}%`));
  }
  const allowedSort = new Set([
    "date_applied",
    "company",
    "job_title",
    "stage",
    "priority",
    "updated_at",
  ]);
  const sort = allowedSort.has(query.sort) ? query.sort : "date_applied";
  const direction = query.direction === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, Number(query.page) || 1),
    pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20));
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = db
    .prepare(`SELECT count(*) count FROM applications a ${clause}`)
    .get(...params).count;
  const items = rows(
    db.prepare(
      `SELECT a.*,u.username owner_username,CAST(julianday('now')-julianday(COALESCE((SELECT max(event_date) FROM timeline_events te WHERE te.application_id=a.id),a.date_applied)) AS INTEGER) days_inactive,(SELECT group_concat(t.name,', ') FROM application_tags at JOIN tags t ON t.id=at.tag_id WHERE at.application_id=a.id) tags FROM applications a JOIN users u ON u.id=a.user_id ${clause} ORDER BY a.pinned DESC,a.${sort} ${direction},a.id DESC LIMIT ? OFFSET ?`,
    ),
    [...params, pageSize, (page - 1) * pageSize],
  );
  return {
    items,
    total,
    page,
    page_size: pageSize,
    pages: Math.ceil(total / pageSize),
  };
}

export function ownedApplication(db, actor, id) {
  return actor.role === "MANAGER"
    ? db.prepare("SELECT * FROM applications WHERE id=?").get(id)
    : db
        .prepare("SELECT * FROM applications WHERE id=? AND user_id=?")
        .get(id, actor.id);
}

export function executeImport(db, userId, actorId, options) {
  if (!IMPORT_MODES.includes(options.import_mode))
    throw new Error("Unsupported import mode");
  if (!DUPLICATE_ACTIONS.includes(options.duplicate_action))
    throw new Error("Unsupported duplicate action");
  const preview = previewImport(db, userId, options.format, options.text);
  const invalid = preview.filter((row) => !row.valid);
  const batch = {
    total_rows: preview.length,
    valid_rows: preview.length - invalid.length,
    invalid_rows: invalid.length,
    duplicate_rows: preview.filter((row) => row.duplicate).length,
    created_rows: 0,
    updated_rows: 0,
    skipped_rows: 0,
    rejected_rows: invalid.length,
    created_application_ids: [],
    row_errors: invalid.map((row) => ({
      row_number: row.row_number,
      errors: row.errors,
    })),
  };
  db.exec("BEGIN");
  try {
    const batchResult = db
      .prepare(
        "INSERT INTO import_batches(user_id,actor_user_id,input_format,import_mode,duplicate_action,total_rows,valid_rows,invalid_rows,duplicate_rows,status) VALUES (?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        userId,
        actorId,
        options.format,
        options.import_mode,
        options.duplicate_action,
        batch.total_rows,
        batch.valid_rows,
        batch.invalid_rows,
        batch.duplicate_rows,
        invalid.length && options.import_mode === "all_or_nothing"
          ? "REJECTED"
          : "PROCESSING",
      );
    batch.import_batch_id = Number(batchResult.lastInsertRowid);
    if (invalid.length && options.import_mode === "all_or_nothing") {
      for (const row of preview)
        db.prepare(
          "INSERT INTO import_rows(batch_id,user_id,row_number,status,messages_json) VALUES (?,?,?,?,?)",
        ).run(
          batch.import_batch_id,
          userId,
          row.row_number,
          row.valid ? "valid" : "invalid",
          JSON.stringify(row.errors),
        );
    } else
      for (const row of preview) {
        if (!row.valid) {
          db.prepare(
            "INSERT INTO import_rows(batch_id,user_id,row_number,status,messages_json) VALUES (?,?,?,?,?)",
          ).run(
            batch.import_batch_id,
            userId,
            row.row_number,
            "invalid",
            JSON.stringify(row.errors),
          );
          continue;
        }
        let applicationId = row.duplicate_id,
          status = "created";
        if (row.duplicate && options.duplicate_action === "skip") {
          batch.skipped_rows++;
          status = "skipped";
        } else if (
          row.duplicate &&
          options.duplicate_action === "update_existing"
        ) {
          updateApplication(
            db,
            db
              .prepare("SELECT * FROM applications WHERE id=?")
              .get(row.duplicate_id),
            actorId,
            row.data,
          );
          batch.updated_rows++;
          status = "updated";
        } else {
          applicationId = insertApplication(db, userId, actorId, row.data);
          batch.created_rows++;
          batch.created_application_ids.push(applicationId);
        }
        db.prepare(
          "INSERT INTO import_rows(batch_id,user_id,row_number,status,messages_json,application_id) VALUES (?,?,?,?,?,?)",
        ).run(
          batch.import_batch_id,
          userId,
          row.row_number,
          status,
          "[]",
          applicationId,
        );
      }
    const status =
      invalid.length && options.import_mode === "all_or_nothing"
        ? "REJECTED"
        : "COMPLETED";
    db.prepare(
      "UPDATE import_batches SET created_rows=?,updated_rows=?,skipped_rows=?,rejected_rows=?,status=?,completed_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(
      batch.created_rows,
      batch.updated_rows,
      batch.skipped_rows,
      batch.rejected_rows,
      status,
      batch.import_batch_id,
    );
    db.exec("COMMIT");
    batch.status = status;
    return batch;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function dashboard(db, userId) {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const weekStart = new Date(`${today}T12:00:00Z`);
  weekStart.setUTCDate(
    weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7),
  );
  const counts = db
    .prepare(
      `SELECT count(*) total, sum(date_applied=?) today, sum(date_applied>=?) week, sum(substr(date_applied,1,7)=?) month, sum(stage NOT IN ('Rejected','Withdrawn','Ghosted','Position Closed','Accepted')) active, sum(stage='Rejected') rejected, sum(stage='Ghosted') ghosted, sum(stage IN ('Interview','Final Interview','Offer','Accepted')) interviewed, sum(stage IN ('Offer','Accepted')) offered, sum(stage='Accepted') accepted, sum(last_response_date IS NOT NULL) responded FROM applications WHERE user_id=?`,
    )
    .get(today, weekStart.toISOString().slice(0, 10), month, userId);
  const total = Number(counts.total || 0),
    pct = (value) =>
      total ? Math.round((Number(value || 0) / total) * 1000) / 10 : 0;
  const pipeline = Object.fromEntries(
    rows(
      db.prepare(
        "SELECT stage,count(*) count FROM applications WHERE user_id=? GROUP BY stage",
      ),
      [userId],
    ).map((row) => [row.stage, row.count]),
  );
  const recent = rows(
    db.prepare(
      "SELECT ac.*,a.company,a.job_title FROM activities ac JOIN applications a ON a.id=ac.application_id WHERE ac.user_id=? ORDER BY ac.created_at DESC,ac.id DESC LIMIT 10",
    ),
    [userId],
  );
  const due = db
    .prepare(
      "SELECT sum(due_date=?) due_today,sum(due_date<? AND status NOT IN ('Completed','Cancelled')) overdue FROM follow_ups WHERE user_id=?",
    )
    .get(today, today, userId);
  return {
    today: {
      applications: Number(counts.today || 0),
      follow_ups_due: Number(due.due_today || 0),
      overdue_follow_ups: Number(due.overdue || 0),
    },
    performance: {
      total,
      this_week: Number(counts.week || 0),
      this_month: Number(counts.month || 0),
      active: Number(counts.active || 0),
      responses: Number(counts.responded || 0),
      rejected: Number(counts.rejected || 0),
      ghosted: Number(counts.ghosted || 0),
      offers: Number(counts.offered || 0),
      accepted: Number(counts.accepted || 0),
      response_rate: pct(counts.responded),
      interview_conversion_rate: pct(counts.interviewed),
      rejection_rate: pct(counts.rejected),
      offer_rate: pct(counts.offered),
      acceptance_rate: pct(counts.accepted),
    },
    pipeline,
    recent_activity: recent,
  };
}
