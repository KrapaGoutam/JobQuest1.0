import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function authenticatedPage(page, testInfo) {
  const suffix = `${testInfo.project.name}-${Date.now()}`.replace(
    /[^a-z0-9]/gi,
    "",
  );
  const response = await page.request.post("/api/auth/register", {
    data: {
      full_name: "Visual Test User",
      username: `visual${suffix}`.slice(0, 40),
      pin: "0123",
      confirm_pin: "0123",
    },
  });
  expect(response.ok()).toBeTruthy();
  const auth = await response.json();
  const application = await page.request.post("/api/applications", {
    headers: { "X-CSRF-Token": auth.csrf_token },
    data: {
      company: "Northstar Labs",
      job_title: "Product Engineer",
      stage: "Applied",
      priority: "High",
      date_applied: "2026-08-03",
      location: "Chicago, IL",
      work_arrangement: "Hybrid",
      resume_version: "Product v3",
      next_action: "Send follow-up",
      next_action_date: "2026-08-08",
      notes: "Met the hiring team at a community event.",
    },
  });
  expect(application.ok()).toBeTruthy();
  await page.goto("/");
  await expect(page.locator(".dashboard-hero h1")).toContainText(
    /Good (morning|afternoon|evening), Visual/,
  );
}

async function stabilizeVisuals(page) {
  await page.evaluate(() => {
    document.documentElement.dataset.visualTest = "true";
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  await authenticatedPage(page, testInfo);
});

test("applications table controls, filter dialog, preview drawer, and accessibility", async ({
  page,
}, testInfo) => {
  if (["tablet", "mobile", "small-mobile"].includes(testInfo.project.name))
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Applications", exact: true }).click();
  const companyFilter = page.getByRole("button", { name: "Filter Company" });
  await expect(companyFilter).toBeVisible();
  await expect(page.locator("thead")).not.toContainText(/<BUTTON|CLASS=/i);
  await page.getByRole("button", { name: "Sort by Company" }).click();
  await expect(page.locator('th[aria-sort="ascending"]')).toBeVisible();
  await companyFilter.click();
  await expect(
    page.getByRole("heading", { name: "Filter Company" }),
  ).toBeVisible();
  await page.getByLabel("Company value").fill("Northstar");
  await page.getByRole("button", { name: "Apply filter" }).click();
  await page
    .getByRole("button", { name: /Quick preview Northstar Labs/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: /Northstar Labs/ }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog", { name: /Northstar Labs/ })
      .getByText("Product v3"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const results = await new AxeBuilder({ page })
    .exclude(".goal-chart")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("responsive visual states", async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  await stabilizeVisuals(page);
  await expect(page).toHaveScreenshot(`dashboard-${project}.png`, {
    animations: "disabled",
  });
  if (["tablet", "mobile", "small-mobile"].includes(project))
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Applications", exact: true }).click();
  await expect(page).toHaveScreenshot(`applications-table-${project}.png`, {
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Kanban", exact: true }).click();
  // The view-switch handler awaits a preference PUT, then renderApplications()
  // awaits a further sequential+parallel fetch chain before it rebuilds the
  // whole shell (see shell() in app.js, which replaces app.innerHTML wholesale
  // including the sidebar). waitForLoadState("networkidle") is not reliable
  // here: there is a real gap between the first `await api(preference)` and
  // the follow-up `Promise.all([...])` inside renderApplications, and under
  // CI load that gap can exceed the idle threshold, letting networkidle
  // resolve before the second wave of requests (and the shell rebuild it
  // triggers) finishes. Waiting on the DOM signal that only exists once that
  // final render has landed (Kanban's aria-pressed flipping) is exact instead
  // of timing-based, and Playwright re-resolves the locator by role/name on
  // each retry so it survives the shell being replaced wholesale.
  await expect(
    page.getByRole("button", { name: "Kanban", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveScreenshot(`applications-kanban-${project}.png`, {
    animations: "disabled",
  });
  if (["desktop", "compact-desktop"].includes(project)) {
    await page.getByRole("button", { name: "Collapse navigation" }).click();
    await expect(page).toHaveScreenshot(`sidebar-collapsed-${project}.png`, {
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: /Preview/ })
      .first()
      .click();
    await expect(page).toHaveScreenshot(`application-preview-${project}.png`, {
      animations: "disabled",
    });
  } else {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.locator("#sidebar")).toHaveClass(/\bopen\b/);
    await expect(page).toHaveScreenshot(`mobile-navigation-${project}.png`, {
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
  }
});

test("light dark and system themes remain readable", async ({
  page,
}, testInfo) => {
  test.skip(!["desktop", "mobile"].includes(testInfo.project.name));
  await stabilizeVisuals(page);
  for (const theme of ["light", "dark", "system"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme =
        value === "system" ? "light" : value;
      document.documentElement.dataset.themePreference = value;
    }, theme);
    await expect(page).toHaveScreenshot(
      `dashboard-${theme}-${testInfo.project.name}.png`,
      { animations: "disabled" },
    );
  }
});

test("settings forms reports and empty states visual contract", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await stabilizeVisuals(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page).toHaveScreenshot("settings-desktop.png", {
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Add Application", exact: true })
    .click();
  await expect(page).toHaveScreenshot("application-form-desktop.png", {
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Aging Report", exact: true }).click();
  await expect(page).toHaveScreenshot("aging-report-desktop.png", {
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Applications", exact: true }).click();
  await page.getByLabel("Search applications").fill("no-matching-application");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveScreenshot("applications-empty-desktop.png", {
    animations: "disabled",
  });
});
