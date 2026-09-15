import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { openDatabase } from "../src/db.js";
import { createRequestHandler } from "../src/server.js";
import { hashPassword } from "../src/security.js";

const db = openDatabase(process.env.TEST_DATABASE_URL || ":memory:");
const server = createServer(createRequestHandler({ db }));
let base;

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

async function request(path, { method = "GET", input, auth } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(input ? { "Content-Type": "application/json" } : {}),
      ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}),
    },
    body: input ? JSON.stringify(input) : undefined,
  });
  const data = (response.headers.get("content-type") || "").includes(
    "application/json",
  )
    ? await response.json()
    : await response.text();
  return {
    status: response.status,
    data,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

async function register(username) {
  const result = await request("/api/auth/register", {
    method: "POST",
    input: {
      username,
      full_name: `${username} Person`,
      email: `${username}@example.test`,
      pin: "0123",
      confirm_pin: "0123",
    },
  });
  assert.equal(result.status, 201);
  return {
    cookie: result.cookie,
    csrf: result.data.csrf_token,
    user: result.data.user,
  };
}

test("registration creates regular users and public role input is ignored", async () => {
  const result = await request("/api/auth/register", {
    method: "POST",
    input: {
      username: "regular",
      full_name: "Regular User",
      pin: "0042",
      confirm_pin: "0042",
      role: "MANAGER",
    },
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.role, "USER");
});

test("PIN validation accepts leading zero and rejects non-four-digit values", async () => {
  for (const pin of ["123", "12345", "12a4", "12#4"]) {
    const result = await request("/api/auth/register", {
      method: "POST",
      input: {
        username: `bad${pin.replace(/\W/g, "x")}`,
        full_name: "Bad PIN",
        pin,
        confirm_pin: pin,
      },
    });
    assert.equal(result.status, 400);
  }
  const mismatch = await request("/api/auth/register", {
    method: "POST",
    input: {
      username: "mismatch",
      full_name: "Mismatch",
      pin: "0123",
      confirm_pin: "0124",
    },
  });
  assert.equal(mismatch.status, 400);
  const valid = await request("/api/auth/register", {
    method: "POST",
    input: {
      username: "leadingzero",
      full_name: "Leading Zero",
      pin: "0007",
      confirm_pin: "0007",
    },
  });
  assert.equal(valid.status, 201);
  const stored = db
    .prepare("SELECT password_hash,pin_hash FROM users WHERE username=?")
    .get("leadingzero");
  assert.ok(stored.pin_hash.startsWith("scrypt$"));
  assert.equal(stored.pin_hash.includes("0007"), false);
  assert.equal(JSON.stringify(valid.data).includes("pin_hash"), false);
});

test("existing password accounts can establish a PIN without changing identity", async () => {
  const inserted = db
    .prepare(
      "INSERT INTO users(username,full_name,password_hash,role) VALUES (?,?,?,'USER')",
    )
    .run("legacy", "Legacy User", hashPassword("existing-long-password"));
  const id = Number(inserted.lastInsertRowid);
  const transition = await request("/api/auth/transition-pin", {
    method: "POST",
    input: {
      username: "legacy",
      current_password: "existing-long-password",
      pin: "0019",
      confirm_pin: "0019",
    },
  });
  assert.equal(transition.status, 200);
  assert.equal(transition.data.user.id, id);
  const login = await request("/api/auth/login", {
    method: "POST",
    input: { username: "legacy", pin: "0019" },
  });
  assert.equal(login.status, 200);
});

test("login has generic errors and locks after repeated failures", async () => {
  await register("locked");
  for (let index = 0; index < 5; index++) {
    const result = await request("/api/auth/login", {
      method: "POST",
      input: { username: "locked", pin: "9999" },
    });
    assert.equal(result.status, 401);
    assert.equal(result.data.error, "Invalid username or PIN");
  }
  const correct = await request("/api/auth/login", {
    method: "POST",
    input: { username: "locked", pin: "0123" },
  });
  assert.equal(correct.status, 401);
});

test("application CRUD is owner scoped and owner spoofing is rejected", async () => {
  const alice = await register("alice"),
    bob = await register("bob");
  const created = await request("/api/applications", {
    method: "POST",
    auth: alice,
    input: {
      company: "Acme",
      job_title: "QA Engineer",
      date_applied: "2026-08-03",
      user_id: bob.user.id,
    },
  });
  assert.equal(created.status, 400);
  const valid = await request("/api/applications", {
    method: "POST",
    auth: alice,
    input: {
      company: "Acme",
      job_title: "QA Engineer",
      date_applied: "2026-08-03",
    },
  });
  assert.equal(valid.status, 201);
  const aliceList = await request("/api/applications", { auth: alice });
  const bobList = await request("/api/applications", { auth: bob });
  assert.equal(aliceList.data.total, 1);
  assert.equal(bobList.data.total, 0);
  assert.equal(
    (await request(`/api/applications/${valid.data.id}`, { auth: bob })).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/applications/${valid.data.id}`, {
        method: "PATCH",
        auth: bob,
        input: { notes: "stolen" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/applications/${valid.data.id}`, {
        method: "DELETE",
        auth: bob,
      })
    ).status,
    404,
  );
  const stage = await request(`/api/applications/${valid.data.id}/stage`, {
    method: "PATCH",
    auth: alice,
    input: { stage: "Interview" },
  });
  assert.equal(stage.status, 200);
  const activity = await request(
    `/api/applications/${valid.data.id}/activity`,
    { auth: alice },
  );
  assert.equal(
    activity.data.filter((item) => item.activity_type === "stage_changed")
      .length,
    1,
  );
});

