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

test("application checklist: grouping, completion, custom items, reorder, delete, and persistence", async ({
  page,
}, testInfo) => {
  if (["tablet", "mobile", "small-mobile"].includes(testInfo.project.name))
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Applications", exact: true }).click();
  await page.getByText("Northstar Labs").click();
  await expect(
    page.getByRole("heading", { name: "Application Checklist" }),
  ).toBeVisible();

  // The 11 seeded defaults render grouped by lifecycle phase.
  await expect(page.getByRole("heading", { name: "Preparing to apply" })).toBeVisible();
  await expect(page.getByText("0 of 11 complete")).toBeVisible();
  const resumeItem = page.locator("[data-checklist-row]", {
    hasText: "Resume tailored",
  });
  await expect(resumeItem).toBeVisible();

  // Complete an item; verify it actually persisted server-side (not just in
  // the DOM) via a direct API call. This app has no URL-based routing
  // (state.page lives in memory), so a real page.reload() always lands back
  // on the Dashboard by design - that's a routing characteristic, not a
  // checklist bug, and re-navigating through the UI a second time to prove
  // persistence would mean two full mobile-nav-drawer round-trips in one
  // test, which turned out flaky on narrow viewports. Asking the server
  // directly is both more precise and more reliable.
  await resumeItem.getByRole("checkbox").check();
  await expect(page.getByText("1 of 11 complete")).toBeVisible();
  const found = await (
    await page.request.get("/api/applications/query?search=Northstar")
  ).json();
  const appId = found.items[0].id;
  const persisted = await (
    await page.request.get(`/api/applications/${appId}/detail`)
  ).json();
  const persistedResume = persisted.checklist.find(
    (item) => item.label === "Resume tailored",
  );
  expect(persistedResume.completed).toBe(1);
  expect(persistedResume.completed_at).toBeTruthy();

  // Uncomplete.
  await page
    .locator("[data-checklist-row]", { hasText: "Resume tailored" })
    .getByRole("checkbox")
    .uncheck();
  await expect(page.getByText("0 of 11 complete")).toBeVisible();

  // Add two custom items; they render under "Your items", in order added.
  const addItem = async (label) => {
    await page.getByPlaceholder("Custom checklist item").fill(label);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(label)).toBeVisible();
  };
  await addItem("Ask about relocation");
  await addItem("Ask about team size");
  const yourItems = page.locator(".checklist-group", { hasText: "Your items" });
  await expect(yourItems.locator("[data-checklist-row]")).toHaveCount(2);
  await expect(yourItems.locator("[data-checklist-row]").first()).toContainText(
    "Ask about relocation",
  );

  // Reorder: moving the second custom item up swaps it with the first,
  // within the same group (a cross-group swap isn't visible in the grouped
  // display, since group membership is decided by label, not position - see
  // docs/FEATURE_UPGRADE_4.md Known Debt).
  await yourItems
    .locator("[data-checklist-row]", { hasText: "Ask about team size" })
    .getByRole("button", { name: /^Move '.*' up$/ })
    .click();
  await expect(yourItems.locator("[data-checklist-row]").first()).toContainText(
    "Ask about team size",
  );

  // Edit a label.
  page.once("dialog", (dialog) => dialog.accept("Ask about relocation package"));
  await yourItems
    .locator("[data-checklist-row]", { hasText: "Ask about relocation" })
    .getByRole("button", { name: /^Edit '.*'$/ })
    .click();
  await expect(page.getByText("Ask about relocation package")).toBeVisible();

  // Delete both custom items; the group disappears entirely once empty.
  page.on("dialog", (dialog) => dialog.accept());
  await yourItems
    .locator("[data-checklist-row]", { hasText: "Ask about team size" })
    .getByRole("button", { name: /^Delete '.*'$/ })
    .click();
  await expect(page.getByText("Ask about team size")).toHaveCount(0);
  await yourItems
    .locator("[data-checklist-row]", { hasText: "Ask about relocation package" })
    .getByRole("button", { name: /^Delete '.*'$/ })
    .click();
  await expect(page.getByRole("heading", { name: "Your items" })).toHaveCount(0);
  await expect(page.getByText("0 of 11 complete")).toBeVisible();

  // Scoped to the checklist panel itself, not the whole detail page: the
  // rest of the page (timeline, workflow actions, edit form) is pre-existing
  // and out of this round's scope - a full-page scan here surfaced several
  // unrelated, pre-existing missing-label selects (#detail-stage among
  // others). Two trivially-fixable ones on this same page (#timeline-filter/
  // #timeline-sort) were fixed in passing; the rest are backlogged rather
  // than expanding this round into an unrelated page-wide accessibility
  // audit - see docs/FEATURE_UPGRADE_4.md Known Debt.
  const results = await new AxeBuilder({ page })
    .include("#checklist-panel")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("networking contacts: link to an application, edit, show on application detail, and unlink-safe delete", async ({
  page,
}, testInfo) => {
  if (["tablet", "mobile", "small-mobile"].includes(testInfo.project.name))
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Applications", exact: true }).click();
  await page.getByText("Northstar Labs").click();

  // Empty state before any contact is linked.
  await expect(page.getByRole("heading", { name: "Networking Contacts", exact: true })).toBeVisible();
  await expect(page.getByText("No networking contacts linked to this application yet")).toBeVisible();

  // "Link Contact" is Round 5's fix: this button already existed, but the
  // destination form had no application field at all before this round, so
  // it was impossible to actually complete a link through it.
  await page.getByRole("button", { name: "Link Contact" }).first().click();
  // exact: true - the create form on this same page has its own "Add
  // Networking" heading, whose accessible name also contains "Networking"
  // as a substring (a real, pre-existing ambiguity in a non-exact match,
  // independently of any timing - fixed here since it's a one-line,
  // unambiguous improvement to a test in this same file).
  await expect(
    page.getByRole("heading", { name: "Networking", exact: true }),
  ).toBeVisible();
  await expect(page.locator('select[name="application_id"]')).toHaveValue(/\d+/);
  await expect(
    page.locator('select[name="application_id"] option:checked'),
  ).toHaveText("Northstar Labs — Product Engineer");

  await page.getByLabel("Contact Name").fill("Sam Recruiter");
  await page.getByLabel("Relationship Type").fill("Recruiter");
  await page.getByLabel("Email").fill("sam@northstar.test");
  await page.getByLabel("Linkedin Url").fill("https://linkedin.com/in/sam");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Record saved")).toBeVisible();

  // The list shows a real link to the application, not a raw numeric id.
  const appLink = page.getByRole("button", {
    name: "Northstar Labs — Product Engineer",
  });
  await expect(appLink).toBeVisible();
  // The LinkedIn URL renders as an actual link (validated http(s) only).
  await expect(page.getByRole("link", { name: "https://linkedin.com/in/sam" })).toHaveAttribute(
    "href",
    "https://linkedin.com/in/sam",
  );

  // Edit: change the stage, verify it's reflected.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit Networking" })).toBeVisible();
  await page.getByLabel("Stage").selectOption("Connected");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Record updated")).toBeVisible();
  await expect(page.locator("tbody")).toContainText("Connected");

  // Visible from the application side too.
  await appLink.click();
  await expect(page.getByRole("heading", { name: "Networking Contacts", exact: true })).toBeVisible();
  await expect(page.getByText("Sam Recruiter — Recruiter")).toBeVisible();
  await expect(page.getByRole("link", { name: "sam@northstar.test" })).toHaveAttribute(
    "href",
    "mailto:sam@northstar.test",
  );

  // Delete: safe for the application (unlink, not cascade) - verified
  // end-to-end here; the underlying FK/ownership behavior has its own
  // dedicated backend test (see docs/FEATURE_UPGRADE_5.md).
  if (["tablet", "mobile", "small-mobile"].includes(testInfo.project.name))
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Networking", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  // Scoped to the list table, not the whole page: the application select in
  // the (still-present) create form always lists every application as an
  // option regardless of whether any contact is linked to it.
  await expect(
    page.locator("tbody").getByText("Northstar Labs — Product Engineer"),
  ).toHaveCount(0);

  const results = await new AxeBuilder({ page }).exclude(".goal-chart").analyze();
  expect(results.violations).toEqual([]);
});

test("bulk import: CSV format, preview, and import; Import History reachable by a regular user", async ({
  page,
}, testInfo) => {
  const narrow = ["tablet", "mobile", "small-mobile"].includes(testInfo.project.name);
  if (narrow) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Bulk Import", exact: true }).click();

  await page.getByLabel("Format").selectOption("csv");
  const csvInput = [
    "Company Name,Title,Applied Date",
    "Acme Robotics,Backend Engineer,2026-09-10",
  ].join("\n");
  await page.getByLabel("Input").fill(csvInput);
  await page.getByRole("button", { name: "Validate", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Acme Robotics" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Backend Engineer" })).toBeVisible();
  const importButton = page.getByRole("button", { name: "Import", exact: true });
  await expect(importButton).toBeEnabled();
  await importButton.click();
  await expect(page.getByText(/1 created/)).toBeVisible();

  // Lands on Applications; the CSV-imported row (header aliases resolved:
  // "Company Name" -> company, "Title" -> job_title) is really there.
  await expect(page.getByText("Acme Robotics")).toBeVisible();

  // Import History - Round 6 fix: previously manager-only in the nav, even
  // though the API already scoped a regular user to their own batches.
  if (narrow) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Import History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Import History" })).toBeVisible();
  await page.getByRole("button", { name: "View Rows" }).first().click();
  await expect(page.getByText(/Batch #\d+ rows/)).toBeVisible();
  await expect(page.locator("tbody").getByText("created")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
