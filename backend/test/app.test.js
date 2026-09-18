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
  // A prior version of this test also asserted the hash never contains "0007" as a
  // literal substring - a scrypt hash is expected to look like random noise, so
  // that had a small but real (Round 6-observed) chance of a coincidental
  // substring match, unrelated to any actual security property. The two
  // assertions above (it's really hashed, and never appears in the API response)
  // are what this test needs to prove; that third check tested nothing real and
  // was a source of non-deterministic failures. Root-caused and removed, not
  // silently ignored - see docs/FEATURE_UPGRADE_10_FINAL.md Phase 10H.
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

test("Round 6: import batch row detail is visible to its owner and hidden from other users", async () => {
  const user = await register("rowdetailuser"),
    other = await register("rowdetailother");
  const text = JSON.stringify([
    { company: "Northwind", job_title: "Tester", date_applied: "2026-08-03" },
    { company: "Missing date", job_title: "Tester" },
  ]);
  const result = await request("/api/import", {
    method: "POST",
    auth: user,
    input: {
      format: "json",
      text,
      import_mode: "valid_rows_only",
      duplicate_action: "skip",
    },
  });
  assert.equal(result.status, 201);
  const batchId = result.data.import_batch_id;

  const detail = await request(`/api/import/history/${batchId}/rows`, {
    auth: user,
  });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.length, 2);
  const validRow = detail.data.find((row) => row.status === "created");
  assert.ok(validRow);
  assert.deepEqual(validRow.messages, []);
  const invalidRow = detail.data.find((row) => row.status === "invalid");
  assert.ok(invalidRow);
  assert.ok(invalidRow.messages.some((message) => message.includes("Date applied")));

  assert.equal(
    (await request(`/api/import/history/${batchId}/rows`, { auth: other }))
      .status,
    404,
  );
  assert.equal(
    (await request("/api/import/history/999999/rows", { auth: user })).status,
    404,
  );
});