test("bulk preview is non-persistent and imports support modes and duplicate actions", async () => {
  const user = await register("bulkuser");
  const text = JSON.stringify([
    { company: "Northwind", job_title: "Tester", date_applied: "2026-08-03" },
    { company: "Missing date", job_title: "Tester" },
  ]);
  const preview = await request("/api/import/preview", {
    method: "POST",
    auth: user,
    input: { format: "json", text },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.rows[1].valid, false);
  assert.equal(
    (await request("/api/applications", { auth: user })).data.total,
    0,
  );
  const rejected = await request("/api/import", {
    method: "POST",
    auth: user,
    input: {
      format: "json",
      text,
      import_mode: "all_or_nothing",
      duplicate_action: "skip",
    },
  });
  assert.equal(rejected.data.status, "REJECTED");
  assert.equal(
    (await request("/api/applications", { auth: user })).data.total,
    0,
  );
  const imported = await request("/api/import", {
    method: "POST",
    auth: user,
    input: {
      format: "json",
      text,
      import_mode: "valid_rows_only",
      duplicate_action: "skip",
    },
  });
  assert.equal(imported.data.created_rows, 1);
  const duplicate = await request("/api/import", {
    method: "POST",
    auth: user,
    input: {
      format: "json",
      text: JSON.stringify([
        {
          company: " northwind ",
          job_title: "TESTER",
          date_applied: "2026-08-03",
        },
      ]),
      import_mode: "valid_rows_only",
      duplicate_action: "skip",
    },
  });
  assert.equal(duplicate.data.skipped_rows, 1);
});

test("structured text splits at the first colon", async () => {
  const user = await register("textuser");
  const text =
    "company: Colon Co\njob_title: Engineer\ndate_applied: 2026-08-03\nnotes: Called at 10:30";
  const result = await request("/api/import", {
    method: "POST",
    auth: user,
    input: {
      format: "structured_text",
      text,
      import_mode: "valid_rows_only",
      duplicate_action: "skip",
    },
  });
  assert.equal(result.status, 201);
  assert.equal(
    (
      await request(
        `/api/applications/${result.data.created_application_ids[0]}`,
        { auth: user },
      )
    ).data.notes,
    "Called at 10:30",
  );
});

test("related tracker ownership and manager access are enforced", async () => {
  const owner = await register("owner"),
    outsider = await register("outsider"),
    manager = await register("manager");
  db.prepare("UPDATE users SET role='MANAGER' WHERE id=?").run(manager.user.id);
  const relogin = await request("/api/auth/login", {
    method: "POST",
    input: { username: "manager", pin: "0123" },
  });
  const managerAuth = { cookie: relogin.cookie, csrf: relogin.data.csrf_token };
  const appResult = await request("/api/applications", {
    method: "POST",
    auth: owner,
    input: { company: "Owned", job_title: "Role", date_applied: "2026-08-03" },
  });
  const managerApp = await request("/api/applications", {
    method: "POST",
    auth: managerAuth,
    input: {
      target_user_id: owner.user.id,
      company: "Manager Created",
      job_title: "Analyst",
      date_applied: "2026-08-03",
    },
  });
  assert.equal(managerApp.status, 201);
  assert.equal(
    (await request(`/api/applications/${managerApp.data.id}`, { auth: owner }))
      .status,
    200,
  );
  const denied = await request("/api/interviews", {
    method: "POST",
    auth: outsider,
    input: {
      application_id: appResult.data.id,
      interview_round: "1",
      interview_type: "Technical",
      scheduled_at: "2026-08-04T10:00",
    },
  });
  assert.equal(denied.status, 400);
  const managerCreated = await request("/api/interviews", {
    method: "POST",
    auth: managerAuth,
    input: {
      target_user_id: owner.user.id,
      application_id: appResult.data.id,
      interview_round: "1",
      interview_type: "Technical",
      scheduled_at: "2026-08-04T10:00",
    },
  });
  assert.equal(managerCreated.status, 201);
  assert.equal(
    (await request("/api/interviews", { auth: outsider })).data.length,
    0,
  );
  assert.equal(
    (await request("/api/interviews", { auth: managerAuth })).data.length,
    1,
  );
  assert.equal(
    (await request("/api/manager/users", { auth: outsider })).status,
    404,
  );
  assert.equal(
    (await request("/api/manager/users", { auth: managerAuth })).status,
    200,
  );
});

test("dashboard handles empty data without division errors", async () => {
  const user = await register("emptydash");
  const result = await request("/api/dashboard", { auth: user });
  assert.equal(result.data.performance.total, 0);
  assert.equal(result.data.performance.response_rate, 0);
});

test("theme and follow-up settings persist per user", async () => {
  const user = await register("settingsuser");
  const saved = await request("/api/settings", {
    method: "PATCH",
    auth: user,
    input: {
      theme: "dark",
      first_follow_up_delay: 3,
      second_follow_up_delay: 4,
      follow_up_day_type: "business",
      default_reminder_time: "08:30",
    },
  });
  assert.equal(saved.status, 200);
  const settings = await request("/api/settings", { auth: user });
  assert.equal(settings.data.theme, "dark");
  assert.equal(settings.data.first_follow_up_delay, 3);
});

test("timeline, repeated stage history, filters, and exports are owner protected", async () => {
  const user = await register("timelineuser"),
    other = await register("timelineother");
  const created = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "Timeline Co",
      job_title: "Tester",
      date_applied: "2026-07-01",
    },
  });
  await request(`/api/applications/${created.data.id}/stage`, {
    method: "PATCH",
    auth: user,
    input: { stage: "Interview" },
  });
  await request(`/api/applications/${created.data.id}/stage`, {
    method: "PATCH",
    auth: user,
    input: { stage: "Applied" },
  });
  const manual = await request(
    `/api/applications/${created.data.id}/timeline`,
    {
      method: "POST",
      auth: user,
      input: {
        event_date: "2026-07-05",
        category: "recruiter",
        event_type: "recruiter_called",
        title: "Recruiter called",
        description: "Discussed role",
      },
    },
  );
  assert.equal(manual.status, 201);
  const detail = await request(`/api/applications/${created.data.id}/detail`, {
    auth: user,
  });
  assert.equal(
    detail.data.stage_history.filter((item) => item.new_stage === "Applied")
      .length,
    2,
  );
  assert.ok(
    detail.data.timeline.some((item) => item.title === "Recruiter called"),
  );
  const filtered = await request(
    `/api/applications/${created.data.id}/timeline?category=manual`,
    { auth: user },
  );
  assert.equal(filtered.data.length, 1);
  const csv = await request(
    `/api/applications/${created.data.id}/timeline/csv?category=manual`,
    { auth: user },
  );
  assert.equal(csv.status, 200);
  assert.match(csv.data, /Recruiter called/);
  const exported = await request(
    `/api/applications/${created.data.id}/timeline/json`,
    { auth: user },
  );
  assert.equal(exported.data.export_type, "application_timeline");
  assert.equal(
    (
      await request(`/api/applications/${created.data.id}/timeline/json`, {
        auth: other,
      })
    ).status,
    404,
  );
});

