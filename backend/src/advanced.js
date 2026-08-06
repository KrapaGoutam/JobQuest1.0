import { rows } from "./db.js";
import { STAGES, changeStage, ownedApplication } from "./service.js";

const BUILTIN_WIDGETS = [
  "applications-today",
  "applications-week",
  "applications-month",
  "active-applications",
  "follow-ups-due",
  "overdue-follow-ups",
  "upcoming-interviews",
  "responses",
  "rejections",
  "ghosted",
  "offers",
  "acceptances",
  "daily-goals",
  "daily-goal-chart",
  "weekly-goals",
  "goal-comparison",
  "activity-chart",
  "job-funnel",
  "applications-stage",
  "applications-source",
  "applications-work-arrangement",
  "resume-performance",
  "goal-trends",
  "reminder-center",
  "aging-applications",
  "stage-duration",
  "recent-activity",
  "pinned-applications",
  "health-summary",
  "calendar-preview",
];
const USER_DEFAULT_IDS = new Set([
  "applications-month", "active-applications", "upcoming-interviews", "responses",
  "activity-chart", "weekly-goals", "reminder-center", "job-funnel",
  "recent-activity", "health-summary",
]);
const MANAGER_DEFAULT_IDS = new Set([
  "applications-month", "active-applications", "upcoming-interviews", "offers",
  "activity-chart", "goal-comparison", "overdue-follow-ups", "job-funnel",
  "aging-applications", "stage-duration", "recent-activity",
]);
function defaultWidgets(type = "user") {
  const enabled = type === "manager" ? MANAGER_DEFAULT_IDS : USER_DEFAULT_IDS;
  return BUILTIN_WIDGETS.map((widget_id, position) => ({
    widget_id,
    enabled: enabled.has(widget_id) ? 1 : 0,
    position,
    width: ["activity-chart", "job-funnel"].includes(widget_id) ? 3 :
      ["weekly-goals", "goal-comparison", "recent-activity"].includes(widget_id) ? 2 : 1,
    height: 1,
    settings: {},
  }));
}
const DEFAULT_WIDGETS = defaultWidgets();
const REMINDER_PRIORITIES = ["Low", "Medium", "High"];
const GOAL_CATEGORIES = [
  "applications",
  "follow_ups",
  "connections",
  "recruiter_messages",
  "interview_prep_minutes",
];
const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const isoDate = (date = new Date()) => date.toISOString().slice(0, 10);
const addDays = (date, count) => {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + count);
  return isoDate(result);
};

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function ownerId(actor, query = {}) {
  return actor.role === "MANAGER" && query.user_id
    ? Number(query.user_id)
    : actor.id;
}
function owned(db, actor, table, id) {
  const record =
    actor.role === "MANAGER"
      ? db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id)
      : db
          .prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`)
          .get(id, actor.id);
  if (!record) fail("Not found", 404);
  return record;
}
function activeCategory(db, userId, id) {
  const category = db
    .prepare(
      "SELECT * FROM reminder_categories WHERE id=? AND archived_at IS NULL AND (is_builtin=1 OR user_id=?)",
    )
    .get(id, userId);
  if (!category) fail("Reminder category not found");
  return category;
}
function sendDownload(response, filename, contentType, content) {
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(content);
}
function queryRange(url, defaultDays = 90) {
  const end = url.searchParams.get("date_to") || isoDate();
  const start = url.searchParams.get("date_from") || addDays(end, -defaultDays);
  return { start, end };
}
function timestampMs(value) {
  if (!value) return Date.now();
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return Date.parse(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
}
function audit(
  db,
  owner,
  actor,
  action,
  type,
  id,
  field = null,
  previous = null,
  next = null,
) {
  db.prepare(
    "INSERT INTO audit_log(user_id,actor_user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?)",
  ).run(
    owner,
    actor,
    action,
    type,
    id,
    JSON.stringify({ field, previous, next }),
  );
}
function timeline(db, application, actorId, event) {
  return Number(
    db
      .prepare(
        "INSERT INTO timeline_events(application_id,user_id,actor_user_id,event_date,event_time,category,event_type,stage,title,description,contact_person,source,related_record_type,related_record_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        application.id,
        application.user_id,
        actorId,
        event.event_date || isoDate(),
        event.event_time || null,
        event.category || "notes",
        event.event_type || "custom",
        event.stage || application.stage,
        event.title || "Application update",
        event.description || event.note || null,
        event.contact_person || event.contact || null,
        event.source || "manual",
        event.related_record_type || null,
        event.related_record_id || null,
      ).lastInsertRowid,
  );
}
function reminderState(record) {
  if (["Completed", "Cancelled"].includes(record.status)) return record.status;
  if (record.snoozed_until && record.snoozed_until > new Date().toISOString())
    return "Snoozed";
  const today = isoDate();
  if (record.due_date < today) return "Overdue";
  if (record.due_date === today) return "Due Today";
  return "Upcoming";
}
function businessAdd(date, days, business) {
  let result = date,
    remaining = Number(days);
  while (remaining > 0) {
    result = addDays(result, 1);
    const day = new Date(`${result}T12:00:00Z`).getUTCDay();
    if (!business || (day !== 0 && day !== 6)) remaining--;
  }
  return result;
}
function actualFor(db, userId, category, start, end) {
  const map = {
    applications: [
      "SELECT count(*) count FROM applications WHERE user_id=? AND date_applied BETWEEN ? AND ?",
      [],
    ],
    follow_ups: [
      "SELECT count(*) count FROM follow_ups WHERE user_id=? AND status='Completed' AND substr(updated_at,1,10) BETWEEN ? AND ?",
      [],
    ],
    connections: [
      "SELECT count(*) count FROM networking_contacts WHERE user_id=? AND connection_request_date BETWEEN ? AND ?",
      [],
    ],
    recruiter_messages: [
      "SELECT count(*) count FROM networking_contacts WHERE user_id=? AND first_message_sent=1 AND substr(updated_at,1,10) BETWEEN ? AND ?",
      [],
    ],
    interview_prep_minutes: [
      "SELECT coalesce(sum(interview_prep_minutes_actual),0) count FROM daily_goals WHERE user_id=? AND goal_date BETWEEN ? AND ?",
      [],
    ],
  };
  return Number(
    db.prepare(map[category][0]).get(userId, start, end).count || 0,
  );
}
function recalculateGoals(db, userId, periodType, start, end) {
  const settings = rows(
    db.prepare(
      "SELECT * FROM goal_settings WHERE user_id=? AND period_type=? AND enabled=1 AND effective_date<=? AND (end_date IS NULL OR end_date>=?) ORDER BY effective_date",
    ),
    [userId, periodType, end, start],
  );
  const periods = [];
  if (periodType === "daily")
    for (let date = start; date <= end; date = addDays(date, 1))
      periods.push([date, date]);
  else {
    let cursor = start;
    while (cursor <= end) {
      const periodEnd = addDays(cursor, 6);
      periods.push([cursor, periodEnd > end ? end : periodEnd]);
      cursor = addDays(cursor, 7);
    }
  }
  const upsert = db.prepare(
    "INSERT INTO goal_snapshots(user_id,period_type,period_start,period_end,category,target,actual,completion_percentage,achieved,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,period_type,period_start,category) DO UPDATE SET period_end=excluded.period_end,target=excluded.target,actual=excluded.actual,completion_percentage=excluded.completion_percentage,achieved=excluded.achieved,calculated_at=CURRENT_TIMESTAMP",
  );
  for (const [periodStart, periodEnd] of periods)
    for (const category of GOAL_CATEGORIES) {
      const setting = settings
        .filter(
          (item) =>
            item.category === category &&
            item.effective_date <= periodStart &&
            (!item.end_date || item.end_date >= periodStart),
        )
        .at(-1);
      if (!setting) continue;
      const actual = actualFor(db, userId, category, periodStart, periodEnd),
        target = Number(setting.target),
        percentage = target
          ? Math.round((actual / target) * 1000) / 10
          : actual
            ? 100
            : 0;
      upsert.run(
        userId,
        periodType,
        periodStart,
        periodEnd,
        category,
        target,
        actual,
        percentage,
        actual >= target ? 1 : 0,
      );
    }
}
function comparison(items) {
  const achieved = items.filter((item) => item.achieved).length,
    missed = items.length - achieved;
  const streak = (wanted) => {
    let current = 0,
      longest = 0;
    for (const item of items) {
      current = Boolean(item.achieved) === wanted ? current + 1 : 0;
      longest = Math.max(longest, current);
    }
    return longest;
  };
  const above = items
    .filter((item) => item.achieved)
    .map((item) => item.actual - item.target);
  const short = items
    .filter((item) => !item.achieved)
    .map((item) => item.target - item.actual);
  const avg = (values) =>
    values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) /
        10
      : 0;
  return {
    periods: items.length,
    achieved,
    missed,
    achievement_percentage: items.length
      ? Math.round((achieved / items.length) * 1000) / 10
      : 0,
    average_above_target: avg(above),
    average_shortfall: avg(short),
    longest_achieved_streak: streak(true),
    longest_missed_streak: streak(false),
  };
}

export async function handleAdvanced(context, helpers) {
  const { db, request, response, url } = context;
  const { json, body, requireAuth, targetOwner } = helpers;
  const path = url.pathname;

  if (path === "/api/analytics/stage-transitions" && request.method === "GET") {
    const actor = requireAuth(context),
      userId = ownerId(actor, Object.fromEntries(url.searchParams));
    const result = db
      .prepare(
        `WITH visits AS (SELECT application_id,new_stage,min(entered_at) entered FROM stage_history WHERE user_id=? GROUP BY application_id,new_stage), pivots AS (SELECT a.id,a.date_applied,a.last_response_date,max(CASE WHEN v.new_stage='Recruiter Screen' THEN v.entered END) recruiter,max(CASE WHEN v.new_stage IN ('Interview','Final Interview') THEN v.entered END) interview,max(CASE WHEN v.new_stage='Offer' THEN v.entered END) offer,max(CASE WHEN v.new_stage='Rejected' THEN v.entered END) rejected,max(CASE WHEN v.new_stage IN ('Rejected','Withdrawn','Ghosted','Position Closed','Accepted') THEN v.entered END) closed FROM applications a LEFT JOIN visits v ON v.application_id=a.id WHERE a.user_id=? GROUP BY a.id) SELECT round(avg(CASE WHEN last_response_date IS NOT NULL THEN julianday(last_response_date)-julianday(date_applied) END),1) applied_to_first_response,round(avg(CASE WHEN recruiter IS NOT NULL THEN julianday(recruiter)-julianday(date_applied) END),1) applied_to_recruiter_screen,round(avg(CASE WHEN interview IS NOT NULL THEN julianday(interview)-julianday(date_applied) END),1) applied_to_interview,round(avg(CASE WHEN offer IS NOT NULL AND interview IS NOT NULL THEN julianday(offer)-julianday(interview) END),1) interview_to_offer,round(avg(CASE WHEN rejected IS NOT NULL THEN julianday(rejected)-julianday(date_applied) END),1) applied_to_rejection,round(avg(CASE WHEN closed IS NOT NULL THEN julianday(closed)-julianday(date_applied) END),1) complete_lifecycle FROM pivots`,
      )
      .get(userId, userId);
    return (
      json(response, 200, {
        ...result,
        note: "Metrics exclude applications without the required stage-history events.",
      }),
      true
    );
  }

  if (path === "/api/settings") {
    const actor = requireAuth(context, { csrf: request.method !== "GET" });
    if (request.method === "GET")
      return (
        json(response, 200, {
          theme: actor.theme_preference,
          week_start: actor.week_start,
          first_follow_up_delay: actor.first_follow_up_delay,
          second_follow_up_delay: actor.second_follow_up_delay,
          follow_up_day_type: actor.follow_up_day_type,
          default_reminder_time: actor.default_reminder_time,
          auto_create_follow_up_reminder: Boolean(
            actor.auto_create_follow_up_reminder,
          ),
        }),
        true
      );
    if (request.method === "PATCH") {
      const input = await body(request);
      if (input.theme && !["light", "dark", "system"].includes(input.theme))
        fail("Invalid theme");
      db.prepare(
        "UPDATE users SET theme_preference=coalesce(?,theme_preference),week_start=coalesce(?,week_start),first_follow_up_delay=coalesce(?,first_follow_up_delay),second_follow_up_delay=coalesce(?,second_follow_up_delay),follow_up_day_type=coalesce(?,follow_up_day_type),default_reminder_time=coalesce(?,default_reminder_time),auto_create_follow_up_reminder=coalesce(?,auto_create_follow_up_reminder),updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(
        input.theme || null,
        input.week_start ?? null,
        input.first_follow_up_delay ?? null,
        input.second_follow_up_delay ?? null,
        input.follow_up_day_type || null,
        input.default_reminder_time || null,
        input.auto_create_follow_up_reminder == null
          ? null
          : Number(Boolean(input.auto_create_follow_up_reminder)),
        actor.id,
      );
      return (json(response, 200, { message: "Settings saved" }), true);
    }
  }

  const detailMatch = path.match(/^\/api\/applications\/(\d+)\/detail$/);
  if (detailMatch && request.method === "GET") {
    const actor = requireAuth(context),
      app = ownedApplication(db, actor, Number(detailMatch[1]));
    if (!app) fail("Not found", 404);
    const related = rows(
      db.prepare(
        "SELECT id,company,job_title,stage,date_applied,priority FROM applications WHERE user_id=? AND lower(company)=lower(?) AND id<>? ORDER BY date_applied DESC",
      ),
      [app.user_id, app.company, app.id],
    );
    const result = {
      application: {
        ...app,
        health: applicationHealth(app),
        tags: rows(
          db.prepare(
            "SELECT t.* FROM tags t JOIN application_tags at ON at.tag_id=t.id WHERE at.application_id=? ORDER BY t.name",
          ),
          [app.id],
        ),
      },
      timeline: rows(
        db.prepare(
          "SELECT te.*,u.username actor_username FROM timeline_events te JOIN users u ON u.id=te.actor_user_id WHERE te.application_id=? ORDER BY te.event_date DESC,te.event_time DESC,te.id DESC",
        ),
        [app.id],
      ),
      stage_history: rows(
        db.prepare(
          "SELECT * FROM stage_history WHERE application_id=? ORDER BY entered_at",
        ),
        [app.id],
      ),
      interviews: rows(
        db.prepare(
          "SELECT * FROM interviews WHERE application_id=? ORDER BY scheduled_at",
        ),
        [app.id],
      ),
      follow_ups: rows(
        db.prepare(
          "SELECT * FROM follow_ups WHERE application_id=? ORDER BY due_date",
        ),
        [app.id],
      ),
      networking: rows(
        db.prepare(
          "SELECT * FROM networking_contacts WHERE application_id=? ORDER BY id DESC",
        ),
        [app.id],
      ),
      checklist: rows(
        db.prepare(
          "SELECT * FROM checklist_items WHERE application_id=? ORDER BY position",
        ),
        [app.id],
      ),
      related,
      previous:
        db
          .prepare(
            "SELECT id FROM applications WHERE user_id=? AND id<? ORDER BY id DESC LIMIT 1",
          )
          .get(app.user_id, app.id)?.id || null,
      next:
        db
          .prepare(
            "SELECT id FROM applications WHERE user_id=? AND id>? ORDER BY id LIMIT 1",
          )
          .get(app.user_id, app.id)?.id || null,
    };
    if (actor.role === "MANAGER")
      result.audit = rows(
        db.prepare(
          "SELECT al.*,u.username actor_username FROM audit_log al JOIN users u ON u.id=al.actor_user_id WHERE al.entity_type='application' AND al.entity_id=? ORDER BY al.created_at DESC",
        ),
        [app.id],
      );
    return (json(response, 200, result), true);
  }

  const timelineMatch = path.match(
    /^\/api\/applications\/(\d+)\/timeline(?:\/(csv|json))?$/,
  );
  if (timelineMatch) {
    const actor = requireAuth(context, { csrf: request.method === "POST" }),
      app = ownedApplication(db, actor, Number(timelineMatch[1]));
    if (!app) fail("Not found", 404);
    if (request.method === "POST" && !timelineMatch[2]) {
      const input = await body(request);
      if (!input.event_date || !input.title)
        fail("Event date and title are required");
      if (input.stage && input.stage !== app.stage)
        changeStage(db, app, actor.id, input.stage);
      const id = timeline(db, app, actor.id, { ...input, source: "manual" });
      if (input.next_action || input.next_action_date)
        db.prepare(
          "UPDATE applications SET next_action=coalesce(?,next_action),next_action_date=coalesce(?,next_action_date),updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(
          input.next_action || null,
          input.next_action_date || null,
          actor.id,
          app.id,
        );
      return (json(response, 201, { id }), true);
    }
    const conditions = ["application_id=?"],
      params = [app.id],
      category = url.searchParams.get("category");
    if (category && category !== "all") {
      conditions.push(
        category === "automatic" || category === "manual"
          ? "source=?"
          : "category=?",
      );
      params.push(category);
    }
    if (url.searchParams.get("date_from")) {
      conditions.push("event_date>=?");
      params.push(url.searchParams.get("date_from"));
    }
    if (url.searchParams.get("date_to")) {
      conditions.push("event_date<=?");
      params.push(url.searchParams.get("date_to"));
    }
    const direction = url.searchParams.get("sort") === "asc" ? "ASC" : "DESC";
    const events = rows(
      db.prepare(
        `SELECT te.*,u.username actor_username FROM timeline_events te JOIN users u ON u.id=te.actor_user_id WHERE ${conditions.join(" AND ")} ORDER BY event_date ${direction},event_time ${direction},te.id ${direction}`,
      ),
      params,
    );
    if (!timelineMatch[2]) return (json(response, 200, events), true);
    const filters = Object.fromEntries(url.searchParams);
    if (timelineMatch[2] === "json")
      return (
        sendDownload(
          response,
          `application-${app.id}-timeline.json`,
          "application/json; charset=utf-8",
          JSON.stringify(
            {
              export_version: 1,
              export_type: "application_timeline",
              exported_at: new Date().toISOString(),
              application: {
                id: app.id,
                company: app.company,
                job_title: app.job_title,
              },
              filters,
              timeline: events,
            },
            null,
            2,
          ),
        ),
        true
      );
    const fields = [
      "event_date",
      "event_time",
      "category",
      "event_type",
      "stage",
      "title",
      "description",
      "contact_person",
      "source",
      "actor_username",
      "related_record_type",
      "created_at",
      "updated_at",
    ];
    return (
      sendDownload(
        response,
        `application-${app.id}-timeline.csv`,
        "text/csv; charset=utf-8",
        [
          fields.join(","),
          ...events.map((event) =>
            fields.map((field) => csvEscape(event[field])).join(","),
          ),
        ].join("\n"),
      ),
      true
    );
  }

  const appAction = path.match(
    /^\/api\/applications\/(\d+)\/(archive|restore|pin|next-action|checklist)(?:\/(\d+))?$/,
  );
  if (appAction) {
    const actor = requireAuth(context, { csrf: true }),
      app = ownedApplication(db, actor, Number(appAction[1]));
    if (!app) fail("Not found", 404);
    const action = appAction[2],
      input = await body(request);
    if (["archive", "restore"].includes(action)) {
      const next = action === "archive" ? new Date().toISOString() : null;
      db.prepare(
        "UPDATE applications SET archived_at=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(next, actor.id, app.id);
      timeline(db, app, actor.id, {
        category: "application",
        event_type: `application_${action}d`,
        title: `Application ${action}d`,
        source: "automatic",
      });
      audit(
        db,
        app.user_id,
        actor.id,
        action,
        "application",
        app.id,
        "archived_at",
        app.archived_at,
        next,
      );
    } else if (action === "pin") {
      db.prepare(
        "UPDATE applications SET pinned=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(Number(Boolean(input.pinned)), actor.id, app.id);
    } else if (action === "next-action") {
      db.prepare(
        "UPDATE applications SET next_action_completed_at=CURRENT_TIMESTAMP,next_action=?,next_action_date=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(
        input.next_action || null,
        input.next_action_date || null,
        actor.id,
        app.id,
      );
      timeline(db, app, actor.id, {
        category: "follow_up",
        event_type: "next_action_completed",
        title: "Next action completed",
        description: app.next_action,
        source: "automatic",
      });
    } else if (action === "checklist") {
      if (appAction[3]) {
        const item = owned(db, actor, "checklist_items", Number(appAction[3]));
        if (item.application_id !== app.id) fail("Not found", 404);
        db.prepare(
          "UPDATE checklist_items SET completed=?,completed_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END,note=coalesce(?,note),updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(
          Number(Boolean(input.completed)),
          Number(Boolean(input.completed)),
          input.note || null,
          item.id,
        );
      } else {
        const position = db
          .prepare(
            "SELECT coalesce(max(position),-1)+1 position FROM checklist_items WHERE application_id=?",
          )
          .get(app.id).position;
        db.prepare(
          "INSERT INTO checklist_items(application_id,user_id,label,is_custom,position) VALUES (?,?,?,1,?)",
        ).run(app.id, app.user_id, input.label, position);
      }
    }
    return (json(response, 200, { message: "Application updated" }), true);
  }

  const resourceMatch = path.match(
    /^\/api\/(resumes|reminders|saved-views|tags)(?:\/(\d+))?$/,
  );
  if (resourceMatch) {
    const type = resourceMatch[1],
      id = Number(resourceMatch[2]),
      actor = requireAuth(context, { csrf: request.method !== "GET" }),
      table = type === "saved-views" ? "saved_views" : type;
    if (!id && request.method === "GET") {
      const userId = ownerId(actor, Object.fromEntries(url.searchParams));
      let sql = `SELECT * FROM ${table} WHERE user_id=?`;
      if (table === "reminders") sql += " ORDER BY due_date,due_time";
      else sql += " ORDER BY id DESC";
      let items = rows(db.prepare(sql), [userId]);
      if (table === "reminders")
        items = items.map((item) => ({
          ...item,
          calculated_status: reminderState(item),
        }));
      return (json(response, 200, items), true);
    }
    if (!id && request.method === "POST") {
      const input = await body(request),
        userId = targetOwner(db, actor, input);
      if (table === "resumes") {
        if (!input.version_name) fail("Version name is required");
        const result = db
          .prepare(
            "INSERT INTO resumes(user_id,version_name,revision_label,parent_resume_id,target_role,job_category,file_name,resume_date,is_active,is_default,notes,change_summary) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            userId,
            input.version_name,
            input.revision_label || null,
            input.parent_resume_id || null,
            input.target_role || null,
            input.job_category || null,
            input.file_name || null,
            input.resume_date || isoDate(),
            Number(input.is_active !== false),
            Number(Boolean(input.is_default)),
            input.notes || null,
            input.change_summary || null,
          );
        if (input.is_default)
          db.prepare(
            "UPDATE resumes SET is_default=0 WHERE user_id=? AND id<>?",
          ).run(userId, result.lastInsertRowid);
        db.prepare(
          "INSERT INTO resume_history(resume_id,user_id,actor_user_id,action,version_name,parent_resume_id,change_summary) VALUES (?,?,?,?,?,?,?)",
        ).run(
          result.lastInsertRowid,
          userId,
          actor.id,
          "created",
          input.version_name,
          input.parent_resume_id || null,
          input.change_summary || null,
        );
        return (
          json(response, 201, { id: Number(result.lastInsertRowid) }),
          true
        );
      }
      if (table === "reminders") {
        if (!input.title || !input.due_date || !input.category_id)
          fail("Title, due date, and category are required");
        activeCategory(db, userId, input.category_id);
        if (!REMINDER_PRIORITIES.includes(input.priority || "Medium"))
          fail("Invalid priority");
        const result = db
          .prepare(
            "INSERT INTO reminders(user_id,category_id,related_record_type,related_record_id,title,description,due_date,due_time,priority,status) VALUES (?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            userId,
            input.category_id,
            input.related_record_type || null,
            input.related_record_id || null,
            input.title,
            input.description || null,
            input.due_date,
            input.due_time || null,
            input.priority || "Medium",
            "Upcoming",
          );
        return (
          json(response, 201, { id: Number(result.lastInsertRowid) }),
          true
        );
      }
      if (table === "saved_views") {
        const result = db
          .prepare(
            "INSERT INTO saved_views(user_id,view_type,name,filters_json,sorting_json,columns_json,is_default) VALUES (?,?,?,?,?,?,?)",
          )
          .run(
            userId,
            input.view_type || "applications",
            input.name,
            JSON.stringify(input.filters || {}),
            JSON.stringify(input.sorting || {}),
            JSON.stringify(input.columns || []),
            Number(Boolean(input.is_default)),
          );
        return (
          json(response, 201, { id: Number(result.lastInsertRowid) }),
          true
        );
      }
      if (table === "tags") {
        const result = db
          .prepare("INSERT INTO tags(user_id,name,color) VALUES (?,?,?)")
          .run(userId, input.name, input.color || "#64748b");
        return (
          json(response, 201, { id: Number(result.lastInsertRowid) }),
          true
        );
      }
    }
    if (id && ["PATCH", "DELETE"].includes(request.method)) {
      const record = owned(db, actor, table, id),
        input = await body(request);
      if (request.method === "DELETE") {
        if (
          table === "resumes" &&
          db
            .prepare("SELECT 1 FROM applications WHERE resume_id=? LIMIT 1")
            .get(id)
        )
          fail("Archive linked resumes instead of deleting them");
        db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
        return (json(response, 200, { message: "Deleted" }), true);
      }
      const columns = new Set(
        db
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .map((item) => item.name),
      );
      const fields = Object.keys(input).filter(
        (key) =>
          columns.has(key) &&
          !["id", "user_id", "created_at", "updated_at"].includes(key),
      );
      if (table === "reminders" && input.category_id)
        activeCategory(db, record.user_id, input.category_id);
      if (table === "resumes" && input.is_default)
        db.prepare(
          "UPDATE resumes SET is_default=0 WHERE user_id=? AND id<>?",
        ).run(record.user_id, id);
      if (fields.length)
        db.prepare(
          `UPDATE ${table} SET ${fields.map((key) => `${key}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        ).run(...fields.map((key) => input[key]), id);
      if (table === "resumes")
        db.prepare(
          "INSERT INTO resume_history(resume_id,user_id,actor_user_id,action,version_name,parent_resume_id,change_summary,details_json) VALUES (?,?,?,?,?,?,?,?)",
        ).run(
          id,
          record.user_id,
          actor.id,
          input.is_archived == null
            ? "updated"
            : input.is_archived
              ? "archived"
              : "restored",
          input.version_name || record.version_name,
          input.parent_resume_id || record.parent_resume_id,
          input.change_summary || record.change_summary,
          JSON.stringify(input),
        );
      return (json(response, 200, { message: "Updated" }), true);
    }
  }

  if (path === "/api/resumes/analytics" && request.method === "GET") {
    const actor = requireAuth(context),
      userId = ownerId(actor, Object.fromEntries(url.searchParams));
    const items = rows(
      db.prepare(
        "SELECT r.id,r.version_name,count(a.id) applications,sum(a.last_response_date IS NOT NULL) responses,sum(a.stage='Assessment') assessments,sum(a.stage='Recruiter Screen') recruiter_screens,sum(a.stage IN ('Interview','Final Interview','Offer','Accepted')) interviews,sum(a.stage='Final Interview') final_interviews,sum(a.stage IN ('Offer','Accepted')) offers,sum(a.stage='Accepted') acceptances,sum(a.stage='Rejected') rejections,sum(a.stage='Ghosted') ghosted FROM resumes r LEFT JOIN applications a ON a.resume_id=r.id WHERE r.user_id=? GROUP BY r.id ORDER BY applications DESC",
      ),
      [userId],
    ).map((item) => ({
      ...item,
      response_rate: item.applications
        ? Math.round((item.responses / item.applications) * 1000) / 10
        : 0,
      interview_conversion: item.applications
        ? Math.round((item.interviews / item.applications) * 1000) / 10
        : 0,
      offer_conversion: item.applications
        ? Math.round((item.offers / item.applications) * 1000) / 10
        : 0,
      sample_size: item.applications,
    }));
    return (json(response, 200, items), true);
  }

  const categoryMatch = path.match(/^\/api\/reminder-categories(?:\/(\d+))?$/);
  if (categoryMatch) {
    const id = Number(categoryMatch[1]),
      actor = requireAuth(context, { csrf: request.method !== "GET" });
    if (!id && request.method === "GET") {
      const items = rows(
        db.prepare(
          "SELECT c.*,(SELECT count(*) FROM reminders r WHERE r.category_id=c.id AND r.user_id=?) reminder_count FROM reminder_categories c WHERE c.is_builtin=1 OR c.user_id=? ORDER BY c.is_builtin DESC,c.name",
        ),
        [actor.id, actor.id],
      );
      return (json(response, 200, items), true);
    }
    const input = await body(request);
    if (!id && request.method === "POST") {
      const result = db
        .prepare(
          "INSERT INTO reminder_categories(user_id,name,color,icon,is_default) VALUES (?,?,?,?,?)",
        )
        .run(
          actor.id,
          input.name,
          input.color || "#64748b",
          input.icon || "bell",
          Number(Boolean(input.is_default)),
        );
      return (
        json(response, 201, { id: Number(result.lastInsertRowid) }),
        true
      );
    }
    const record = owned(db, actor, "reminder_categories", id);
    if (record.is_builtin) fail("Built-in categories cannot be changed");
    if (request.method === "PATCH") {
      db.prepare(
        "UPDATE reminder_categories SET name=coalesce(?,name),color=coalesce(?,color),icon=coalesce(?,icon),archived_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(
        input.name || null,
        input.color || null,
        input.icon || null,
        input.archived
          ? new Date().toISOString()
          : input.restore
            ? null
            : record.archived_at,
        id,
      );
      return (json(response, 200, { message: "Category updated" }), true);
    }
    if (request.method === "DELETE") {
      const count = db
        .prepare("SELECT count(*) count FROM reminders WHERE category_id=?")
        .get(id).count;
      if (count && !input.reassign_to)
        fail("Reassign reminders before deleting this category");
      if (count) {
        activeCategory(db, actor.id, input.reassign_to);
        db.prepare(
          "UPDATE reminders SET category_id=? WHERE category_id=?",
        ).run(input.reassign_to, id);
      }
      db.prepare("DELETE FROM reminder_categories WHERE id=?").run(id);
      return (json(response, 200, { message: "Category deleted" }), true);
    }
  }

  if (path === "/api/follow-ups/suggest" && request.method === "GET") {
    const actor = requireAuth(context),
      app = ownedApplication(
        db,
        actor,
        Number(url.searchParams.get("application_id")),
      );
    if (!app) fail("Not found", 404);
    const first = businessAdd(
        app.date_applied,
        actor.first_follow_up_delay,
        actor.follow_up_day_type === "business",
      ),
      second = businessAdd(
        first,
        actor.second_follow_up_delay,
        actor.follow_up_day_type === "business",
      );
    return (
      json(response, 200, {
        date_applied: app.date_applied,
        suggested_first_follow_up: first,
        suggested_second_follow_up: second,
        day_type: actor.follow_up_day_type,
      }),
      true
    );
  }

  if (path === "/api/calendar" && request.method === "GET") {
    const actor = requireAuth(context),
      userId = ownerId(actor, Object.fromEntries(url.searchParams)),
      { start, end } = queryRange(url, 35),
      events = [];
    const add = (items, type, dateField, title) =>
      items.forEach((item) =>
        events.push({
          id: `${type}-${item.id}`,
          type,
          date: item[dateField],
          title: title(item),
          related_record_type: item.application_id ? "application" : type,
          related_record_id: item.application_id || item.id,
          completed: ["Completed", "Cancelled"].includes(item.status),
        }),
      );
    add(
      rows(
        db.prepare(
          "SELECT * FROM applications WHERE user_id=? AND date_applied BETWEEN ? AND ?",
        ),
        [userId, start, end],
      ),
      "application",
      "date_applied",
      (item) => `Applied: ${item.company} — ${item.job_title}`,
    );
    add(
      rows(
        db.prepare(
          "SELECT i.*,a.company,a.job_title FROM interviews i JOIN applications a ON a.id=i.application_id WHERE i.user_id=? AND substr(i.scheduled_at,1,10) BETWEEN ? AND ?",
        ),
        [userId, start, end],
      ),
      "interview",
      "scheduled_at",
      (item) => `Interview: ${item.company} — ${item.job_title}`,
    );
    add(
      rows(
        db.prepare(
          "SELECT * FROM follow_ups WHERE user_id=? AND due_date BETWEEN ? AND ?",
        ),
        [userId, start, end],
      ),
      "follow_up",
      "due_date",
      (item) => `Follow-up: ${item.follow_up_type}`,
    );
    add(
      rows(
        db.prepare(
          "SELECT * FROM networking_contacts WHERE user_id=? AND next_follow_up_date BETWEEN ? AND ?",
        ),
        [userId, start, end],
      ),
      "networking",
      "next_follow_up_date",
      (item) => `Networking: ${item.contact_name}`,
    );
    add(
      rows(
        db.prepare(
          "SELECT * FROM reminders WHERE user_id=? AND due_date BETWEEN ? AND ?",
        ),
        [userId, start, end],
      ),
      "reminder",
      "due_date",
      (item) => item.title,
    );
    add(
      rows(
        db.prepare(
          "SELECT * FROM applications WHERE user_id=? AND next_action_date BETWEEN ? AND ?",
        ),
        [userId, start, end],
      ),
      "next_action",
      "next_action_date",
      (item) => `Next: ${item.next_action}`,
    );
    add(
      rows(
        db.prepare(
          "SELECT * FROM goal_settings WHERE user_id=? AND effective_date BETWEEN ? AND ?",
        ),
        [userId, start, end],
      ),
      "goal",
      "effective_date",
      (item) =>
        `Goal checkpoint: ${item.period_type} ${item.category} (${item.target})`,
    );
    return (
      json(response, 200, {
        view: url.searchParams.get("view") || "month",
        start,
        end,
        events: events
          .filter(
            (event) =>
              url.searchParams.get("completed") !== "false" || !event.completed,
          )
          .sort((a, b) => a.date.localeCompare(b.date)),
      }),
      true
    );
  }

  if (path === "/api/goals/settings") {
    const actor = requireAuth(context, { csrf: request.method !== "GET" });
    if (request.method === "GET")
      return (
        json(
          response,
          200,
          rows(
            db.prepare(
              "SELECT * FROM goal_settings WHERE user_id=? ORDER BY period_type,category,effective_date DESC",
            ),
            [actor.id],
          ),
        ),
        true
      );
    if (request.method === "POST") {
      const input = await body(request);
      if (
        !["daily", "weekly"].includes(input.period_type) ||
        !GOAL_CATEGORIES.includes(input.category) ||
        Number(input.target) < 0
      )
        fail("Invalid goal setting");
      const effective = input.effective_date || isoDate(),
        prior = db
          .prepare(
            "SELECT * FROM goal_settings WHERE user_id=? AND period_type=? AND category=? AND end_date IS NULL ORDER BY effective_date DESC LIMIT 1",
          )
          .get(actor.id, input.period_type, input.category);
      if (prior && prior.effective_date < effective)
        db.prepare(
          "UPDATE goal_settings SET end_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(addDays(effective, -1), prior.id);
      const result = db
        .prepare(
          "INSERT INTO goal_settings(user_id,period_type,category,enabled,target,effective_date,end_date) VALUES (?,?,?,?,?,?,?)",
        )
        .run(
          actor.id,
          input.period_type,
          input.category,
          Number(input.enabled !== false),
          Number(input.target),
          effective,
          input.end_date || null,
        );
      return (
        json(response, 201, { id: Number(result.lastInsertRowid) }),
        true
      );
    }
  }

  if (path === "/api/goals/history" || path === "/api/goals/comparison") {
    const actor = requireAuth(context),
      query = Object.fromEntries(url.searchParams),
      { start, end } = queryRange(url, 30),
      period = query.period_type || "daily";
    const requestedUsers =
      actor.role === "MANAGER" && query.user_ids
        ? query.user_ids.split(",").map(Number).filter(Boolean)
        : [ownerId(actor, query)];
    const results = requestedUsers.map((userId) => {
      const calculationPeriod = period === "monthly" ? "daily" : period;
      recalculateGoals(db, userId, calculationPeriod, start, end);
      let items = rows(
        db.prepare(
          "SELECT * FROM goal_snapshots WHERE user_id=? AND period_type=? AND period_start BETWEEN ? AND ? ORDER BY period_start,category",
        ),
        [userId, calculationPeriod, start, end],
      );
      if (period === "monthly") {
        const groups = new Map();
        for (const item of items) {
          const key = `${item.period_start.slice(0, 7)}:${item.category}`,
            existing = groups.get(key) || {
              user_id: userId,
              period_type: "monthly",
              period_start: `${item.period_start.slice(0, 7)}-01`,
              period_end: item.period_end,
              category: item.category,
              target: 0,
              actual: 0,
            };
          existing.target += item.target;
          existing.actual += item.actual;
          existing.period_end = item.period_end;
          groups.set(key, existing);
        }
        items = [...groups.values()].map((item) => ({
          ...item,
          completion_percentage: item.target
            ? Math.round((item.actual / item.target) * 1000) / 10
            : 0,
          achieved: Number(item.actual >= item.target),
        }));
      }
      if (query.category)
        items = items.filter((item) => item.category === query.category);
      return { user_id: userId, summary: comparison(items), items };
    });
    if (requestedUsers.length > 1)
      return (
        json(response, 200, {
          users: results,
          summary: comparison(results.flatMap((item) => item.items)),
        }),
        true
      );
    return (
      json(response, 200, {
        items: results[0].items,
        summary: results[0].summary,
      }),
      true
    );
  }

  if (path === "/api/dashboard/layout") {
    const actor = requireAuth(context, { csrf: request.method !== "GET" }),
      type =
        url.searchParams.get("type") === "manager" && actor.role === "MANAGER"
          ? "manager"
          : "user";
    if (request.method === "GET") {
      const defaults = defaultWidgets(type);
      const stored = rows(
        db.prepare(
          "SELECT * FROM dashboard_preferences WHERE user_id=? AND dashboard_type=? ORDER BY position",
        ),
        [actor.id, type],
      ).map((item) => ({ ...item, settings: JSON.parse(item.settings_json) }));
      return (
        json(response, 200, {
          dashboard_type: type,
          widgets: stored.length ? stored : defaults,
          defaults,
        }),
        true
      );
    }
    if (request.method === "PUT") {
      const input = await body(request);
      if (
        !Array.isArray(input.widgets) ||
        new Set(input.widgets.map((item) => item.widget_id)).size !==
          input.widgets.length ||
        input.widgets.some((item) => !BUILTIN_WIDGETS.includes(item.widget_id))
      )
        fail("Invalid widget layout");
      db.exec("BEGIN");
      try {
        db.prepare(
          "DELETE FROM dashboard_preferences WHERE user_id=? AND dashboard_type=?",
        ).run(actor.id, type);
        const insert = db.prepare(
          "INSERT INTO dashboard_preferences(user_id,dashboard_type,widget_id,enabled,position,width,height,settings_json) VALUES (?,?,?,?,?,?,?,?)",
        );
        input.widgets.forEach((item, position) =>
          insert.run(
            actor.id,
            type,
            item.widget_id,
            Number(item.enabled !== false),
            position,
            Math.min(3, Math.max(1, Number(item.width) || 1)),
            Math.min(3, Math.max(1, Number(item.height) || 1)),
            JSON.stringify(item.settings || {}),
          ),
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return (json(response, 200, { message: "Layout saved" }), true);
    }
    if (request.method === "DELETE") {
      db.prepare(
        "DELETE FROM dashboard_preferences WHERE user_id=? AND dashboard_type=?",
      ).run(actor.id, type);
      return (json(response, 200, { widgets: defaultWidgets(type) }), true);
    }
  }

  if (path.startsWith("/api/analytics/")) {
    const actor = requireAuth(context),
      query = Object.fromEntries(url.searchParams),
      userId = ownerId(actor, query),
      { start, end } = queryRange(url, 365),
      kind = path.split("/").at(-1);
    if (kind === "aging") {
      const items = rows(
        db.prepare(
          db.dialect === "postgres"
            ? "SELECT a.*,coalesce(max(te.event_date),a.date_applied) last_activity,CAST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-coalesce(max(te.event_date)::timestamp,a.date_applied::timestamp)))/86400 AS INTEGER) days_inactive FROM applications a LEFT JOIN timeline_events te ON te.application_id=a.id WHERE a.user_id=? GROUP BY a.id ORDER BY days_inactive DESC"
            : "SELECT a.*,coalesce(max(te.event_date),a.date_applied) last_activity,CAST(julianday('now')-julianday(coalesce(max(te.event_date),a.date_applied)) AS INTEGER) days_inactive FROM applications a LEFT JOIN timeline_events te ON te.application_id=a.id WHERE a.user_id=? GROUP BY a.id ORDER BY days_inactive DESC",
        ),
        [userId],
      ).map((item) => ({
        ...item,
        aging_category: agingCategory(item.days_inactive),
        health: applicationHealth(item),
      }));
      const summary = Object.fromEntries(
        [
          "New",
          "Waiting",
          "Follow-Up Recommended",
          "Stale",
          "Long Waiting",
        ].map((band) => [
          band,
          items.filter((item) => item.aging_category === band).length,
        ]),
      );
      return (json(response, 200, { items, summary }), true);
    }
    if (kind === "stage-duration") {
      const visits = rows(
        db.prepare(
          "SELECT sh.*,a.company,a.job_title FROM stage_history sh JOIN applications a ON a.id=sh.application_id WHERE sh.user_id=? AND substr(sh.entered_at,1,10) BETWEEN ? AND ?",
        ),
        [userId, start, end],
      ).map((item) => ({
        ...item,
        duration_days: Math.max(
          0,
          (timestampMs(item.left_at) - timestampMs(item.entered_at)) / 86400000,
        ),
      }));
      const stages = STAGES.map((stage) => {
        const values = visits
          .filter((v) => v.new_stage === stage && v.left_at)
          .map((v) => v.duration_days)
          .sort((a, b) => a - b);
        return {
          stage,
          sample_size: values.length,
          average: average(values),
          median: values.length
            ? (values[Math.floor((values.length - 1) / 2)] +
                values[Math.ceil((values.length - 1) / 2)]) /
              2
            : null,
          minimum: values.length ? values[0] : null,
          maximum: values.length ? values.at(-1) : null,
        };
      });
      return (
        json(response, 200, {
          stages,
          stalled: visits.filter(
            (item) => !item.left_at && item.duration_days >= 14,
          ),
          insufficient_data: visits.filter((item) => item.left_at).length === 0,
        }),
        true
      );
    }
    if (kind === "source") {
      const items = rows(
        db.prepare(
          "SELECT coalesce(source,'Other') source,count(*) applications,sum(last_response_date IS NOT NULL) responses,sum(stage IN ('Interview','Final Interview','Offer','Accepted')) interviews,sum(stage IN ('Offer','Accepted')) offers,sum(stage='Rejected') rejections FROM applications WHERE user_id=? AND date_applied BETWEEN ? AND ? GROUP BY source ORDER BY applications DESC",
        ),
        [userId, start, end],
      ).map(rates);
      return (json(response, 200, items), true);
    }
    if (kind === "funnel") {
      const items = rows(
        db.prepare(
          "SELECT stage,count(*) count FROM applications WHERE user_id=? AND date_applied BETWEEN ? AND ? GROUP BY stage",
        ),
        [userId, start, end],
      );
      const total = items.reduce((sum, item) => sum + item.count, 0);
      return (
        json(response, 200, {
          total,
          stages: STAGES.map((stage) => ({
            stage,
            count: items.find((item) => item.stage === stage)?.count || 0,
            percentage: total
              ? Math.round(
                  ((items.find((item) => item.stage === stage)?.count || 0) /
                    total) *
                    1000,
                ) / 10
              : 0,
          })),
        }),
        true
      );
    }
    if (kind === "activity") {
      const group =
        query.group === "month"
          ? "%Y-%m"
          : query.group === "week"
            ? "%Y-%W"
            : "%Y-%m-%d";
      return (
        json(
          response,
          200,
          rows(
            db.prepare(
              `SELECT strftime('${group}',event_date) period,count(*) events,sum(category='interview') interviews,sum(category='follow_up') follow_ups,sum(category='rejection') rejections FROM timeline_events WHERE user_id=? AND event_date BETWEEN ? AND ? GROUP BY period ORDER BY period`,
            ),
            [userId, start, end],
          ),
        ),
        true
      );
    }
  }

  if (path.startsWith("/api/exports/")) {
    const actor = requireAuth(context),
      query = Object.fromEntries(url.searchParams),
      userId = ownerId(actor, query),
      type = path.split("/").at(-1);
    if (type === "json") {
      const data = {
        profile: {
          id: userId,
          ...db
            .prepare(
              "SELECT username,email,full_name,phone,role,is_active,created_at FROM users WHERE id=?",
            )
            .get(userId),
        },
        applications: rows(
          db.prepare("SELECT * FROM applications WHERE user_id=?"),
          [userId],
        ),
        timeline: rows(
          db.prepare("SELECT * FROM timeline_events WHERE user_id=?"),
          [userId],
        ),
        stage_history: rows(
          db.prepare("SELECT * FROM stage_history WHERE user_id=?"),
          [userId],
        ),
        interviews: rows(
          db.prepare("SELECT * FROM interviews WHERE user_id=?"),
          [userId],
        ),
        rejections: rows(
          db.prepare("SELECT * FROM rejections WHERE user_id=?"),
          [userId],
        ),
        follow_ups: rows(
          db.prepare("SELECT * FROM follow_ups WHERE user_id=?"),
          [userId],
        ),
        networking: rows(
          db.prepare("SELECT * FROM networking_contacts WHERE user_id=?"),
          [userId],
        ),
        resumes: rows(db.prepare("SELECT * FROM resumes WHERE user_id=?"), [
          userId,
        ]),
        reminders: rows(db.prepare("SELECT * FROM reminders WHERE user_id=?"), [
          userId,
        ]),
        reminder_categories: rows(
          db.prepare(
            "SELECT * FROM reminder_categories WHERE is_builtin=1 OR user_id=?",
          ),
          [userId],
        ),
        goal_settings: rows(
          db.prepare("SELECT * FROM goal_settings WHERE user_id=?"),
          [userId],
        ),
        goal_history: rows(
          db.prepare("SELECT * FROM goal_snapshots WHERE user_id=?"),
          [userId],
        ),
        dashboard_preferences: rows(
          db.prepare("SELECT * FROM dashboard_preferences WHERE user_id=?"),
          [userId],
        ),
        saved_views: rows(
          db.prepare("SELECT * FROM saved_views WHERE user_id=?"),
          [userId],
        ),
        tags: rows(db.prepare("SELECT * FROM tags WHERE user_id=?"), [userId]),
      };
      return (
        sendDownload(
          response,
          "jobquest-export.json",
          "application/json; charset=utf-8",
          JSON.stringify(
            { export_version: 1, exported_at: new Date().toISOString(), data },
            null,
            2,
          ),
        ),
        true
      );
    }
    const tables = {
      applications: "applications",
      interviews: "interviews",
      rejections: "rejections",
      follow_ups: "follow_ups",
      networking: "networking_contacts",
      reminders: "reminders",
      goals: "goal_snapshots",
    };
    let items;
    if (tables[type])
      items = rows(
        db.prepare(`SELECT * FROM ${tables[type]} WHERE user_id=?`),
        [userId],
      );
    else if (type === "resume-analytics")
      items = rows(
        db.prepare(
          "SELECT r.version_name,count(a.id) applications,sum(a.last_response_date IS NOT NULL) responses,sum(a.stage IN ('Interview','Final Interview','Offer','Accepted')) interviews,sum(a.stage IN ('Offer','Accepted')) offers,sum(a.stage='Accepted') acceptances FROM resumes r LEFT JOIN applications a ON a.resume_id=r.id WHERE r.user_id=? GROUP BY r.id",
        ),
        [userId],
      );
    else if (type === "aging")
      items = rows(
        db.prepare(
          "SELECT a.id,a.company,a.job_title,a.stage,a.date_applied,coalesce(max(te.event_date),a.date_applied) last_activity,CAST(julianday('now')-julianday(coalesce(max(te.event_date),a.date_applied)) AS INTEGER) days_inactive,a.next_action,a.next_action_date FROM applications a LEFT JOIN timeline_events te ON te.application_id=a.id WHERE a.user_id=? GROUP BY a.id ORDER BY days_inactive DESC",
        ),
        [userId],
      ).map((item) => ({
        ...item,
        aging_category: agingCategory(item.days_inactive),
        health: applicationHealth(item),
      }));
    else if (type === "stage-duration")
      items = rows(
        db.prepare(
          "SELECT sh.application_id,a.company,a.job_title,sh.new_stage stage,sh.entered_at,sh.left_at,round(julianday(coalesce(sh.left_at,CURRENT_TIMESTAMP))-julianday(sh.entered_at),2) duration_days FROM stage_history sh JOIN applications a ON a.id=sh.application_id WHERE sh.user_id=? ORDER BY sh.entered_at",
        ),
        [userId],
      );
    else fail("Unsupported export", 404);
    const fields = items.length
      ? Object.keys(items[0]).filter(
          (key) => !key.includes("password") && !key.includes("token"),
        )
      : [];
    return (
      sendDownload(
        response,
        `${type}.csv`,
        "text/csv; charset=utf-8",
        [
          fields.join(","),
          ...items.map((item) =>
            fields.map((field) => csvEscape(item[field])).join(","),
          ),
        ].join("\n"),
      ),
      true
    );
  }

  if (path === "/api/manager/audit" && request.method === "GET") {
    requireAuth(context, { manager: true });
    return (
      json(
        response,
        200,
        rows(
          db.prepare(
            "SELECT al.*,owner.username owner_username,actor.username actor_username FROM audit_log al JOIN users owner ON owner.id=al.user_id JOIN users actor ON actor.id=al.actor_user_id ORDER BY al.created_at DESC LIMIT 500",
          ),
        ),
      ),
      true
    );
  }
  return false;
}

function agingCategory(days) {
  if (days <= 3) return "New";
  if (days <= 7) return "Waiting";
  if (days <= 14) return "Follow-Up Recommended";
  if (days <= 30) return "Stale";
  return "Long Waiting";
}
function applicationHealth(app) {
  if (
    [
      "Rejected",
      "Withdrawn",
      "Ghosted",
      "Position Closed",
      "Accepted",
    ].includes(app.stage)
  )
    return "Closed";
  if (app.next_action_date && app.next_action_date < isoDate())
    return "Overdue";
  const days = Number(
    app.days_inactive ??
      Math.floor(
        (Date.now() -
          Date.parse(
            `${app.updated_at?.replace(" ", "T") || app.date_applied}Z`,
          )) /
          86400000,
      ),
  );
  if (days > 14) return "Action Needed";
  if (days > 7) return "Waiting";
  return "On Track";
}
function average(values) {
  return values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : null;
}
function rates(item) {
  return {
    ...item,
    response_rate: item.applications
      ? Math.round((item.responses / item.applications) * 1000) / 10
      : 0,
    interview_rate: item.applications
      ? Math.round((item.interviews / item.applications) * 1000) / 10
      : 0,
    offer_rate: item.applications
      ? Math.round((item.offers / item.applications) * 1000) / 10
      : 0,
  };
}
