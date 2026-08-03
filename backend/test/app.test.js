import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { openDatabase } from "../src/db.js";
import { createRequestHandler } from "../src/server.js";

const db = openDatabase(":memory:");
const server = createServer(createRequestHandler({ db }));
let base;

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); db.close(); });

async function request(path, { method = "GET", input, auth } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(input ? { "Content-Type": "application/json" } : {}), ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}) },
    body: input ? JSON.stringify(input) : undefined
  });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

async function register(username) {
  const result = await request("/api/auth/register", { method: "POST", input: { username, full_name: `${username} Person`, email: `${username}@example.test`, password: "correct-horse-battery" } });
  assert.equal(result.status, 201);
  return { cookie: result.cookie, csrf: result.data.csrf_token, user: result.data.user };
}

test("registration creates regular users and public role input is ignored", async () => {
  const result = await request("/api/auth/register", { method: "POST", input: { username: "regular", full_name: "Regular User", password: "correct-horse-battery", role: "MANAGER" } });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.role, "USER");
});

test("login has generic errors and locks after repeated failures", async () => {
  await register("locked");
  for (let index = 0; index < 5; index++) {
    const result = await request("/api/auth/login", { method: "POST", input: { username: "locked", password: "totally-wrong" } });
    assert.equal(result.status, 401);
    assert.equal(result.data.error, "Invalid username or password");
  }
  const correct = await request("/api/auth/login", { method: "POST", input: { username: "locked", password: "correct-horse-battery" } });
  assert.equal(correct.status, 401);
});

test("application CRUD is owner scoped and owner spoofing is rejected", async () => {
  const alice = await register("alice"), bob = await register("bob");
  const created = await request("/api/applications", { method: "POST", auth: alice, input: { company: "Acme", job_title: "QA Engineer", date_applied: "2026-08-03", user_id: bob.user.id } });
  assert.equal(created.status, 400);
  const valid = await request("/api/applications", { method: "POST", auth: alice, input: { company: "Acme", job_title: "QA Engineer", date_applied: "2026-08-03" } });
  assert.equal(valid.status, 201);
  const aliceList = await request("/api/applications", { auth: alice });
  const bobList = await request("/api/applications", { auth: bob });
  assert.equal(aliceList.data.total, 1);
  assert.equal(bobList.data.total, 0);
  assert.equal((await request(`/api/applications/${valid.data.id}`, { auth: bob })).status, 404);
  assert.equal((await request(`/api/applications/${valid.data.id}`, { method: "PATCH", auth: bob, input: { notes: "stolen" } })).status, 404);
  assert.equal((await request(`/api/applications/${valid.data.id}`, { method: "DELETE", auth: bob })).status, 404);
  const stage = await request(`/api/applications/${valid.data.id}/stage`, { method: "PATCH", auth: alice, input: { stage: "Interview" } });
  assert.equal(stage.status, 200);
  const activity = await request(`/api/applications/${valid.data.id}/activity`, { auth: alice });
  assert.equal(activity.data.filter((item) => item.activity_type === "stage_changed").length, 1);
});

test("bulk preview is non-persistent and imports support modes and duplicate actions", async () => {
  const user = await register("bulkuser");
  const text = JSON.stringify([{ company: "Northwind", job_title: "Tester", date_applied: "2026-08-03" }, { company: "Missing date", job_title: "Tester" }]);
  const preview = await request("/api/import/preview", { method: "POST", auth: user, input: { format: "json", text } });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.rows[1].valid, false);
  assert.equal((await request("/api/applications", { auth: user })).data.total, 0);
  const rejected = await request("/api/import", { method: "POST", auth: user, input: { format: "json", text, import_mode: "all_or_nothing", duplicate_action: "skip" } });
  assert.equal(rejected.data.status, "REJECTED");
  assert.equal((await request("/api/applications", { auth: user })).data.total, 0);
  const imported = await request("/api/import", { method: "POST", auth: user, input: { format: "json", text, import_mode: "valid_rows_only", duplicate_action: "skip" } });
  assert.equal(imported.data.created_rows, 1);
  const duplicate = await request("/api/import", { method: "POST", auth: user, input: { format: "json", text: JSON.stringify([{ company: " northwind ", job_title: "TESTER", date_applied: "2026-08-03" }]), import_mode: "valid_rows_only", duplicate_action: "skip" } });
  assert.equal(duplicate.data.skipped_rows, 1);
});

test("structured text splits at the first colon", async () => {
  const user = await register("textuser");
  const text = "company: Colon Co\njob_title: Engineer\ndate_applied: 2026-08-03\nnotes: Called at 10:30";
  const result = await request("/api/import", { method: "POST", auth: user, input: { format: "structured_text", text, import_mode: "valid_rows_only", duplicate_action: "skip" } });
  assert.equal(result.status, 201);
  assert.equal((await request(`/api/applications/${result.data.created_application_ids[0]}`, { auth: user })).data.notes, "Called at 10:30");
});

test("related tracker ownership and manager access are enforced", async () => {
  const owner = await register("owner"), outsider = await register("outsider"), manager = await register("manager");
  db.prepare("UPDATE users SET role='MANAGER' WHERE id=?").run(manager.user.id);
  const relogin = await request("/api/auth/login", { method: "POST", input: { username: "manager", password: "correct-horse-battery" } });
  const managerAuth = { cookie: relogin.cookie, csrf: relogin.data.csrf_token };
  const appResult = await request("/api/applications", { method: "POST", auth: owner, input: { company: "Owned", job_title: "Role", date_applied: "2026-08-03" } });
  const managerApp = await request("/api/applications", { method: "POST", auth: managerAuth, input: { target_user_id: owner.user.id, company: "Manager Created", job_title: "Analyst", date_applied: "2026-08-03" } });
  assert.equal(managerApp.status, 201);
  assert.equal((await request(`/api/applications/${managerApp.data.id}`, { auth: owner })).status, 200);
  const denied = await request("/api/interviews", { method: "POST", auth: outsider, input: { application_id: appResult.data.id, interview_round: "1", interview_type: "Technical", scheduled_at: "2026-08-04T10:00" } });
  assert.equal(denied.status, 400);
  const managerCreated = await request("/api/interviews", { method: "POST", auth: managerAuth, input: { target_user_id: owner.user.id, application_id: appResult.data.id, interview_round: "1", interview_type: "Technical", scheduled_at: "2026-08-04T10:00" } });
  assert.equal(managerCreated.status, 201);
  assert.equal((await request("/api/interviews", { auth: outsider })).data.length, 0);
  assert.equal((await request("/api/interviews", { auth: managerAuth })).data.length, 1);
  assert.equal((await request("/api/manager/users", { auth: outsider })).status, 404);
  assert.equal((await request("/api/manager/users", { auth: managerAuth })).status, 200);
});

test("dashboard handles empty data without division errors", async () => {
  const user = await register("emptydash");
  const result = await request("/api/dashboard", { auth: user });
  assert.equal(result.data.performance.total, 0);
  assert.equal(result.data.performance.response_rate, 0);
});