test("resume CRUD, linking, analytics, archive, and ownership are enforced", async () => {
  const user = await register("resumeuser"),
    other = await register("resumeother");
  const resume = await request("/api/resumes", {
    method: "POST",
    auth: user,
    input: {
      version_name: "QA v5",
      target_role: "QA Engineer",
      file_name: "qa-v5.pdf",
    },
  });
  const foreign = await request("/api/applications", {
    method: "POST",
    auth: other,
    input: {
      company: "No Link",
      job_title: "Tester",
      date_applied: "2026-07-02",
      resume_id: resume.data.id,
    },
  });
  assert.equal(foreign.status, 400);
  const appResult = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "Resume Co",
      job_title: "QA",
      date_applied: "2026-07-02",
      resume_id: resume.data.id,
    },
  });
  assert.equal(appResult.status, 201);
  const analytics = await request("/api/resumes/analytics", { auth: user });
  assert.equal(analytics.data[0].sample_size, 1);
  await request(`/api/resumes/${resume.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { is_archived: 1 },
  });
  assert.equal(
    (
      await request(`/api/resumes/${resume.data.id}`, {
        method: "PATCH",
        auth: other,
        input: { notes: "stolen" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/resumes/${resume.data.id}`, {
        method: "DELETE",
        auth: user,
        input: {},
      })
    ).status,
    400,
  );
});

