import ExcelJS from "exceljs";
import { rows } from "./db.js";
import { STAGES, changeStage, ownedApplication } from "./service.js";

const CLOSED_STAGES = new Set([
  "Accepted",
  "Rejected",
  "Withdrawn",
  "Ghosted",
  "Position Closed",
]);
const VIEWS = new Set(["table", "kanban"]);
const BOARD_SORTS = new Set([
  "updated_desc",
  "date_newest",
  "date_oldest",
  "priority",
  "next_action",
  "aging",
  "company",
  "custom",
]);
const TEXT_FIELDS = new Set([
  "company",
  "job_title",
  "location",
  "source",
  "next_action",
  "resume_version",
]);
const DATE_FIELDS = new Set(["date_applied", "next_action_date", "updated_at"]);
const ENUM_FIELDS = new Set([
  "stage",
  "priority",
  "work_arrangement",
  "employment_type",
]);
const BOOL_FIELDS = new Set(["pinned", "important", "favorite", "archived"]);
const SORT_FIELDS = new Set([
  "date_applied",
  "company",
  "job_title",
  "location",
  "stage",
  "priority",
  "source",
  "next_action",
  "next_action_date",
  "updated_at",
  "resume_version",
]);

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function ownerId(actor, input = {}) {
  if (actor.role !== "MANAGER") {
    if (input.user_id && Number(input.user_id) !== actor.id)
      fail("Not found", 404);
    return actor.id;
  }
  return Number(input.user_id) || actor.id;
}
function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    fail("Invalid filter data");
  }
}
function boolValue(value) {
  if ([true, 1, "1", "true", "yes"].includes(value)) return 1;
  if ([false, 0, "0", "false", "no"].includes(value)) return 0;
  return null;
}
function buildApplicationWhere(actor, query = {}) {
  const where = [],
    params = [];
  if (actor.role !== "MANAGER") {
    where.push("a.user_id=?");
    params.push(actor.id);
  } else if (query.user_id) {
    where.push("a.user_id=?");
    params.push(Number(query.user_id));
  }
  const filters = { ...query, ...parseJson(query.filters, {}) };
  if (filters.search) {
    where.push(
      "(lower(a.company) LIKE lower(?) OR lower(a.job_title) LIKE lower(?) OR lower(coalesce(a.location,'')) LIKE lower(?) OR lower(coalesce(a.notes,'')) LIKE lower(?))",
    );
    params.push(...Array(4).fill(`%${filters.search}%`));
  }
  for (const field of ENUM_FIELDS) {
    const values = Array.isArray(filters[field])
      ? filters[field]
      : String(filters[field] || "")
          .split(",")
          .filter(Boolean);
    if (values.length) {
      where.push(`a.${field} IN (${values.map(() => "?").join(",")})`);
      params.push(...values);
    }
  }
  if (filters.resume_id) {
    where.push("a.resume_id=?");
    params.push(Number(filters.resume_id));
  }
  for (const field of BOOL_FIELDS) {
    if (!(field in filters)) continue;
    if (field === "archived") {
      if (filters.archived === "all") continue;
      where.push(
        boolValue(filters.archived) === 1
          ? "a.archived_at IS NOT NULL"
          : "a.archived_at IS NULL",
      );
    } else {
      const value = boolValue(filters[field]);
      if (value !== null) {
        where.push(`a.${field}=?`);
        params.push(value);
      }
    }
  }
  if (!("archived" in filters)) where.push("a.archived_at IS NULL");
  const rangeField = ["date_applied", "created_at", "updated_at"].includes(
    filters.date_field,
  )
    ? filters.date_field
    : "date_applied";
  if (filters.date_from) {
    where.push(`substr(a.${rangeField},1,10)>=?`);
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push(`substr(a.${rangeField},1,10)<=?`);
    params.push(filters.date_to);
  }
  if (filters.tag_id) {
    where.push(
      "EXISTS(SELECT 1 FROM application_tags ax WHERE ax.application_id=a.id AND ax.tag_id=?)",
    );
    params.push(Number(filters.tag_id));
  }
  const columnFilters = parseJson(filters.column_filters, []);
  for (const filter of columnFilters) {
    const field = filter.field;
    if (TEXT_FIELDS.has(field)) {
      const expr =
        field === "resume_version"
          ? "coalesce(r.version_name,a.resume_version,'')"
          : `coalesce(a.${field},'')`;
      const value = String(filter.value || "");
      const ops = {
        contains: [`lower(${expr}) LIKE lower(?)`, `%${value}%`],
        not_contains: [`lower(${expr}) NOT LIKE lower(?)`, `%${value}%`],
        equals: [`lower(${expr})=lower(?)`, value],
        not_equal: [`lower(${expr})<>lower(?)`, value],
        starts_with: [`lower(${expr}) LIKE lower(?)`, `${value}%`],
        ends_with: [`lower(${expr}) LIKE lower(?)`, `%${value}`],
      };
      if (filter.operator === "empty") where.push(`${expr}=''`);
      else if (filter.operator === "not_empty") where.push(`${expr}<>''`);
      else if (ops[filter.operator]) {
        where.push(ops[filter.operator][0]);
        params.push(ops[filter.operator][1]);
      }
    } else if (DATE_FIELDS.has(field)) {
      const expr = `substr(a.${field},1,10)`;
      if (filter.operator === "between") {
        where.push(`${expr} BETWEEN ? AND ?`);
        params.push(filter.value, filter.value_to);
      } else if (["equals", "before", "after"].includes(filter.operator)) {
        where.push(
          `${expr}${filter.operator === "equals" ? "=" : filter.operator === "before" ? "<" : ">"}?`,
        );
        params.push(filter.value);
      } else if (filter.operator === "empty") where.push(`a.${field} IS NULL`);
      else if (filter.operator === "not_empty")
        where.push(`a.${field} IS NOT NULL`);
    }
  }
  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
    filters,
  };
}
function queryApplications(db, actor, query = {}, { bounded = true } = {}) {
  const { clause, params } = buildApplicationWhere(actor, query);
  const sort = SORT_FIELDS.has(query.sort) ? query.sort : "updated_at";
  const sortExpr =
    sort === "resume_version"
      ? "coalesce(r.version_name,a.resume_version,'')"
      : `a.${sort}`;
  const direction = query.direction === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = bounded
    ? Math.min(100, Math.max(1, Number(query.page_size) || 25))
    : Math.min(10000, Math.max(1, Number(query.page_size) || 10000));
  const tagAggregate =
    db.dialect === "postgres"
      ? "string_agg(t.name,', ')"
      : "group_concat(t.name,', ')";
  const select = `SELECT a.*,u.username owner_username,coalesce(r.version_name,a.resume_version) linked_resume_version,(SELECT ${tagAggregate} FROM application_tags atg JOIN tags t ON t.id=atg.tag_id WHERE atg.application_id=a.id) tags FROM applications a JOIN users u ON u.id=a.user_id LEFT JOIN resumes r ON r.id=a.resume_id ${clause}`;
  const items = rows(
    db.prepare(
      `${select} ORDER BY a.pinned DESC,${sortExpr} ${direction},a.id DESC LIMIT ? OFFSET ?`,
    ),
    [...params, pageSize, (page - 1) * pageSize],
  );
  const total = Number(
    db
      .prepare(
        `SELECT count(*) count FROM applications a LEFT JOIN resumes r ON r.id=a.resume_id ${clause}`,
      )
      .get(...params).count,
  );
  return {
    items,
    total,
    page,
    page_size: pageSize,
    pages: Math.ceil(total / pageSize),
  };
}
function preferenceType(actor, input = {}) {
  return actor.role === "MANAGER" && input.dashboard_type === "manager"
    ? "manager"
    : "user";
}
function getPreference(db, actor, input = {}) {
  const type = preferenceType(actor, input);
  const stored = db
    .prepare(
      "SELECT * FROM application_view_preferences WHERE user_id=? AND dashboard_type=?",
    )
    .get(actor.id, type);
  return stored
    ? {
        ...stored,
        visible_columns: parseJson(stored.visible_columns_json, []),
        collapsed_columns: parseJson(stored.collapsed_columns_json, []),
        filters: parseJson(stored.filters_json, {}),
      }
    : {
        dashboard_type: type,
        preferred_view: "table",
        visible_columns: [],
        collapsed_columns: [...CLOSED_STAGES],
        board_sort: "updated_desc",
        filters: {},
      };
}
function savePreference(db, actor, input) {
  const current = getPreference(db, actor, input),
    type = current.dashboard_type;
  const view = input.preferred_view || current.preferred_view;
  if (!VIEWS.has(view)) fail("Invalid applications view");
  const sort = input.board_sort || current.board_sort;
  if (!BOARD_SORTS.has(sort)) fail("Invalid board sorting mode");
  const collapsed = input.collapsed_columns ?? current.collapsed_columns;
  if (
    !Array.isArray(collapsed) ||
    collapsed.some((stage) => !STAGES.includes(stage))
  )
    fail("Invalid collapsed columns");
  db.prepare(
    "INSERT INTO application_view_preferences(user_id,dashboard_type,preferred_view,visible_columns_json,collapsed_columns_json,board_sort,filters_json) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,dashboard_type) DO UPDATE SET preferred_view=excluded.preferred_view,visible_columns_json=excluded.visible_columns_json,collapsed_columns_json=excluded.collapsed_columns_json,board_sort=excluded.board_sort,filters_json=excluded.filters_json,updated_at=CURRENT_TIMESTAMP",
  ).run(
    actor.id,
    type,
    view,
    JSON.stringify(input.visible_columns ?? current.visible_columns),
    JSON.stringify(collapsed),
    sort,
    JSON.stringify(input.filters ?? current.filters),
  );
  db.prepare(
    "UPDATE users SET preferred_applications_view=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).run(view, actor.id);
  return getPreference(db, actor, { dashboard_type: type });
}
function safeCell(value) {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}
function age(date) {
  return Math.max(
    0,
    Math.floor((Date.now() - Date.parse(`${date}T12:00:00Z`)) / 86400000),
  );
}
function health(item) {
  if (CLOSED_STAGES.has(item.stage)) return "Closed";
  if (
    item.next_action_date &&
    item.next_action_date < new Date().toISOString().slice(0, 10)
  )
    return "Overdue";
  return age((item.updated_at || item.date_applied).slice(0, 10)) > 14
    ? "Action Needed"
    : "On Track";
}

async function workbook(items, query) {
  const book = new ExcelJS.Workbook();
  book.creator = "JobQuest";
  book.created = new Date();
  const sheet = book.addWorksheet("Applications", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    ["Date Applied", "date_applied", 14],
    ["Company", "company", 24],
    ["Job Title", "job_title", 28],
    ["Job URL", "job_url", 30],
    ["Location", "location", 20],
    ["Work Arrangement", "work_arrangement", 16],
    ["Employment Type", "employment_type", 16],
    ["Stage", "stage", 18],
    ["Priority", "priority", 12],
    ["Source", "source", 18],
    ["Resume Version", "linked_resume_version", 20],
    ["Salary Min", "salary_min", 14],
    ["Salary Max", "salary_max", 14],
    ["Recruiter", "recruiter_name", 20],
    ["Next Action", "next_action", 26],
    ["Next-Action Date", "next_action_date", 16],
    ["Last Response", "last_response_date", 14],
    ["Aging", "aging", 12],
    ["Application Health", "application_health", 18],
    ["Tags", "tags", 24],
    ["Pinned", "pinned", 10],
    ["Important", "important", 10],
    ["Archived", "archived", 10],
    ["Created", "created_at", 20],
    ["Updated", "updated_at", 20],
  ].map(([header, key, width]) => ({ header, key, width }));
  for (const item of items) {
    const data = {
      ...item,
      aging: age(item.date_applied),
      application_health: health(item),
      archived: Boolean(item.archived_at),
      pinned: Boolean(item.pinned),
      important: Boolean(item.important),
    };
    for (const key of Object.keys(data)) data[key] = safeCell(data[key]);
    for (const key of [
      "date_applied",
      "next_action_date",
      "last_response_date",
      "created_at",
      "updated_at",
    ])
      if (data[key])
        data[key] = new Date(
          String(data[key]).replace(" ", "T") +
            (String(data[key]).includes("T") ? "" : "T12:00:00"),
        );
    sheet.addRow(data);
  }
  sheet.autoFilter = { from: "A1", to: "Y1" };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };
  sheet.eachRow((row, n) => {
    if (n > 1) row.alignment = { vertical: "top", wrapText: true };
  });
  if (items.length > 1) {
    const summary = book.addWorksheet("Summary");
    const counts = (field) =>
      Object.entries(
        items.reduce((out, item) => {
          const key = item[field] || "Unspecified";
          out[key] = (out[key] || 0) + 1;
          return out;
        }, {}),
      );
    summary.addRows([
      ["JobQuest Application Export"],
      ["Export date", new Date()],
      [
        "Date range",
        `${query.date_from || "All"} to ${query.date_to || "All"}`,
      ],
      ["Applied filters", JSON.stringify(parseJson(query.filters, {}))],
      ["Total applications", items.length],
      [],
      ["Stage", "Count"],
      ...counts("stage"),
      [],
      ["Source", "Count"],
      ...counts("source"),
      [],
      ["Resume Version", "Count"],
      ...counts("linked_resume_version"),
    ]);
    summary.getColumn(1).width = 28;
    summary.getColumn(2).width = 42;
    summary.getRow(1).font = { bold: true, size: 16 };
  }
  return book.xlsx.writeBuffer();
}