test("Round 6: CSV import (header aliases, quoted fields) round-trips through CSV export safely", async () => {
  const user = await register("csvuser");
  const csvText = [
    "Company Name,Title,Applied Date,Notes",
    '=1+1,Engineer,2026-09-01,"Talked to Jane, the recruiter"',
  ].join("\n");

  const preview = await request("/api/import/preview", {
    method: "POST",
    auth: user,
    input: { format: "csv", text: csvText },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.rows.length, 1);
  assert.equal(preview.data.rows[0].valid, true);
  // "Company Name"/"Title"/"Applied Date" are header aliases onto the real
  // field names - the same alias table the JSON/structured_text formats
  // already used, applied identically here (CSV isn't a second code path).
  assert.equal(preview.data.rows[0].data.company, "=1+1");
  assert.equal(preview.data.rows[0].data.job_title, "Engineer");
  assert.equal(preview.data.rows[0].data.date_applied, "2026-09-01");
  // The quoted comma inside "Talked to Jane, the recruiter" was parsed as
  // one field, not split into two.
  assert.equal(preview.data.rows[0].data.notes, "Talked to Jane, the recruiter");

  const imported = await request("/api/import", {
    method: "POST",
    auth: user,
    input: {
      format: "csv",
      text: csvText,
      import_mode: "valid_rows_only",
      duplicate_action: "skip",
    },
  });
  assert.equal(imported.data.created_rows, 1);

  // The formula-like company name ("=1+1") is stored as-is (import doesn't
  // need to know it's dangerous) - CSV export is where it must be
  // neutralized, since that's the point it becomes a real spreadsheet-
  // formula-injection risk if opened in Excel/Sheets. Every CSV export in
  // this app shares one csvEscape() helper, so this one row also stands in
  // for interviews/rejections/follow_ups/networking/reminders/goals.
  const csv = await request("/api/exports/applications", { auth: user });
  assert.equal(csv.status, 200);
  assert.match(csv.data, /"'=1\+1"/);
  assert.doesNotMatch(csv.data, /"=1\+1"/); // would match if safeCell weren't applied
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

test("Final round: editing interviews/rejections/follow_ups via PATCH was already backend-supported but never tested - verified, not assumed", async () => {
  const user = await register("trackeredit"),
    other = await register("trackereditother");
  const app = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: { company: "Acme", job_title: "Engineer", date_applied: "2026-09-01" },
  });

  const interview = await request("/api/interviews", {
    method: "POST",
    auth: user,
    input: {
      application_id: app.data.id,
      interview_round: "1",
      interview_type: "Technical",
      scheduled_at: "2026-09-10T10:00",
    },
  });
  assert.equal(interview.status, 201);
  const editedInterview = await request(`/api/interviews/${interview.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { result: "Passed", notes: "Went well" },
  });
  assert.equal(editedInterview.status, 200);
  assert.equal(editedInterview.data.result, "Passed");
  assert.equal(
    (
      await request(`/api/interviews/${interview.data.id}`, {
        method: "PATCH",
        auth: other,
        input: { result: "hijacked" },
      })
    ).status,
    404,
  );

  const rejection = await request("/api/rejections", {
    method: "POST",
    auth: user,
    input: {
      application_id: app.data.id,
      rejection_date: "2026-09-15",
      stage_at_rejection: "Interview",
      eligible_for_reapplication: 1,
    },
  });
  assert.equal(rejection.status, 201);
  assert.equal(rejection.data.eligible_for_reapplication, 1);
  // The checkbox-uncheck case is the one that matters: FormData omits an
  // unchecked box entirely, so the frontend must send an explicit 0/false,
  // not rely on omission, for an edit to actually be able to turn this off.
  const uncheck = await request(`/api/rejections/${rejection.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { eligible_for_reapplication: 0 },
  });
  assert.equal(uncheck.status, 200);
  assert.equal(uncheck.data.eligible_for_reapplication, 0);
  const recheck = await request(`/api/rejections/${rejection.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { eligible_for_reapplication: 1 },
  });
  assert.equal(recheck.data.eligible_for_reapplication, 1);

  const followUp = await request("/api/follow_ups", {
    method: "POST",
    auth: user,
    input: {
      application_id: app.data.id,
      follow_up_type: "Email",
      due_date: "2026-09-20",
    },
  });
  assert.equal(followUp.status, 201);
  const editedFollowUp = await request(`/api/follow_ups/${followUp.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { status: "Sent" },
  });
  assert.equal(editedFollowUp.status, 200);
  assert.equal(editedFollowUp.data.status, "Sent");
  assert.equal(
    (
      await request(`/api/follow_ups/${followUp.data.id}`, {
        method: "PATCH",
        auth: other,
        input: { status: "hijacked" },
      })
    ).status,
    404,
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

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

test("Round 7: task views (backlog/today/upcoming/completed) are deterministic and date-safe", async () => {
  const user = await register("tasksviews");
  const backlog = await request("/api/tasks", {
    method: "POST",
    auth: user,
    input: { title: "Undated task" },
  });
  assert.equal(backlog.status, 201);
  assert.equal(backlog.data.status, "open");
  assert.equal(backlog.data.priority, "Medium");
  assert.equal(backlog.data.due_date, null);

  const overdue = await request("/api/tasks", {
    method: "POST",
    auth: user,
    input: { title: "Overdue task", due_date: isoDate(-3) },
  });
  const dueToday = await request("/api/tasks", {
    method: "POST",
    auth: user,
    input: { title: "Due today task", due_date: isoDate(0) },
  });
  const future = await request("/api/tasks", {
    method: "POST",
    auth: user,
    input: { title: "Future task", due_date: isoDate(10) },
  });
  assert.equal(overdue.status, 201);
  assert.equal(dueToday.status, 201);
  assert.equal(future.status, 201);

  const backlogView = (await request("/api/tasks?view=backlog", { auth: user }))
    .data;
  assert.deepEqual(
    backlogView.map((item) => item.id),
    [backlog.data.id],
  );

  // "Today" includes overdue and due-today, ordered by due_date ascending -
  // so overdue (older date) sorts first.
  const todayView = (await request("/api/tasks?view=today", { auth: user }))
    .data;
  assert.deepEqual(
    todayView.map((item) => item.id),
    [overdue.data.id, dueToday.data.id],
  );

  const upcomingView = (
    await request("/api/tasks?view=upcoming", { auth: user })
  ).data;
  assert.deepEqual(
    upcomingView.map((item) => item.id),
    [future.data.id],
  );

  const completedView = (
    await request("/api/tasks?view=completed", { auth: user })
  ).data;
  assert.equal(completedView.length, 0);
});

test("Round 7: complete/reopen persists completed_at, and application linking is ownership-checked", async () => {
  const user = await register("tasksowner"),
    other = await register("tasksother");
  const app = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "Acme",
      job_title: "QA Engineer",
      date_applied: "2026-09-01",
    },
  });
  assert.equal(app.status, 201);
  const otherApp = await request("/api/applications", {
    method: "POST",
    auth: other,
    input: { company: "Other Co", job_title: "Role", date_applied: "2026-09-01" },
  });

  // Cannot link a task to another user's application.
  assert.equal(
    (
      await request("/api/tasks", {
        method: "POST",
        auth: user,
        input: { title: "Bad link", application_id: otherApp.data.id },
      })
    ).status,
    400,
  );

  const linked = await request("/api/tasks", {
    method: "POST",
    auth: user,
    input: {
      title: "Follow up with Acme",
      application_id: app.data.id,
      priority: "High",
      due_date: isoDate(1),
    },
  });
  assert.equal(linked.status, 201);

  // Surfaces on the application detail endpoint's linked-tasks section.
  const detail = await request(`/api/applications/${app.data.id}/detail`, {
    auth: user,
  });
  assert.equal(detail.data.tasks.length, 1);
  assert.equal(detail.data.tasks[0].id, linked.data.id);

  const completed = await request(`/api/tasks/${linked.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { status: "completed" },
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.data.status, "completed");
  assert.ok(completed.data.completed_at);

  // No longer counts as an open linked task on the application.
  const detailAfter = await request(`/api/applications/${app.data.id}/detail`, {
    auth: user,
  });
  assert.equal(detailAfter.data.tasks.length, 0);

  const reopened = await request(`/api/tasks/${linked.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { status: "open" },
  });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.data.status, "open");
  assert.equal(reopened.data.completed_at, null);

  // Ownership cannot be changed via update.
  assert.equal(
    (
      await request(`/api/tasks/${linked.data.id}`, {
        method: "PATCH",
        auth: user,
        input: { user_id: other.user.id },
      })
    ).status,
    400,
  );

  // Deleting the linked application unlinks (SET NULL), does not delete the task.
  assert.equal(
    (await request(`/api/applications/${app.data.id}`, { method: "DELETE", auth: user }))
      .status,
    200,
  );
  const survivor = (await request("/api/tasks?view=upcoming", { auth: user }))
    .data.find((item) => item.id === linked.data.id);
  assert.ok(survivor, "task must survive its application being deleted");
  assert.equal(survivor.application_id, null);

  // IDOR: another user cannot list, update, or delete this user's tasks.
  assert.equal(
    (await request("/api/tasks?view=upcoming", { auth: other })).data.some(
      (item) => item.id === linked.data.id,
    ),
    false,
  );
  assert.equal(
    (
      await request(`/api/tasks/${linked.data.id}`, {
        method: "PATCH",
        auth: other,
        input: { title: "hijacked" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/tasks/${linked.data.id}`, {
        method: "DELETE",
        auth: other,
      })
    ).status,
    404,
  );

  assert.equal(
    (await request(`/api/tasks/${linked.data.id}`, { method: "DELETE", auth: user }))
      .status,
    200,
  );
  assert.equal(
    (await request("/api/tasks?view=upcoming", { auth: user })).data.some(
      (item) => item.id === linked.data.id,
    ),
    false,
  );
});

test("Round 7: recurrence generates exactly one idempotent next occurrence, and rejects invalid input", async () => {
  const user = await register("tasksrecur");

  // Recurrence without a due date is rejected - there is no "next" to compute.
  assert.equal(
    (
      await request("/api/tasks", {
        method: "POST",
        auth: user,
        input: { title: "No due date", recurrence: "daily" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/tasks", {
        method: "POST",
        auth: user,
        input: { title: "Bad enum", priority: "Urgent" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/tasks", {
        method: "POST",
        auth: user,
        input: { title: "Bad recurrence", due_date: isoDate(1), recurrence: "yearly" },
      })
    ).status,
    400,
  );
  // Mass-assignment: status/user_id are not writable via create.
  assert.equal(
    (
      await request("/api/tasks", {
        method: "POST",
        auth: user,
        input: { title: "Sneaky", status: "completed" },
      })
    ).status,
    400,
  );

  const created = await request("/api/tasks", {
    method: "POST",
    auth: user,
    input: { title: "Weekly standup notes", due_date: "2026-09-14", recurrence: "weekly" },
  });
  assert.equal(created.status, 201);

  const firstComplete = await request(`/api/tasks/${created.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { status: "completed" },
  });
  assert.equal(firstComplete.status, 200);
  assert.ok(firstComplete.data.created_next_task_id, "must create the next occurrence");

  const nextTask = (await request("/api/tasks?view=upcoming", { auth: user }))
    .data.find((item) => item.id === firstComplete.data.created_next_task_id);
  assert.ok(nextTask, "next occurrence must be visible");
  assert.equal(nextTask.due_date, "2026-09-21");
  assert.equal(nextTask.recurrence, "weekly");
  assert.equal(nextTask.title, "Weekly standup notes");
  assert.equal(nextTask.status, "open");

  // Idempotency: completing the same (already-completed) task again must not
  // create a second next occurrence.
  const secondComplete = await request(`/api/tasks/${created.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { status: "completed" },
  });
  assert.equal(secondComplete.status, 200);
  assert.equal(secondComplete.data.created_next_task_id, null);
  const allTasks = (await request("/api/tasks?view=all", { auth: user })).data;
  assert.equal(
    allTasks.filter((item) => item.title === "Weekly standup notes").length,
    1,
    "only the surviving open next-occurrence should remain open",
  );
});

test("Round 8: habit CRUD, validation, archive/reactivate, ownership/IDOR, and cascade delete", async () => {
  const user = await register("habitsowner"),
    other = await register("habitsother");

  // Invalid frequency/target_count rejected.
  assert.equal(
    (
      await request("/api/habits", {
        method: "POST",
        auth: user,
        input: { name: "Bad frequency", frequency: "monthly" },
      })
    ).status,
    400,
  );
  for (const target_count of [0, -1, 1.5, 5000]) {
    assert.equal(
      (
        await request("/api/habits", {
          method: "POST",
          auth: user,
          input: { name: "Bad target", frequency: "daily", target_count },
        })
      ).status,
      400,
      `target_count ${target_count} must be rejected`,
    );
  }
  // Mass assignment: user_id/status-adjacent fields are not writable via create.
  assert.equal(
    (
      await request("/api/habits", {
        method: "POST",
        auth: user,
        input: { name: "Sneaky", frequency: "daily", user_id: other.user.id },
      })
    ).status,
    400,
  );

  const habit = await request("/api/habits", {
    method: "POST",
    auth: user,
    input: { name: "Practice coding", frequency: "daily", target_count: 1 },
  });
  assert.equal(habit.status, 201);
  assert.equal(habit.data.target_count, 1);
  assert.equal(habit.data.active, 1);

  // Edit: name, target_count.
  const edited = await request(`/api/habits/${habit.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { name: "Practice coding daily", target_count: 2 },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.name, "Practice coding daily");
  assert.equal(edited.data.target_count, 2);

  // Ownership cannot be changed via update.
  assert.equal(
    (
      await request(`/api/habits/${habit.data.id}`, {
        method: "PATCH",
        auth: user,
        input: { user_id: other.user.id },
      })
    ).status,
    400,
  );

  // Archive: leaves the active list, remains listable via active=all.
  const archived = await request(`/api/habits/${habit.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { active: false },
  });
  assert.equal(archived.status, 200);
  assert.equal(archived.data.active, 0);
  assert.equal(
    (await request("/api/habits?active=true", { auth: user })).data.some(
      (item) => item.id === habit.data.id,
    ),
    false,
  );
  assert.equal(
    (await request("/api/habits?active=all", { auth: user })).data.some(
      (item) => item.id === habit.data.id,
    ),
    true,
  );

  // Reactivate.
  const reactivated = await request(`/api/habits/${habit.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { active: true },
  });
  assert.equal(reactivated.data.active, 1);

  // IDOR: another user cannot list, update, or delete this user's habit.
  assert.equal(
    (await request("/api/habits?active=all", { auth: other })).data.some(
      (item) => item.id === habit.data.id,
    ),
    false,
  );
  assert.equal(
    (
      await request(`/api/habits/${habit.data.id}`, {
        method: "PATCH",
        auth: other,
        input: { name: "hijacked" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/habits/${habit.data.id}`, {
        method: "DELETE",
        auth: other,
      })
    ).status,
    404,
  );

  // Cascade delete: log a completion, then delete the habit; the log must go
  // with it (verified in real PostgreSQL too - see the dedicated FK test file).
  await request(`/api/habits/${habit.data.id}/progress`, {
    method: "PUT",
    auth: user,
    input: { completion_date: isoDate(0), value: 1 },
  });
  assert.equal(
    (await request(`/api/habits/${habit.data.id}/history`, { auth: user }))
      .data.length,
    1,
  );
  assert.equal(
    (
      await request(`/api/habits/${habit.data.id}`, {
        method: "DELETE",
        auth: user,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`/api/habits/${habit.data.id}/history`, { auth: user }))
      .status,
    404,
  );
});

test("Round 8: progress is idempotent/retry-safe, target-count aware, and rejects malformed input", async () => {
  const user = await register("habitsprogress");

  const boolHabit = await request("/api/habits", {
    method: "POST",
    auth: user,
    input: { name: "Read", frequency: "daily", target_count: 1 },
  });
  const countHabit = await request("/api/habits", {
    method: "POST",
    auth: user,
    input: { name: "Apply to jobs", frequency: "daily", target_count: 5 },
  });

  // Boolean habit: checking it twice (retry) must not create a duplicate row
  // or double-count - the same PUT is idempotent by construction (absolute
  // value + upsert on the habit_id+completion_date unique constraint).
  for (let i = 0; i < 2; i++) {
    const result = await request(`/api/habits/${boolHabit.data.id}/progress`, {
      method: "PUT",
      auth: user,
      input: { completion_date: isoDate(0), value: 1 },
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.period_value, 1);
    assert.equal(result.data.completed, true);
  }
  assert.equal(
    (
      await request(`/api/habits/${boolHabit.data.id}/history`, { auth: user })
    ).data.length,
    1,
    "retrying the same progress write must not create a second row",
  );

  // Count habit: below target, at target, and over target (over-achievement
  // still counts as completed, per docs/FEATURE_UPGRADE_8.md).
  const below = await request(`/api/habits/${countHabit.data.id}/progress`, {
    method: "PUT",
    auth: user,
    input: { completion_date: isoDate(0), value: 3 },
  });
  assert.equal(below.data.completed, false);
  assert.equal(below.data.period_value, 3);
  const atTarget = await request(`/api/habits/${countHabit.data.id}/progress`, {
    method: "PUT",
    auth: user,
    input: { completion_date: isoDate(0), value: 5 },
  });
  assert.equal(atTarget.data.completed, true);
  const over = await request(`/api/habits/${countHabit.data.id}/progress`, {
    method: "PUT",
    auth: user,
    input: { completion_date: isoDate(0), value: 6 },
  });
  assert.equal(over.data.completed, true);
  assert.equal(over.data.period_value, 6);

  // Malformed input rejected: negative value, non-integer, future date.
  for (const value of [-1, 1.5, 200_000]) {
    assert.equal(
      (
        await request(`/api/habits/${countHabit.data.id}/progress`, {
          method: "PUT",
          auth: user,
          input: { completion_date: isoDate(0), value },
        })
      ).status,
      400,
      `value ${value} must be rejected`,
    );
  }
  assert.equal(
    (
      await request(`/api/habits/${countHabit.data.id}/progress`, {
        method: "PUT",
        auth: user,
        input: { completion_date: isoDate(5), value: 1 },
      })
    ).status,
    400,
    "a future completion_date must be rejected",
  );
});

test("Round 8: weekly habits sum progress across the whole week, not one calendar day", async () => {
  const user = await register("habitsweekly");
  const habit = await request("/api/habits", {
    method: "POST",
    auth: user,
    input: { name: "Networking outreach", frequency: "weekly", target_count: 3 },
  });
  assert.equal(habit.status, 201);

  // Log three separate days within the current week (whatever "today" is at
  // test time) - never assume a specific weekday, since the test may run any
  // day. Logging today plus two prior days stays within the same week for
  // any day-of-week except very early in the week, which is exactly why the
  // period-sum (not single-day) semantics matter here.
  await request(`/api/habits/${habit.data.id}/progress`, {
    method: "PUT",
    auth: user,
    input: { completion_date: isoDate(0), value: 1 },
  });
  const midway = await request(`/api/habits/${habit.data.id}/progress`, {
    method: "PUT",
    auth: user,
    input: { completion_date: isoDate(0), value: 2 },
  });
  assert.equal(midway.data.period_value, 2);
  assert.equal(midway.data.completed, false);
  assert.ok(midway.data.period_start <= isoDate(0));
  assert.ok(midway.data.period_end >= isoDate(0));

  const summary = (await request("/api/habits?view=all", { auth: user })).data.find(
    (item) => item.id === habit.data.id,
  );
  assert.equal(summary.period_value, 2);
  assert.equal(summary.completed, false);
});

test("Round 9: note CRUD, validation, IDOR, mass-assignment protection, and application linking", async () => {
  const user = await register("notesowner"),
    other = await register("notesother");
  const app = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: { company: "Acme", job_title: "QA Engineer", date_applied: "2026-09-01" },
  });
  const otherApp = await request("/api/applications", {
    method: "POST",
    auth: other,
    input: { company: "Other Co", job_title: "Role", date_applied: "2026-09-01" },
  });

  // A completely blank note (no title, no body) is rejected.
  assert.equal(
    (await request("/api/notes", { method: "POST", auth: user, input: {} })).status,
    400,
  );
  // Invalid note_type rejected.
  assert.equal(
    (
      await request("/api/notes", {
        method: "POST",
        auth: user,
        input: { title: "X", note_type: "diary" },
      })
    ).status,
    400,
  );
  // Cannot link to another user's application.
  assert.equal(
    (
      await request("/api/notes", {
        method: "POST",
        auth: user,
        input: { title: "Bad link", application_id: otherApp.data.id },
      })
    ).status,
    400,
  );
  // Mass assignment: user_id is not writable via create.
  assert.equal(
    (
      await request("/api/notes", {
        method: "POST",
        auth: user,
        input: { title: "Sneaky", user_id: other.user.id },
      })
    ).status,
    400,
  );
  // A note with only a body (no title) is valid.
  const bodyOnly = await request("/api/notes", {
    method: "POST",
    auth: user,
    input: { body: "Just some thoughts, no title." },
  });
  assert.equal(bodyOnly.status, 201);
  assert.equal(bodyOnly.data.title, null);

  const note = await request("/api/notes", {
    method: "POST",
    auth: user,
    input: {
      title: "Acme interview reflection",
      body: "Went well overall.",
      note_type: "interview",
      application_id: app.data.id,
      pinned: true,
    },
  });
  assert.equal(note.status, 201);
  assert.equal(note.data.note_type, "interview");
  assert.equal(note.data.pinned, 1);
  assert.equal(note.data.application_company, "Acme");

  // Surfaces on the application detail endpoint.
  const detail = await request(`/api/applications/${app.data.id}/detail`, {
    auth: user,
  });
  assert.equal(detail.data.notes.length, 1);
  assert.equal(detail.data.notes[0].id, note.data.id);

  // Edit.
  const edited = await request(`/api/notes/${note.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { body: "Went well overall. Sent a thank-you note." },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.title, "Acme interview reflection"); // unchanged
  assert.match(edited.data.body, /thank-you/);

  // Clearing both title and body via update is rejected (merged-record check).
  assert.equal(
    (
      await request(`/api/notes/${note.data.id}`, {
        method: "PATCH",
        auth: user,
        input: { title: "", body: "" },
      })
    ).status,
    400,
  );

  // Ownership cannot be changed via update.
  assert.equal(
    (
      await request(`/api/notes/${note.data.id}`, {
        method: "PATCH",
        auth: user,
        input: { user_id: other.user.id },
      })
    ).status,
    400,
  );

  // IDOR: another user cannot fetch, list, update, or delete this user's note.
  assert.equal((await request(`/api/notes/${note.data.id}`, { auth: other })).status, 404);
  assert.equal(
    (await request("/api/notes", { auth: other })).data.some(
      (item) => item.id === note.data.id,
    ),
    false,
  );
  assert.equal(
    (
      await request(`/api/notes/${note.data.id}`, {
        method: "PATCH",
        auth: other,
        input: { title: "hijacked" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/notes/${note.data.id}`, { method: "DELETE", auth: other })
    ).status,
    404,
  );

  // Deleting the linked application unlinks (SET NULL), does not delete the note.
  assert.equal(
    (await request(`/api/applications/${app.data.id}`, { method: "DELETE", auth: user }))
      .status,
    200,
  );
  const survivor = (await request(`/api/notes/${note.data.id}`, { auth: user })).data;
  assert.equal(survivor.application_id, null);

  // Delete.
  assert.equal(
    (await request(`/api/notes/${note.data.id}`, { method: "DELETE", auth: user }))
      .status,
    200,
  );
  assert.equal((await request(`/api/notes/${note.data.id}`, { auth: user })).status, 404);
});

test("Round 9: search, type/pinned/application filters, previews, and stored XSS-shaped content is inert", async () => {
  const user = await register("notessearch");
  const app = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: { company: "Globex", job_title: "Engineer", date_applied: "2026-09-01" },
  });

  const longBody = "Sunny weather. ".repeat(20) + "The interview covered system design.";
  const journal = await request("/api/notes", {
    method: "POST",
    auth: user,
    input: { note_type: "daily_journal", entry_date: "2026-09-14", body: longBody },
  });
  assert.equal(journal.status, 201);
  // List responses return a bounded preview, not the full body.
  const listed = (await request("/api/notes", { auth: user })).data.find(
    (item) => item.id === journal.data.id,
  );
  assert.equal(listed.body, undefined);
  assert.ok(listed.body_preview.length <= 161); // 160 chars + ellipsis
  assert.ok(listed.body_preview.endsWith("…"));
  // The full body is still available via the single-note endpoint.
  assert.equal(
    (await request(`/api/notes/${journal.data.id}`, { auth: user })).data.body,
    longBody,
  );

  const research = await request("/api/notes", {
    method: "POST",
    auth: user,
    input: {
      title: "Globex company research",
      body: "Series B, remote-friendly.",
      note_type: "company_research",
      application_id: app.data.id,
      pinned: true,
    },
  });
  assert.equal(research.status, 201);

  const xssTitle = "<script>alert(1)</script>";
  const xssBody = "<img src=x onerror=alert(1)> and \"quotes\" and 'ticks'";
  const malicious = await request("/api/notes", {
    method: "POST",
    auth: user,
    input: { title: xssTitle, body: xssBody },
  });
  assert.equal(malicious.status, 201);
  // Stored and returned exactly as text - the API never interprets it.
  assert.equal(malicious.data.title, xssTitle);
  assert.equal(malicious.data.body, xssBody);

  // Search matches title OR body, case-insensitively.
  const byTitle = (await request("/api/notes?search=globex", { auth: user })).data;
  assert.ok(byTitle.some((item) => item.id === research.data.id));
  const byBody = (await request("/api/notes?search=system+design", { auth: user }))
    .data;
  assert.ok(byBody.some((item) => item.id === journal.data.id));

  // Type filter.
  const journalOnly = (
    await request("/api/notes?type=daily_journal", { auth: user })
  ).data;
  assert.ok(journalOnly.every((item) => item.note_type === "daily_journal"));
  assert.ok(journalOnly.some((item) => item.id === journal.data.id));

  // Pinned filter.
  const pinnedOnly = (await request("/api/notes?pinned=true", { auth: user })).data;
  assert.ok(pinnedOnly.every((item) => item.pinned === 1));
  assert.ok(pinnedOnly.some((item) => item.id === research.data.id));

  // Application filter.
  const forApp = (
    await request(`/api/notes?application_id=${app.data.id}`, { auth: user })
  ).data;
  assert.deepEqual(
    forApp.map((item) => item.id),
    [research.data.id],
  );

  // Unpin.
  const unpinned = await request(`/api/notes/${research.data.id}`, {
    method: "PATCH",
    auth: user,
    input: { pinned: false },
  });
  assert.equal(unpinned.data.pinned, 0);
});

test("Final round: resume performance analytics is owner-scoped and computes correct rates", async () => {
  const user = await register("analyticsuser"),
    other = await register("analyticsother");
  const resume = await request("/api/resumes", {
    method: "POST",
    auth: user,
    input: { version_name: "Backend v1" },
  });
  assert.equal(resume.status, 201);

  const responded = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "Acme",
      job_title: "Engineer",
      date_applied: "2026-09-01",
      resume_id: resume.data.id,
      last_response_date: "2026-09-05",
      stage: "Interview",
    },
  });
  assert.equal(responded.status, 201);
  const noResponse = await request("/api/applications", {
    method: "POST",
    auth: user,
    input: {
      company: "Globex",
      job_title: "Engineer",
      date_applied: "2026-09-02",
      resume_id: resume.data.id,
    },
  });
  assert.equal(noResponse.status, 201);

  const analytics = await request(
    "/api/analytics/resume?date_from=2026-01-01&date_to=2026-12-31",
    { auth: user },
  );
  assert.equal(analytics.status, 200);
  const row = analytics.data.find((item) => item.version_name === "Backend v1");
  assert.equal(row.applications, 2);
  assert.equal(row.responses, 1);
  assert.equal(row.response_rate, 50);
  assert.equal(row.interviews, 1);
  assert.equal(row.interview_rate, 50);
  assert.equal(row.offers, 0);
  assert.equal(row.offer_rate, 0);

  // IDOR: another user's request never sees this user's resume rows.
  const otherAnalytics = await request(
    "/api/analytics/resume?date_from=2026-01-01&date_to=2026-12-31",
    { auth: other },
  );
  assert.equal(
    otherAnalytics.data.some((item) => item.version_name === "Backend v1"),
    false,
  );
});