test("custom reminder categories, reassignment, filtering, snooze, and ownership work", async () => {
  const user = await register("reminderuser"),
    other = await register("reminderother");
  const categories = await request("/api/reminder-categories", { auth: user });
  const builtin = categories.data.find(
    (item) => item.stable_key === "next-action",
  );
  const custom = await request("/api/reminder-categories", {
    method: "POST",
    auth: user,
    input: { name: "Portfolio", color: "#123456", icon: "file" },
  });
  const reminder = await request("/api/reminders", {
    method: "POST",
    auth: user,
    input: {
      category_id: custom.data.id,
      title: "Update portfolio",
      due_date: "2026-08-04",
      priority: "High",
    },
  });
  assert.equal(reminder.status, 201);
  assert.equal(
    (
      await request(`/api/reminders/${reminder.data.id}`, {
        method: "PATCH",
        auth: other,
        input: { status: "Completed" },
      })
    ).status,
    404,
  );
  await request(`/api/reminders/${reminder.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { status: "Snoozed", snoozed_until: "2099-01-01T09:00:00Z" },
  });
  assert.equal(
    (await request("/api/reminders", { auth: user })).data[0].calculated_status,
    "Snoozed",
  );
  const blocked = await request(`/api/reminder-categories/${custom.data.id}`, {
    method: "DELETE",
    auth: user,
    input: {},
  });
  assert.equal(blocked.status, 400);
  const removed = await request(`/api/reminder-categories/${custom.data.id}`, {
    method: "DELETE",
    auth: user,
    input: { reassign_to: builtin.id },
  });
  assert.equal(removed.status, 200);
});

test("calendar aggregates owned records and follow-up suggestions use configured delays", async () => {
  const user = await register("calendaruser"),
    other = await register("calendarother");
  const appResult = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "Calendar Co",
      job_title: "Analyst",
      date_applied: "2026-08-03",
      next_action: "Check status",
      next_action_date: "2026-08-10",
    },
  });
  await request("/api/interviews", {
    method: "POST",
    auth: user,
    input: {
      application_id: appResult.data.id,
      interview_round: "1",
      interview_type: "Technical",
      scheduled_at: "2026-08-12T10:00",
    },
  });
  const suggested = await request(
    `/api/follow-ups/suggest?application_id=${appResult.data.id}`,
    { auth: user },
  );
  assert.equal(suggested.data.suggested_first_follow_up, "2026-08-10");
  const calendar = await request(
    "/api/calendar?view=month&date_from=2026-08-01&date_to=2026-08-31",
    { auth: user },
  );
  assert.ok(calendar.data.events.some((item) => item.type === "application"));
  assert.ok(calendar.data.events.some((item) => item.type === "interview"));
  assert.equal(
    (
      await request("/api/calendar?date_from=2026-08-01&date_to=2026-08-31", {
        auth: other,
      })
    ).data.events.length,
    0,
  );
});

test("goal settings create immutable snapshots, history, comparisons, and owner scope", async () => {
  const user = await register("goaluser"),
    other = await register("goalother");
  await request("/api/goals/settings", {
    method: "POST",
    auth: user,
    input: {
      period_type: "daily",
      category: "applications",
      target: 1,
      effective_date: "2026-08-01",
    },
  });
  await request("/api/applications", {
    method: "POST",
    auth: user,
    input: { company: "Goal Co", job_title: "QA", date_applied: "2026-08-03" },
  });
  const history = await request(
    "/api/goals/history?period_type=daily&date_from=2026-08-03&date_to=2026-08-03",
    { auth: user },
  );
  assert.equal(history.data.items[0].actual, 1);
  assert.equal(history.data.items[0].achieved, 1);
  await request("/api/goals/settings", {
    method: "POST",
    auth: user,
    input: {
      period_type: "daily",
      category: "applications",
      target: 5,
      effective_date: "2026-08-04",
    },
  });
  const unchanged = await request(
    "/api/goals/history?period_type=daily&date_from=2026-08-03&date_to=2026-08-03",
    { auth: user },
  );
  assert.equal(unchanged.data.items[0].target, 1);
  const comparison = await request(
    "/api/goals/comparison?period_type=daily&date_from=2026-08-03&date_to=2026-08-04",
    { auth: user },
  );
  assert.equal(comparison.data.summary.periods, 2);
  assert.equal(
    (
      await request(
        "/api/goals/history?period_type=daily&date_from=2026-08-03&date_to=2026-08-04",
        { auth: other },
      )
    ).data.items.length,
    0,
  );
});

test("dashboard layouts persist order, sizes, reset, and remain isolated", async () => {
  const user = await register("layoutuser"),
    other = await register("layoutother");
  const initial = await request("/api/dashboard/layout", { auth: user });
  const widgets = initial.data.widgets.slice(0, 3).map((item, index) => ({
    ...item,
    position: 2 - index,
    width: index + 1,
    enabled: index !== 1,
  }));
  const saved = await request("/api/dashboard/layout", {
    method: "PUT",
    auth: user,
    input: { widgets },
  });
  assert.equal(saved.status, 200);
  const loaded = await request("/api/dashboard/layout", { auth: user });
  assert.equal(loaded.data.widgets[0].widget_id, widgets[0].widget_id);
  assert.equal(loaded.data.widgets[2].width, 3);
  assert.notEqual(
    (await request("/api/dashboard/layout", { auth: other })).data.widgets
      .length,
    3,
  );
  const reset = await request("/api/dashboard/layout", {
    method: "DELETE",
    auth: user,
    input: {},
  });
  assert.ok(reset.data.widgets.length > 20);
});

test("archive, restore, pinning, tags, saved views, aging, stage analytics, and exports work", async () => {
  const user = await register("reportuser"),
    other = await register("reportother");
  const created = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "Report Co",
      job_title: "Engineer",
      date_applied: "2026-06-01",
      tags: ["Remote", "Priority"],
      pinned: true,
    },
  });
  assert.equal(
    (await request("/api/applications?pinned=true", { auth: user })).data.total,
    1,
  );
  assert.equal((await request("/api/tags", { auth: user })).data.length, 2);
  await request("/api/saved-views", {
    method: "POST",
    auth: user,
    input: {
      name: "Pinned",
      filters: { pinned: true },
      sorting: { sort: "date_applied" },
    },
  });
  assert.equal(
    (await request("/api/saved-views", { auth: user })).data.length,
    1,
  );
  await request(`/api/applications/${created.data.id}/archive`, {
    method: "POST",
    auth: user,
    input: {},
  });
  assert.equal(
    (await request("/api/applications", { auth: user })).data.total,
    0,
  );
  assert.equal(
    (await request("/api/applications?archived=true", { auth: user })).data
      .total,
    1,
  );
  await request(`/api/applications/${created.data.id}/restore`, {
    method: "POST",
    auth: user,
    input: {},
  });
  const aging = await request("/api/analytics/aging", { auth: user });
  assert.equal(aging.data.items.length, 1);
  const stages = await request(
    "/api/analytics/stage-duration?date_from=2026-01-01&date_to=2026-12-31",
    { auth: user },
  );
  assert.equal(stages.status, 200);
  const csv = await request("/api/exports/applications", { auth: user });
  assert.match(csv.data, /Report Co/);
  const full = await request("/api/exports/json", { auth: user });
  assert.equal(full.data.export_version, 1);
  assert.equal(full.data.data.applications.length, 1);
  assert.equal("password_hash" in full.data.data.profile, false);
  assert.equal(
    (
      await request(`/api/applications/${created.data.id}/detail`, {
        auth: other,
      })
    ).status,
    404,
  );
});

test("complete end-to-end workflow reaches manager scoped views", async () => {
  const user = await register("e2euser"),
    manager = await register("e2emanager");
  db.prepare("UPDATE users SET role='MANAGER' WHERE id=?").run(manager.user.id);
  const login = await request("/api/auth/login", {
    method: "POST",
    input: { username: "e2emanager", pin: "0123" },
  });
  const managerAuth = { cookie: login.cookie, csrf: login.data.csrf_token };
  await request("/api/goals/settings", {
    method: "POST",
    auth: user,
    input: {
      period_type: "weekly",
      category: "applications",
      target: 5,
      effective_date: "2026-08-03",
    },
  });
  const resume = await request("/api/resumes", {
    method: "POST",
    auth: user,
    input: { version_name: "E2E Resume" },
  });
  const appResult = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "E2E Co",
      job_title: "QA",
      date_applied: "2026-08-03",
      resume_id: resume.data.id,
    },
  });
  await request(`/api/applications/${appResult.data.id}/timeline`, {
    method: "POST",
    auth: user,
    input: {
      event_date: "2026-08-04",
      title: "Recruiter email",
      category: "recruiter",
    },
  });
  await request("/api/follow_ups", {
    method: "POST",
    auth: user,
    input: {
      application_id: appResult.data.id,
      follow_up_type: "Email",
      due_date: "2026-08-10",
    },
  });
  const category = await request("/api/reminder-categories", {
    method: "POST",
    auth: user,
    input: { name: "E2E Category" },
  });
  await request("/api/reminders", {
    method: "POST",
    auth: user,
    input: {
      category_id: category.data.id,
      title: "E2E reminder",
      due_date: "2026-08-10",
    },
  });
  assert.ok(
    (
      await request("/api/calendar?date_from=2026-08-01&date_to=2026-08-31", {
        auth: user,
      })
    ).data.events.length >= 3,
  );
  assert.equal(
    (
      await request(`/api/applications/${appResult.data.id}/timeline/json`, {
        auth: user,
      })
    ).data.timeline.length >= 2,
    true,
  );
  assert.equal(
    (await request("/api/analytics/aging", { auth: user })).data.items.length,
    1,
  );
  assert.equal(
    (await request("/api/manager/dashboard", { auth: managerAuth })).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/manager/dashboard?user_id=${user.user.id}`, {
        auth: managerAuth,
      })
    ).status,
    200,
  );
});

