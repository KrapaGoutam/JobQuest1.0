// JobQuest Round 11 — Browser Capture Extension E2E Specs

import { test, expect } from "@playwright/test";

async function authenticatedPage(page, testInfo) {
  const suffix = `${testInfo.project.name}-${Date.now()}`.replace(
    /[^a-z0-9]/gi,
    "",
  );
  const response = await page.request.post("/api/auth/register", {
    data: {
      full_name: "Extension Test User",
      username: `extuser${suffix}`.slice(0, 40),
      pin: "0123",
      confirm_pin: "0123",
    },
  });
  expect(response.ok()).toBeTruthy();
  const auth = await response.json();
  await page.goto("/");
  await expect(page.locator(".dashboard-hero h1")).toContainText(
    /Good (morning|afternoon|evening), Extension/,
  );
  return auth;
}

async function openMobileNav(page) {
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator("#sidebar")).toHaveClass(/\bopen\b/);
  await expect
    .poll(
      async () => (await page.locator("#sidebar").boundingBox())?.x ?? -9999,
      { timeout: 15_000 },
    )
    .toBeGreaterThan(-1);
}

test.describe("Round 11 — Extension Settings & Capture Workflow", () => {
  test("settings: generate extension token, display one-time token, and revoke", async ({
    page,
  }, testInfo) => {
    const narrow = ["tablet", "mobile", "small-mobile"].includes(
      testInfo.project.name,
    );
    await authenticatedPage(page, testInfo);

    // Navigate to Settings
    if (narrow) await openMobileNav(page);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.locator("#extension-tokens-section")).toBeVisible();

    // Verify token generation form
    const labelInput = page.locator('#ext-token-form input[name="label"]');
    await expect(labelInput).toBeVisible();
    await labelInput.fill("Playwright Laptop");

    // Submit token generation form
    await page.locator("#ext-token-form button").click();

    // Verify one-time raw token banner is displayed
    const rawTokenInput = page.locator("#new-ext-token-input");
    await expect(rawTokenInput).toBeVisible();
    const rawToken = await rawTokenInput.inputValue();
    expect(rawToken.length).toBeGreaterThan(20);

    // Verify copy button exists
    const copyBtn = page.locator("#copy-ext-token-btn");
    await expect(copyBtn).toBeVisible();

    // Verify active tokens list displays the token
    const tokenRow = page.locator(
      '#extension-tokens-section tr:has-text("Playwright Laptop")',
    );
    await expect(tokenRow).toBeVisible();
    await expect(tokenRow.locator("button[data-token-revoke]")).toBeVisible();

    // Revoke token
    page.once("dialog", (dialog) => dialog.accept());
    await tokenRow.locator("button[data-token-revoke]").click();

    // Verify token is removed from active list
    await expect(
      page.locator(
        '#extension-tokens-section tr:has-text("Playwright Laptop")',
      ),
    ).not.toBeVisible();
  });

  test("extension api: full capture lifecycle with duplicate detection and UI reflection", async ({
    page,
  }, testInfo) => {
    const auth = await authenticatedPage(page, testInfo);

    // 1. Generate an extension token via API using session auth
    const tokenRes = await page.request.post("/api/extension/tokens", {
      headers: { "X-CSRF-Token": auth.csrf_token },
      data: { label: "API E2E Token" },
    });
    expect(tokenRes.ok()).toBeTruthy();
    const { token: bearerToken } = await tokenRes.json();
    expect(bearerToken).toBeTruthy();

    // 2. Verify /api/extension/me with Bearer token
    const meRes = await page.request.get("/api/extension/me", {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    expect(meRes.ok()).toBeTruthy();
    const me = await meRes.json();
    expect(me.full_name).toBe("Extension Test User");

    // 3. Duplicate check before creation returns no duplicate
    const check1 = await page.request.get(
      `/api/extension/duplicate-check?job_url=${encodeURIComponent("https://capture.example.com/jobs/42")}&company=CapturedCorp&job_title=Senior%20Capture%20Lead`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    expect(check1.ok()).toBeTruthy();
    const dupResult1 = await check1.json();
    expect(dupResult1.has_duplicate).toBe(false);
    expect(dupResult1.match_type).toBe("none");

    // 4. Capture job application via extension API with manual resume version
    const createRes = await page.request.post("/api/extension/applications", {
      headers: { Authorization: `Bearer ${bearerToken}` },
      data: {
        company: "CapturedCorp",
        job_title: "Senior Capture Lead",
        location: "Remote",
        work_arrangement: "Remote",
        employment_type: "Full-time",
        salary_range: "$160,000 - $185,000",
        stage: "Applied",
        date_applied: "2026-09-20",
        job_url: "https://capture.example.com/jobs/42?utm_source=ext",
        source: "Extension",
        resume_version: "QA Automation v96",
        resume_id: null,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createdApp = await createRes.json();
    expect(createdApp.id).toBeGreaterThan(0);
    expect(createdApp.company).toBe("CapturedCorp");
    expect(createdApp.job_title).toBe("Senior Capture Lead");
    expect(createdApp.resume_version).toBe("QA Automation v96");

    // 5. Level-1 duplicate check: exact normalized URL match (EXACT_POSTING)
    const check2 = await page.request.get(
      `/api/extension/duplicate-check?job_url=${encodeURIComponent("https://capture.example.com/jobs/42?utm_campaign=newsletter")}`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    expect(check2.ok()).toBeTruthy();
    const dupResult2 = await check2.json();
    expect(dupResult2.has_duplicate).toBe(true);
    expect(dupResult2.match_type).toBe("exact_posting");
    expect(dupResult2.matches[0].match_type).toBe("exact_posting");

    // 6. Level-2 duplicate check: company + title match (SAME_ROLE)
    const check3 = await page.request.get(
      `/api/extension/duplicate-check?company=capturedcorp&job_title=SENIOR%20CAPTURE%20LEAD`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    expect(check3.ok()).toBeTruthy();
    const dupResult3 = await check3.json();
    expect(dupResult3.has_duplicate).toBe(true);
    expect(dupResult3.match_type).toBe("same_role");
    expect(dupResult3.matches[0].match_type).toBe("same_role");

    // 6b. Company-only check: same company, different role (COMPANY_ONLY)
    const check4 = await page.request.get(
      `/api/extension/duplicate-check?company=capturedcorp&job_title=Junior%20Analyst`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    expect(check4.ok()).toBeTruthy();
    const dupResult4 = await check4.json();
    expect(dupResult4.has_duplicate).toBe(false); // informational only
    expect(dupResult4.match_type).toBe("company_only");
    expect(dupResult4.matches[0].match_type).toBe("company_only");

    // 7. Verify the newly captured application appears in JobQuest UI
    const narrow = ["tablet", "mobile", "small-mobile"].includes(
      testInfo.project.name,
    );
    if (narrow) await openMobileNav(page);
    await page
      .getByRole("button", { name: "Applications", exact: true })
      .click();

    await expect(
      page.locator('tr:has-text("CapturedCorp")'),
    ).toBeVisible();
    await expect(
      page.locator('tr:has-text("Senior Capture Lead")'),
    ).toBeVisible();
  });

  test("deep-link: 'Open Existing' navigates directly to application detail view (exact posting)", async ({
    page,
  }, testInfo) => {
    const auth = await authenticatedPage(page, testInfo);

    // 1. Create extension token
    const tokenRes = await page.request.post("/api/extension/tokens", {
      headers: { "X-CSRF-Token": auth.csrf_token },
      data: { label: "Deep-Link Test Token" },
    });
    expect(tokenRes.ok()).toBeTruthy();
    const { token: bearerToken } = await tokenRes.json();

    // 2. Seed application: Company = ABC, Title = QA Engineer, Stage = Applied
    const seedRes = await page.request.post("/api/extension/applications", {
      headers: { Authorization: `Bearer ${bearerToken}` },
      data: {
        company: "ABC",
        job_title: "QA Engineer",
        job_url: "https://abc.example.com/jobs/123",
        stage: "Applied",
        date_applied: "2026-09-20",
      },
    });
    expect(seedRes.ok()).toBeTruthy();
    const seededApp = await seedRes.json();
    expect(seededApp.id).toBeGreaterThan(0);

    // 3. Duplicate check returns EXACT_POSTING with matched application ID
    const checkRes = await page.request.get(
      `/api/extension/duplicate-check?job_url=${encodeURIComponent("https://abc.example.com/jobs/123")}`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    expect(checkRes.ok()).toBeTruthy();
    const dupCheck = await checkRes.json();
    expect(dupCheck.match_type).toBe("exact_posting");
    expect(dupCheck.matches[0].id).toBe(seededApp.id);
    expect(dupCheck.matches[0].application_id).toBe(seededApp.id);

    // 4. Navigate directly to target application via deep-link
    await page.goto(`/?application=${seededApp.id}`);

    // 5. Verify application detail view is open
    await expect(page.locator("h1")).toContainText("ABC — QA Engineer");
    await expect(page.locator(".stage-badge")).toContainText("Applied");
    await expect(page.locator("#detail-stage")).toHaveValue("Applied");

    // 6. Verify Dashboard is NOT the terminal destination
    await expect(page.locator(".dashboard-hero")).not.toBeVisible();
  });

  test("deep-link: unauthenticated deep-link preserves target through login", async ({
    page,
    context,
  }, testInfo) => {
    // 1. Create user and seed an application
    const suffix = `${testInfo.project.name}-${Date.now()}`.replace(/[^a-z0-9]/gi, "");
    const username = `unauthuser${suffix}`.slice(0, 40);
    const regRes = await page.request.post("/api/auth/register", {
      data: {
        full_name: "Unauthenticated Target User",
        username,
        pin: "4321",
        confirm_pin: "4321",
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const auth = await regRes.json();

    const tokenRes = await page.request.post("/api/extension/tokens", {
      headers: { "X-CSRF-Token": auth.csrf_token },
      data: { label: "Unauth Test Token" },
    });
    expect(tokenRes.ok()).toBeTruthy();
    const { token: bearerToken } = await tokenRes.json();

    const seedRes = await page.request.post("/api/extension/applications", {
      headers: { Authorization: `Bearer ${bearerToken}` },
      data: {
        company: "TargetCorp",
        job_title: "Deep Link Lead",
        stage: "Applied",
        date_applied: "2026-09-20",
      },
    });
    const seededApp = await seedRes.json();

    // 2. Clear browser session cookies to ensure unauthenticated state
    await context.clearCookies();

    // 3. Navigate directly to deep-link URL while logged out
    await page.goto(`/?application=${seededApp.id}`);

    // 4. Verify auth view is displayed
    await expect(page.locator("#auth-form")).toBeVisible();

    // 5. Sign in
    await page.locator('#auth-form input[name="username"]').fill(username);
    await page.locator('#auth-form input[name="pin"]').fill("4321");
    await page.locator('#auth-form button:has-text("Sign in")').click();

    // 6. Verify user is taken directly to the target application detail
    await expect(page.locator("h1")).toContainText("TargetCorp — Deep Link Lead");
    await expect(page.locator(".stage-badge")).toContainText("Applied");
    await expect(page.locator(".dashboard-hero")).not.toBeVisible();
  });

  test("deep-link: missing or deleted target application falls back gracefully with toast", async ({
    page,
  }, testInfo) => {
    await authenticatedPage(page, testInfo);

    // Navigate to non-existent application ID
    await page.goto("/?application=999999");

    // Must not crash; falls back to applications workspace and displays toast
    await expect(page.locator(".application-workspace, #applications-table-root, h1:has-text('Applications')").first()).toBeVisible();
    await expect(page.locator("#toast")).toContainText("Application could not be found.");
    await expect(page.locator(".dashboard-hero")).not.toBeVisible();
  });

  test("extension stage: capture with 'Saved' stage (bookmarking) is supported and displayed in UI", async ({
    page,
  }, testInfo) => {
    const auth = await authenticatedPage(page, testInfo);

    const tokenRes = await page.request.post("/api/extension/tokens", {
      headers: { "X-CSRF-Token": auth.csrf_token },
      data: { label: "Saved Stage Token" },
    });
    const { token: bearerToken } = await tokenRes.json();

    // Verify GET /api/extension/stages returns Saved
    const stagesRes = await page.request.get("/api/extension/stages", {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    expect(stagesRes.ok()).toBeTruthy();
    const { stages } = await stagesRes.json();
    expect(stages).toContain("Saved");

    // Save posting as "Saved" (bookmarking)
    const createRes = await page.request.post("/api/extension/applications", {
      headers: { Authorization: `Bearer ${bearerToken}` },
      data: {
        company: "BookmarkedCo",
        job_title: "Pre-Application Researcher",
        stage: "Saved",
        date_applied: "2026-09-20",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const savedApp = await createRes.json();
    expect(savedApp.stage).toBe("Saved");

    // Open via deep-link
    await page.goto(`/?application=${savedApp.id}`);
    await expect(page.locator("h1")).toContainText("BookmarkedCo — Pre-Application Researcher");
    await expect(page.locator(".stage-badge")).toContainText("Saved");
    await expect(page.locator("#detail-stage")).toHaveValue("Saved");
  });
});

