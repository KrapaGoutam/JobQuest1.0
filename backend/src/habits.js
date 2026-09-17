import { rows } from "./db.js";

export const FREQUENCIES = ["daily", "weekdays", "weekly"];
const HABIT_FIELDS = ["name", "description", "frequency", "target_count", "active"];
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
// A genuine streak longer than this displays capped - a deliberate, documented bound
// (see docs/FEATURE_UPGRADE_8.md Known Debt), not an oversight. Also the window used
// to fetch a habit's logs for both progress and streak computation in one query.
const STREAK_LOOKBACK_DAYS = 365;

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
const clean = (value) => (typeof value === "string" ? value.trim() : value);
const isoDate = (date = new Date()) => date.toISOString().slice(0, 10);
const addDays = (dateStr, count) => {
  const result = new Date(`${dateStr}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + count);
  return isoDate(result);
};
const isWeekday = (dateStr) => {
  const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
};
// Pure and exported for unit testing (date injection, not the live clock) - see
// docs/FEATURE_UPGRADE_8.md Testing. daily/weekly habits are "in play" every day
// (weekly is a target-per-week, not tied to one day); weekdays habits are not due
// on Saturday/Sunday.
export function isDueToday(frequency, dateStr) {
  return frequency === "weekdays" ? isWeekday(dateStr) : true;
}
const isDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export function validateHabit(input, { partial = false } = {}) {
  const data = {};
  const errors = [];
  for (const [rawKey, rawValue] of Object.entries(input || {})) {
    const lower = rawKey.toLowerCase();
    if (forbidden.has(lower)) {
      errors.push(`${rawKey} is not allowed`);
      continue;
    }
    if (!HABIT_FIELDS.includes(lower)) {
      errors.push(`Unknown field: ${rawKey}`);
      continue;
    }
    data[lower] = clean(rawValue);
  }
  if (!partial || "name" in data) {
    data.name = String(data.name || "").trim();
    if (!data.name) errors.push("Name is required");
    else if (data.name.length > 120)
      errors.push("Name must be 120 characters or fewer");
  }
  if (data.description !== undefined) {
    data.description = String(data.description ?? "").trim();
    if (data.description.length > 1000)
      errors.push("Description must be 1000 characters or fewer");
    if (!data.description) data.description = null;
  }
  if (!partial || "frequency" in data) {
    if (!FREQUENCIES.includes(data.frequency))
      errors.push(`Unsupported frequency: ${data.frequency}`);
  }
  if (data.target_count !== undefined) {
    data.target_count = Number(data.target_count);
    if (
      !Number.isSafeInteger(data.target_count) ||
      data.target_count < 1 ||
      data.target_count > 1000
    )
      errors.push("target_count must be a whole number between 1 and 1000");
  } else if (!partial) data.target_count = 1;
  if (data.active !== undefined)
    data.active = [true, 1, "1", "true", "yes"].includes(data.active) ? 1 : 0;
  return { data, errors };
}

export function validateProgress(input) {
  const errors = [];
  const data = {};
  if (!isDate(input?.completion_date))
    errors.push("completion_date must be YYYY-MM-DD");
  else {
    data.completion_date = input.completion_date;
    if (data.completion_date > isoDate())
      errors.push("completion_date cannot be in the future");
  }
  const value = Number(input?.value);
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000)
    errors.push("value must be a whole number between 0 and 100000");
  else data.value = value;
  return { data, errors };
}

// The start (Mon/Sun/etc, per weekStart 0-6) of the week containing dateStr.
function weekStartFor(dateStr, weekStart) {
  const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  const diff = (day - weekStart + 7) % 7;
  return addDays(dateStr, -diff);
}
// Exported for unit testing (Monday vs Sunday start, year/month boundaries).
export function weekRange(dateStr, weekStart) {
  const start = weekStartFor(dateStr, weekStart);
  return [start, addDays(start, 6)];
}
function sumRange(logMap, start, end) {
  let sum = 0;
  for (let date = start; date <= end; date = addDays(date, 1))
    sum += logMap.get(date) || 0;
  return sum;
}

// Pure and exported for unit testing. `logs` is this one habit's log rows (any
// order) within the lookback window; "today" drives both daily/weekdays walking
// and which week is "current" for weekly habits.
export function computeStreak({ frequency, targetCount, logs, today, weekStart = 1 }) {
  const map = new Map(logs.map((log) => [log.completion_date, log.value]));
  let periods = [];
  if (frequency === "weekly") {
    const weeks = Math.ceil(STREAK_LOOKBACK_DAYS / 7);
    const [currentStart] = weekRange(today, weekStart);
    for (let i = 0; i < weeks; i++) {
      const start = addDays(currentStart, -7 * i);
      const end = addDays(start, 6);
      periods.push({ achieved: sumRange(map, start, end) >= targetCount });
    }
  } else {
    for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
      const date = addDays(today, -i);
      if (frequency === "weekdays" && !isWeekday(date)) continue;
      periods.push({ achieved: (map.get(date) || 0) >= targetCount });
    }
  }
  // The most recent period (today, or this week) doesn't count against the
  // streak until it's actually missed - it may simply not be over yet.
  if (periods.length && !periods[0].achieved) periods = periods.slice(1);
  let streak = 0;
  for (const period of periods) {
    if (period.achieved) streak++;
    else break;
  }
  return streak;
}

function summarizeHabit(habit, habitLogs, today, weekStart) {
  const map = new Map(habitLogs.map((log) => [log.completion_date, log.value]));
  let periodStart, periodEnd, periodValue;
  if (habit.frequency === "weekly") {
    [periodStart, periodEnd] = weekRange(today, weekStart);
    periodValue = sumRange(map, periodStart, periodEnd);
  } else {
    periodStart = periodEnd = today;
    periodValue = map.get(today) || 0;
  }
  return {
    ...habit,
    period_start: periodStart,
    period_end: periodEnd,
    period_value: periodValue,
    completed: periodValue >= habit.target_count,
    streak: computeStreak({
      frequency: habit.frequency,
      targetCount: habit.target_count,
      logs: habitLogs,
      today,
      weekStart,
    }),
  };
}

function fetchLogsForHabits(db, owner, habitIds, today) {
  const byHabit = new Map();
  if (!habitIds.length) return byHabit;
  const lookbackStart = addDays(today, -STREAK_LOOKBACK_DAYS);
  const placeholders = habitIds.map(() => "?").join(",");
  const logs = rows(
    db.prepare(
      `SELECT habit_id, completion_date, value FROM habit_logs WHERE user_id=? AND habit_id IN (${placeholders}) AND completion_date>=?`,
    ),
    [owner, ...habitIds, lookbackStart],
  );
  for (const log of logs) {
    if (!byHabit.has(log.habit_id)) byHabit.set(log.habit_id, []);
    byHabit.get(log.habit_id).push(log);
  }
  return byHabit;
}

function weekStartSetting(db, owner) {
  const settings = db.prepare("SELECT week_start FROM users WHERE id=?").get(owner);
  return settings ? Number(settings.week_start) : 1;
}

function listHabits(db, actor, query) {
  const owner =
    actor.role === "MANAGER" && query.user_id
      ? Number(query.user_id)
      : actor.id;
  const view = query.view || "all";
  const today = isoDate();
  const weekStart = weekStartSetting(db, owner);

  const where = ["user_id=?"];
  const params = [owner];
  if (view === "today" || query.active === "true") where.push("active=1");
  else if (query.active === "false") where.push("active=0");

  let habits = rows(
    db.prepare(
      `SELECT * FROM habits WHERE ${where.join(" AND ")} ORDER BY active DESC, name`,
    ),
    params,
  );
  if (view === "today")
    habits = habits.filter((habit) => isDueToday(habit.frequency, today));
  if (!habits.length) return [];

  const logsByHabit = fetchLogsForHabits(
    db,
    owner,
    habits.map((habit) => habit.id),
    today,
  );
  return habits.map((habit) =>
    summarizeHabit(habit, logsByHabit.get(habit.id) || [], today, weekStart),
  );
}

function ownedHabit(db, actor, id) {
  const record =
    actor.role === "MANAGER"
      ? db.prepare("SELECT * FROM habits WHERE id=?").get(id)
      : db.prepare("SELECT * FROM habits WHERE id=? AND user_id=?").get(id, actor.id);
  if (!record) fail("Not found", 404);
  return record;
}

export async function handleHabits(context, helpers) {
  const { db, request, response, url } = context;
  const { json, body, requireAuth, targetOwner } = helpers;
  const path = url.pathname;

  if (path === "/api/habits" && request.method === "GET") {
    const actor = requireAuth(context);
    return (
      json(
        response,
        200,
        listHabits(db, actor, Object.fromEntries(url.searchParams)),
      ),
      true
    );
  }

  if (path === "/api/habits" && request.method === "POST") {
    const actor = requireAuth(context, { csrf: true }),
      input = await body(request),
      owner = targetOwner(db, actor, input),
      { data, errors } = validateHabit(input);
    if (errors.length) return (json(response, 400, { errors }), true);
    const result = db
      .prepare(
        "INSERT INTO habits(user_id,name,description,frequency,target_count,active) VALUES (?,?,?,?,?,?)",
      )
      .run(
        owner,
        data.name,
        data.description || null,
        data.frequency,
        data.target_count,
        data.active ?? 1,
      );
    const habit = db
      .prepare("SELECT * FROM habits WHERE id=?")
      .get(Number(result.lastInsertRowid));
    return (json(response, 201, habit), true);
  }

  const historyMatch = path.match(/^\/api\/habits\/(\d+)\/history$/);
  if (historyMatch && request.method === "GET") {
    const actor = requireAuth(context),
      habit = ownedHabit(db, actor, Number(historyMatch[1]));
    const days = Math.min(
      STREAK_LOOKBACK_DAYS,
      Math.max(1, Number(url.searchParams.get("days")) || 30),
    );
    const start = addDays(isoDate(), -(days - 1));
    const logs = rows(
      db.prepare(
        "SELECT completion_date, value FROM habit_logs WHERE habit_id=? AND completion_date>=? ORDER BY completion_date DESC",
      ),
      [habit.id, start],
    );
    return (json(response, 200, logs), true);
  }

  const progressMatch = path.match(/^\/api\/habits\/(\d+)\/progress$/);
  if (progressMatch && request.method === "PUT") {
    const actor = requireAuth(context, { csrf: true }),
      habit = ownedHabit(db, actor, Number(progressMatch[1])),
      input = await body(request),
      { data, errors } = validateProgress(input);
    if (errors.length) return (json(response, 400, { errors }), true);
    db.prepare(
      "INSERT INTO habit_logs(habit_id,user_id,completion_date,value) VALUES (?,?,?,?) ON CONFLICT(habit_id,completion_date) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP",
    ).run(habit.id, habit.user_id, data.completion_date, data.value);
    const today = isoDate(),
      weekStart = weekStartSetting(db, habit.user_id),
      logsByHabit = fetchLogsForHabits(db, habit.user_id, [habit.id], today);
    return (
      json(
        response,
        200,
        summarizeHabit(habit, logsByHabit.get(habit.id) || [], today, weekStart),
      ),
      true
    );
  }

  const habitMatch = path.match(/^\/api\/habits\/(\d+)$/);
  if (habitMatch) {
    const actor = requireAuth(context, { csrf: request.method !== "GET" }),
      id = Number(habitMatch[1]),
      habit = ownedHabit(db, actor, id);

    if (request.method === "DELETE") {
      db.prepare("DELETE FROM habits WHERE id=?").run(id);
      return (json(response, 200, { message: "Deleted" }), true);
    }

    if (request.method === "PATCH") {
      const input = await body(request);
      if ("user_id" in input || "target_user_id" in input || "owner_id" in input)
        fail("Ownership cannot be changed");
      const { data, errors } = validateHabit(input, { partial: true });
      if (errors.length) return (json(response, 400, { errors }), true);
      const fields = Object.keys(data);
      if (fields.length)
        db.prepare(
          `UPDATE habits SET ${fields.map((f) => `${f}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        ).run(...fields.map((f) => data[f]), id);
      const updated = db.prepare("SELECT * FROM habits WHERE id=?").get(id);
      return (json(response, 200, updated), true);
    }
  }

  return false;
}