test("feature upgrade application views, kanban movement, resume revisions, goal series, and Excel export are owner scoped", async () => {
  const user = await register("upgradeuser"),
    other = await register("upgradeother");
  const resume = await request("/api/resumes", {
    method: "POST",
    auth: user,
    input: {
      version_name: "QA v1",
      target_role: "QA Engineer",
      change_summary: "Initial version",
    },
  });
  assert.equal(resume.status, 201);
  const created = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "=Formula Corp",
      job_title: "QA Engineer",
      date_applied: "2026-08-03",
      stage: "Applied",
      resume_id: resume.data.id,
    },
  });
  assert.equal(created.status, 201);

  const preference = await request("/api/application-view-preferences", {
    method: "PUT",
    auth: user,
    input: {
      preferred_view: "kanban",
      collapsed_columns: ["Rejected"],
      kanban_grouping: "date_applied_week",
      collapsed_groups: { date_applied_week: ["Applied:2026-08-03"] },
      table_density: "comfortable",
      cards_per_group: 20,
      board_sort: "custom",
    },
  });
  assert.equal(preference.status, 200);
  assert.equal(preference.data.preferred_view, "kanban");
  assert.deepEqual(preference.data.collapsed_columns, ["Rejected"]);
  assert.equal(preference.data.kanban_grouping, "date_applied_week");
  assert.deepEqual(preference.data.collapsed_groups, {
    date_applied_week: ["Applied:2026-08-03"],
  });
  assert.equal(preference.data.table_density, "comfortable");
  assert.equal(preference.data.cards_per_group, 20);
  assert.equal(
    (await request("/api/application-view-preferences", { auth: other })).data
      .preferred_view,
    "table",
  );

  const filtered = await request(
    `/api/applications/query?column_filters=${encodeURIComponent(JSON.stringify([{ field: "company", operator: "contains", value: "Formula" }]))}`,
    { auth: user },
  );
  assert.equal(filtered.status, 200);
  assert.equal(filtered.data.total, 1);
  assert.equal(filtered.data.items[0].linked_resume_version, "QA v1");
  assert.equal(
    (await request("/api/applications/kanban", { auth: other })).data.total,
    0,
  );

  // Round 3 quick filters: status_group groups by the same open/closed stage
  // split used elsewhere (e.g. the closed-stage-move confirmation), reusing
  // buildApplicationWhere so table, Kanban, and quick filters all agree.
  assert.equal(
    (await request("/api/applications/query?status_group=active", { auth: user }))
      .data.total,
    1,
  );
  assert.equal(
    (await request("/api/applications/query?status_group=closed", { auth: user }))
      .data.total,
    0,
  );

  const moved = await request(`/api/applications/${created.data.id}/stage`, {
    method: "PATCH",
    auth: user,
    input: { stage: "Rejected", reason: "Role closed" },
  });
  assert.equal(moved.status, 200);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) count FROM stage_history WHERE application_id=?",
      )
      .get(created.data.id).count,
    2,
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) count FROM timeline_events WHERE application_id=? AND event_type='stage_changed'",
      )
      .get(created.data.id).count,
    1,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) count FROM rejections WHERE application_id=?")
      .get(created.data.id).count,
    1,
  );
  assert.equal(
    (
      await request(`/api/applications/${created.data.id}/stage`, {
        method: "PATCH",
        auth: other,
        input: { stage: "Offer" },
      })
    ).status,
    404,
  );

  const clone = await request(`/api/resumes/${resume.data.id}/clone`, {
    method: "POST",
    auth: user,
    input: {
      version_name: "QA v2",
      revision_label: "2",
      change_summary: "Improved outcomes",
    },
  });
  assert.equal(clone.status, 201);
  assert.equal(
    (
      await request(`/api/resumes/${resume.data.id}/clone`, {
        method: "POST",
        auth: other,
        input: { version_name: "Stolen" },
      })
    ).status,
    404,
  );
  const comparison = await request(
    `/api/resumes/compare?left=${resume.data.id}&right=${clone.data.id}`,
    { auth: user },
  );
  assert.equal(comparison.status, 200);
  assert.equal(comparison.data.comparison_type, "metadata_and_performance");

  const series = await request(
    "/api/goals/progress-series?metric=applications&date_from=2026-08-01&date_to=2026-08-07",
    { auth: user },
  );
  assert.equal(series.status, 200);
  assert.equal(series.data.metric, "applications");

  const excel = await fetch(
    `${base}/api/exports/applications.xlsx?archived=all`,
    { headers: { Cookie: user.cookie } },
  );
  assert.equal(excel.status, 200);
  assert.match(excel.headers.get("content-type"), /spreadsheetml/);
  const bytes = new Uint8Array(await excel.arrayBuffer());
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), "PK");
  assert.equal(
    (
      await fetch(`${base}/api/exports/applications.xlsx`, {
        headers: { Cookie: other.cookie },
      })
    ).status,
    404,
  );
});