export async function handleFeatureUpgrade(context, helpers) {
  const { db, request, response, url } = context;
  const { json, body, requireAuth } = helpers;
  const path = url.pathname;
  const stageMatch = path.match(/^\/api\/applications\/(\d+)\/stage$/);
  if (stageMatch && request.method === "PATCH") {
    const actor = requireAuth(context, { csrf: true }),
      application = ownedApplication(db, actor, Number(stageMatch[1]));
    if (!application) fail("Not found", 404);
    const input = await body(request),
      stage = input.stage;
    if (!STAGES.includes(stage)) fail("Unsupported stage");
    db.exec("BEGIN");
    try {
      const result = changeStage(db, application, actor.id, stage);
      if (stage === "Rejected") {
        const exists = db
          .prepare(
            "SELECT id FROM rejections WHERE application_id=? ORDER BY id DESC LIMIT 1",
          )
          .get(application.id);
        if (!exists)
          db.prepare(
            "INSERT INTO rejections(user_id,application_id,rejection_date,stage_at_rejection,rejection_reason,notes) VALUES (?,?,date('now'),?,?,?)",
          ).run(
            application.user_id,
            application.id,
            application.stage,
            input.reason || "Stage transition",
            input.note || null,
          );
      }
      db.prepare(
        "INSERT INTO audit_log(user_id,actor_user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?)",
      ).run(
        application.user_id,
        actor.id,
        "stage_changed",
        "application",
        application.id,
        JSON.stringify({ previous_stage: application.stage, stage }),
      );
      db.exec("COMMIT");
      return (json(response, 200, result), true);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  if (path === "/api/application-view-preferences") {
    const actor = requireAuth(context, { csrf: request.method !== "GET" });
    if (request.method === "GET")
      return (
        json(
          response,
          200,
          getPreference(db, actor, Object.fromEntries(url.searchParams)),
        ),
        true
      );
    if (request.method === "PUT")
      return (
        json(response, 200, savePreference(db, actor, await body(request))),
        true
      );
  }
  if (path === "/api/applications/query" && request.method === "GET") {
    const actor = requireAuth(context);
    return (
      json(
        response,
        200,
        queryApplications(db, actor, Object.fromEntries(url.searchParams)),
      ),
      true
    );
  }
  if (path === "/api/applications/kanban" && request.method === "GET") {
    const actor = requireAuth(context),
      query = Object.fromEntries(url.searchParams),
      result = queryApplications(
        db,
        actor,
        { ...query, page_size: Math.min(10000, Number(query.limit) || 500) },
        { bounded: false },
      );
    const columns = STAGES.map((stage) => ({
      stage,
      total: result.items.filter((item) => item.stage === stage).length,
      items: result.items.filter((item) => item.stage === stage),
    }));
    return (
      json(response, 200, {
        columns,
        total: result.total,
        has_more: result.items.length < result.total,
      }),
      true
    );
  }
  const orderMatch = path.match(/^\/api\/applications\/(\d+)\/board-order$/);
  if (orderMatch && request.method === "PATCH") {
    const actor = requireAuth(context, { csrf: true }),
      app = ownedApplication(db, actor, Number(orderMatch[1]));
    if (!app) fail("Not found", 404);
    const input = await body(request),
      order = Math.max(0, Number(input.board_order) || 0);
    db.prepare(
      "UPDATE applications SET board_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(order, app.id);
    return (json(response, 200, { id: app.id, board_order: order }), true);
  }
  if (path === "/api/navigation/counts" && request.method === "GET") {
    const actor = requireAuth(context),
      id = ownerId(actor, Object.fromEntries(url.searchParams)),
      today = new Date().toISOString().slice(0, 10);
    const counts = db
      .prepare(
        "SELECT (SELECT count(*) FROM reminders WHERE user_id=? AND due_date<=? AND status NOT IN ('Completed','Cancelled')) due_reminders,(SELECT count(*) FROM follow_ups WHERE user_id=? AND due_date<? AND status NOT IN ('Completed','Cancelled')) overdue_follow_ups,(SELECT count(*) FROM interviews WHERE user_id=? AND substr(scheduled_at,1,10) BETWEEN ? AND ?) upcoming_interviews",
      )
      .get(
        id,
        today,
        id,
        today,
        id,
        today,
        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      );
    return (json(response, 200, counts), true);
  }
  if (path === "/api/navigation/preferences") {
    const actor = requireAuth(context, { csrf: request.method !== "GET" });
    if (request.method === "GET")
      return (
        json(response, 200, {
          collapsed: Boolean(actor.navigation_collapsed),
          groups: parseJson(actor.navigation_groups_json, {}),
        }),
        true
      );
    if (request.method === "PUT") {
      const input = await body(request);
      db.prepare(
        "UPDATE users SET navigation_collapsed=?,navigation_groups_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(
        Number(Boolean(input.collapsed)),
        JSON.stringify(input.groups || {}),
        actor.id,
      );
      return (json(response, 200, { message: "Navigation saved" }), true);
    }
  }
  const cloneMatch = path.match(/^\/api\/resumes\/(\d+)\/(clone|history)$/);
  if (cloneMatch) {
    const actor = requireAuth(context, { csrf: request.method === "POST" }),
      resume =
        actor.role === "MANAGER"
          ? db.prepare("SELECT * FROM resumes WHERE id=?").get(cloneMatch[1])
          : db
              .prepare("SELECT * FROM resumes WHERE id=? AND user_id=?")
              .get(cloneMatch[1], actor.id);
    if (!resume) fail("Not found", 404);
    if (cloneMatch[2] === "history" && request.method === "GET")
      return (
        json(
          response,
          200,
          rows(
            db.prepare(
              "SELECT h.*,u.username actor_username FROM resume_history h JOIN users u ON u.id=h.actor_user_id WHERE h.resume_id=? ORDER BY h.created_at DESC,h.id DESC",
            ),
            [resume.id],
          ),
        ),
        true
      );
    if (cloneMatch[2] === "clone" && request.method === "POST") {
      const input = await body(request),
        name = String(
          input.version_name || `${resume.version_name} revision`,
        ).trim();
      const result = db
        .prepare(
          "INSERT INTO resumes(user_id,version_name,revision_label,parent_resume_id,target_role,job_category,file_name,secure_file_reference,resume_date,is_active,is_default,is_archived,notes,change_summary) VALUES (?,?,?,?,?,?,?,?,?,1,0,0,?,?)",
        )
        .run(
          resume.user_id,
          name,
          input.revision_label || null,
          resume.id,
          resume.target_role,
          resume.job_category,
          resume.file_name,
          resume.secure_file_reference,
          new Date().toISOString().slice(0, 10),
          resume.notes,
          input.change_summary || "Created from existing version",
        );
      const id = Number(result.lastInsertRowid);
      db.prepare(
        "INSERT INTO resume_history(resume_id,user_id,actor_user_id,action,version_name,parent_resume_id,change_summary) VALUES (?,?,?,?,?,?,?)",
      ).run(
        id,
        resume.user_id,
        actor.id,
        "created_revision",
        name,
        resume.id,
        input.change_summary || null,
      );
      return (json(response, 201, { id }), true);
    }
  }
  if (path === "/api/resumes/compare" && request.method === "GET") {
    const actor = requireAuth(context),
      ids = [
        Number(url.searchParams.get("left")),
        Number(url.searchParams.get("right")),
      ];
    if (ids.some((id) => !id)) fail("Two resume versions are required");
    const found = ids.map((id) =>
      actor.role === "MANAGER"
        ? db.prepare("SELECT * FROM resumes WHERE id=?").get(id)
        : db
            .prepare("SELECT * FROM resumes WHERE id=? AND user_id=?")
            .get(id, actor.id),
    );
    if (found.some((item) => !item) || found[0].user_id !== found[1].user_id)
      fail("Not found", 404);
    const enrich = (item) => ({
      ...item,
      ...db
        .prepare(
          "SELECT count(*) applications,sum(last_response_date IS NOT NULL) responses,sum(stage IN ('Interview','Final Interview','Offer','Accepted')) interviews,sum(stage IN ('Offer','Accepted')) offers,sum(stage='Accepted') acceptances FROM applications WHERE resume_id=?",
        )
        .get(item.id),
    });
    return (
      json(response, 200, {
        comparison_type: "metadata_and_performance",
        left: enrich(found[0]),
        right: enrich(found[1]),
      }),
      true
    );
  }
  if (path === "/api/goals/progress-series" && request.method === "GET") {
    const actor = requireAuth(context),
      query = Object.fromEntries(url.searchParams),
      id = ownerId(actor, query),
      metric = query.metric || "applications",
      end = query.date_to || new Date().toISOString().slice(0, 10),
      start =
        query.date_from ||
        new Date(Date.parse(`${end}T12:00:00Z`) - 13 * 86400000)
          .toISOString()
          .slice(0, 10);
    const snapshots = rows(
      db.prepare(
        "SELECT * FROM goal_snapshots WHERE user_id=? AND period_type=? AND category=? AND period_start BETWEEN ? AND ? ORDER BY period_start",
      ),
      [
        id,
        query.aggregation === "weekly" ? "weekly" : "daily",
        metric,
        start,
        end,
      ],
    );
    const achieved = snapshots.filter((x) => x.achieved).length;
    return (
      json(response, 200, {
        metric,
        start,
        end,
        aggregation: query.aggregation === "weekly" ? "weekly" : "daily",
        items: snapshots,
        summary: {
          current_target: Number(snapshots.at(-1)?.target || 0),
          actual: Number(snapshots.at(-1)?.actual || 0),
          remaining: Math.max(
            0,
            Number(snapshots.at(-1)?.target || 0) -
              Number(snapshots.at(-1)?.actual || 0),
          ),
          percentage: Number(snapshots.at(-1)?.completion_percentage || 0),
          achieved_days: achieved,
          missed_days: snapshots.length - achieved,
        },
      }),
      true
    );
  }
  if (path === "/api/exports/applications.xlsx" && request.method === "GET") {
    const actor = requireAuth(context),
      query = Object.fromEntries(url.searchParams),
      result = queryApplications(
        db,
        actor,
        { ...query, page_size: 10000 },
        { bounded: false },
      );
    if (!result.items.length) fail("No applications match this export", 404);
    const buffer = await workbook(result.items, query),
      from = (query.date_from || "all").replace(/[^0-9a-z-]/gi, "-"),
      to = (query.date_to || "time").replace(/[^0-9a-z-]/gi, "-");
    response.writeHead(200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"job-applications-${from}-to-${to}.xlsx\"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(Buffer.from(buffer));
    return true;
  }
  return false;
}

export { buildApplicationWhere, queryApplications, safeCell };
