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

    // 4. Capture job application via extension API
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
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createdApp = await createRes.json();
    expect(createdApp.id).toBeGreaterThan(0);
    expect(createdApp.company).toBe("CapturedCorp");
    expect(createdApp.job_title).toBe("Senior Capture Lead");

    // 5. Level-1 duplicate check: exact normalized URL match
    const check2 = await page.request.get(
      `/api/extension/duplicate-check?job_url=${encodeURIComponent("https://capture.example.com/jobs/42?utm_campaign=newsletter")}`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    expect(check2.ok()).toBeTruthy();
    const dupResult2 = await check2.json();
    expect(dupResult2.has_duplicate).toBe(true);
    expect(dupResult2.matches[0].level).toBe(1);
    expect(dupResult2.matches[0].match).toBe("exact_url");

    // 6. Level-2 duplicate check: company + title match
    const check3 = await page.request.get(
      `/api/extension/duplicate-check?company=capturedcorp&job_title=SENIOR%20CAPTURE%20LEAD`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    expect(check3.ok()).toBeTruthy();
    const dupResult3 = await check3.json();
    expect(dupResult3.has_duplicate).toBe(true);
    expect(dupResult3.matches[0].level).toBe(2);
    expect(dupResult3.matches[0].match).toBe("company_title");

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
});