test("Round 4: application checklist create, edit, complete, reorder, delete, and ownership", async () => {
  const user = await register("checklistuser"),
    other = await register("checklistother");
  const created = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "Checklist Co",
      job_title: "Engineer",
      date_applied: "2026-09-01",
      stage: "Applied",
    },
  });
  assert.equal(created.status, 201);
  const appId = created.data.id;

  const before = await request(`/api/applications/${appId}/detail`, {
    auth: user,
  });
  assert.equal(before.status, 200);
  assert.equal(before.data.checklist.length, 11); // seeded defaults
  assert.ok(before.data.checklist.every((item) => item.is_custom === 0));
  assert.ok(before.data.checklist.every((item) => item.completed === 0));
  const [first, second] = before.data.checklist;

  // Create a custom item, appended after the defaults.
  const addCustom = await request(`/api/applications/${appId}/checklist`, {
    method: "POST",
    auth: user,
    input: { label: "  Ask about relocation  " },
  });
  assert.equal(addCustom.status, 200);
  const afterAdd = await request(`/api/applications/${appId}/detail`, {
    auth: user,
  });
  assert.equal(afterAdd.data.checklist.length, 12);
  const custom = afterAdd.data.checklist.at(-1);
  assert.equal(custom.is_custom, 1);
  assert.equal(custom.label, "Ask about relocation"); // trimmed
  assert.equal(custom.position, 11);

  // Empty/whitespace-only labels are rejected, both on create and edit.
  assert.equal(
    (
      await request(`/api/applications/${appId}/checklist`, {
        method: "POST",
        auth: user,
        input: { label: "   " },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/applications/${appId}/checklist/${first.id}`, {
        method: "PATCH",
        auth: user,
        input: { label: "" },
      })
    ).status,
    400,
  );

  // Complete an item; completed_at is set; note is stored.
  const complete = await request(
    `/api/applications/${appId}/checklist/${first.id}`,
    { method: "PATCH", auth: user, input: { completed: true, note: "done early" } },
  );
  assert.equal(complete.status, 200);
  let detail = (await request(`/api/applications/${appId}/detail`, { auth: user })).data;
  let updatedFirst = detail.checklist.find((item) => item.id === first.id);
  assert.equal(updatedFirst.completed, 1);
  assert.ok(updatedFirst.completed_at);
  assert.equal(updatedFirst.note, "done early");

  // Editing the label alone does not disturb completed/note.
  await request(`/api/applications/${appId}/checklist/${first.id}`, {
    method: "PATCH",
    auth: user,
    input: { label: "Resume tailored (renamed)" },
  });
  detail = (await request(`/api/applications/${appId}/detail`, { auth: user })).data;
  updatedFirst = detail.checklist.find((item) => item.id === first.id);
  assert.equal(updatedFirst.label, "Resume tailored (renamed)");
  assert.equal(updatedFirst.completed, 1);
  assert.equal(updatedFirst.note, "done early");

  // Uncompleting clears completed_at.
  await request(`/api/applications/${appId}/checklist/${first.id}`, {
    method: "PATCH",
    auth: user,
    input: { completed: false },
  });
  detail = (await request(`/api/applications/${appId}/detail`, { auth: user })).data;
  updatedFirst = detail.checklist.find((item) => item.id === first.id);
  assert.equal(updatedFirst.completed, 0);
  assert.equal(updatedFirst.completed_at, null);

  // Reordering: moving the second item up swaps it with the first.
  const moved = await request(
    `/api/applications/${appId}/checklist/${second.id}/move`,
    { method: "PATCH", auth: user, input: { direction: "up" } },
  );
  assert.equal(moved.status, 200);
  detail = (await request(`/api/applications/${appId}/detail`, { auth: user })).data;
  assert.equal(detail.checklist[0].id, second.id);
  assert.equal(detail.checklist[1].id, first.id);
  // Moving the very first item up is a no-op (no sibling above it).
  const noSibling = await request(
    `/api/applications/${appId}/checklist/${second.id}/move`,
    { method: "PATCH", auth: user, input: { direction: "up" } },
  );
  assert.equal(noSibling.status, 200);
  detail = (await request(`/api/applications/${appId}/detail`, { auth: user })).data;
  assert.equal(detail.checklist[0].id, second.id);

  // Deleting an item (default or custom) works and is reflected immediately.
  const deleted = await request(
    `/api/applications/${appId}/checklist/${custom.id}`,
    { method: "DELETE", auth: user },
  );
  assert.equal(deleted.status, 200);
  detail = (await request(`/api/applications/${appId}/detail`, { auth: user })).data;
  assert.equal(detail.checklist.length, 11);
  assert.ok(!detail.checklist.some((item) => item.id === custom.id));

  // Ownership/IDOR: another user cannot read, edit, move, or delete this
  // application's checklist items, including by guessing a valid item id
  // under their own (different) application.
  const otherApp = await request("/api/applications", {
    method: "POST",
    auth: other,
    input: {
      company: "Other Co",
      job_title: "Engineer",
      date_applied: "2026-09-01",
      stage: "Applied",
    },
  });
  const otherDetail = await request(
    `/api/applications/${otherApp.data.id}/detail`,
    { auth: other },
  );
  const otherItemId = otherDetail.data.checklist[0].id;
  assert.equal(
    (
      await request(`/api/applications/${appId}/checklist/${first.id}`, {
        method: "PATCH",
        auth: other,
        input: { completed: true },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/applications/${appId}/checklist/${first.id}`, {
        method: "DELETE",
        auth: other,
      })
    ).status,
    404,
  );
  // Cross-wiring a real, owned-by-`other` item id under `user`'s application
  // id must not be honored (the application_id cross-check must catch it).
  assert.equal(
    (
      await request(`/api/applications/${appId}/checklist/${otherItemId}`, {
        method: "PATCH",
        auth: user,
        input: { completed: true },
      })
    ).status,
    404,
  );
});

test("Round 5: networking contact CRUD, application linkage, ownership/IDOR, and delete behavior", async () => {
  const user = await register("networkinguser"),
    other = await register("networkingother");
  const app1 = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "Acme",
      job_title: "Engineer",
      date_applied: "2026-09-01",
      stage: "Applied",
    },
  });
  assert.equal(app1.status, 201);

  // Create without a linked application - contacts don't require one.
  const unlinked = await request("/api/networking_contacts", {
    method: "POST",
    auth: user,
    input: { contact_name: "Jane Doe", relationship_type: "Referral" },
  });
  assert.equal(unlinked.status, 201);

  // Create linked to an application (the "Link Contact" flow this round
  // actually fixed - application_id was silently missing from the frontend
  // form's field list before this round; the backend already supported it).
  const linked = await request("/api/networking_contacts", {
    method: "POST",
    auth: user,
    input: {
      contact_name: "Sam Recruiter",
      application_id: app1.data.id,
      relationship_type: "Recruiter",
      email: "sam@acme.test",
      linkedin_url: "https://linkedin.com/in/sam",
    },
  });
  assert.equal(linked.status, 201);

  // Surfaces on the application detail endpoint (what the new
  // networkingContactsView() on the frontend renders).
  const detail = await request(`/api/applications/${app1.data.id}/detail`, {
    auth: user,
  });
  assert.equal(detail.data.networking.length, 1);
  assert.equal(detail.data.networking[0].contact_name, "Sam Recruiter");

  // Cannot link a contact to another user's application.
  const otherApp = await request("/api/applications", {
    method: "POST",
    auth: other,
    input: { company: "Other Co", job_title: "Role", date_applied: "2026-09-01" },
  });
  assert.equal(
    (
      await request("/api/networking_contacts", {
        method: "POST",
        auth: user,
        input: { contact_name: "Bad Link", application_id: otherApp.data.id },
      })
    ).status,
    400,
  );

  // Edit: no existing test previously covered PATCH on networking_contacts
  // at all, even though the backend already supported it before this round.
  assert.equal(
    (
      await request(`/api/networking_contacts/${linked.data.id}`, {
        method: "PATCH",
        auth: user,
        input: { networking_stage: "Connected", notes: "Great chat at the meetup" },
      })
    ).status,
    200,
  );
  const afterUpdate = (await request("/api/networking_contacts", { auth: user }))
    .data;
  const savedContact = afterUpdate.find((item) => item.id === linked.data.id);
  assert.equal(savedContact.networking_stage, "Connected");
  assert.equal(savedContact.notes, "Great chat at the meetup");

  // Ownership cannot be changed via update.
  assert.equal(
    (
      await request(`/api/networking_contacts/${linked.data.id}`, {
        method: "PATCH",
        auth: user,
        input: { user_id: other.user.id },
      })
    ).status,
    400,
  );

  // IDOR: another user cannot list, edit, or delete this user's contacts.
  assert.equal(
    (await request("/api/networking_contacts", { auth: other })).data.length,
    0,
  );
  assert.equal(
    (
      await request(`/api/networking_contacts/${linked.data.id}`, {
        method: "PATCH",
        auth: other,
        input: { notes: "hijacked" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/networking_contacts/${linked.data.id}`, {
        method: "DELETE",
        auth: other,
      })
    ).status,
    404,
  );

  // Delete behavior, verified rather than assumed (a FK cascade rule exists
  // in the schema that isn't obvious from the API surface alone): deleting a
  // contact cascades to delete any follow-ups tied to it.
  const followUp = await request("/api/follow_ups", {
    method: "POST",
    auth: user,
    input: {
      networking_contact_id: linked.data.id,
      follow_up_type: "Networking",
      due_date: "2026-09-20",
    },
  });
  assert.equal(followUp.status, 201);
  assert.equal(
    (await request(`/api/networking_contacts/${linked.data.id}`, {
      method: "DELETE",
      auth: user,
    })).status,
    200,
  );
  assert.equal(
    (await request("/api/follow_ups", { auth: user })).data.some(
      (item) => item.id === followUp.data.id,
    ),
    false,
  );

  // Deleting the linked application unlinks (does not delete) any remaining
  // contact - a second contact, created and linked to app1 above but not yet
  // exercised, proves this without relying on the already-deleted one.
  const secondLinked = await request("/api/networking_contacts", {
    method: "POST",
    auth: user,
    input: { contact_name: "Pat Interviewer", application_id: app1.data.id },
  });
  assert.equal(secondLinked.status, 201);
  assert.equal(
    (await request(`/api/applications/${app1.data.id}`, { method: "DELETE", auth: user }))
      .status,
    200,
  );
  const remaining = (await request("/api/networking_contacts", { auth: user }))
    .data;
  const survivor = remaining.find((item) => item.id === secondLinked.data.id);
  assert.ok(survivor, "contact must survive its application being deleted");
  assert.equal(survivor.application_id, null);
});
