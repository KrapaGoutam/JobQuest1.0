import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeCell } from "../src/feature-upgrade.js";
import {
  moveWidget,
  applyTheme,
  monthCells,
  agingBand,
  selectAllWidgets,
  deselectAllWidgets,
  widgetSelectionState,
  kanbanGroupKey,
  groupKanbanItems,
} from "../../frontend/src/ui-utils.js";
import { parseHTML } from "linkedom";
import { createApplicationTable } from "../../frontend/src/application-table.js";
import {
  DASHBOARD_WIDGETS,
  WIDGET_NAMES,
} from "../../frontend/src/dashboard-config.js";
import {
  TIERS,
  groupWidgetsByTier,
} from "../../frontend/src/features/dashboard/tiers.js";
import {
  QUICK_FILTERS,
  quickFilterValues,
  isQuickFilterActive,
  activeQuickFilter,
  toggleQuickFilter,
} from "../../frontend/src/features/applications/quick-filters.js";

test("dashboard registry preserves the complete unique widget contract", () => {
  assert.equal(DASHBOARD_WIDGETS.length, 30);
  assert.equal(new Set(DASHBOARD_WIDGETS.map((widget) => widget.id)).size, 30);
  assert.equal(WIDGET_NAMES["applications-today"], "Applications Today");
  assert.equal(WIDGET_NAMES["daily-goal-chart"], "Daily Target vs Actual");
  assert.equal(WIDGET_NAMES["calendar-preview"], "Calendar Preview");
  assert.ok(DASHBOARD_WIDGETS.every((widget) => widget.id && widget.name && widget.kind));
});

test("application headers use safe interactive DOM without escaped markup", () => {
  const { document } = parseHTML("<html><body></body></html>");
  const calls = [];
  document.body.append(
    createApplicationTable(document, {
      items: [
        {
          id: 7,
          company: '<img src=x onerror="alert(1)">',
          job_title: "Engineer",
          stage: "Applied",
          date_applied: "2026-08-03",
        },
      ],
      onFilter: (field) => calls.push(["filter", field]),
      onSort: (field, direction) => calls.push(["sort", field, direction]),
    }),
  );
  const filter = document.querySelector('button[aria-label="Filter Company"]');
  const sort = document.querySelector('button[aria-label="Sort by Company"]');
  assert.ok(filter, "column filter must be a real button");
  assert.ok(sort, "sortable heading must be a real button");
  assert.equal(document.querySelector("tbody img"), null);
  assert.ok(document.body.textContent.includes("<img src=x"));
  assert.doesNotMatch(document.body.textContent, /<BUTTON|CLASS=/i);
  filter.click();
  sort.click();
  assert.deepEqual(calls, [
    ["filter", "company"],
    ["sort", "company", "asc"],
  ]);
});

test("Kanban grouping uses local calendar dates and stable day week month buckets", () => {
  const items = [
    { id: 1, date_applied: "2026-08-03", updated_at: "2026-08-04T23:10:00" },
    { id: 2, date_applied: "2026-08-09", updated_at: "2026-08-05T01:10:00" },
    { id: 3, date_applied: null, next_action_date: null },
  ];
  assert.equal(kanbanGroupKey(items[0], "date_applied_day"), "2026-08-03");
  assert.equal(kanbanGroupKey(items[0], "date_applied_week"), "2026-08-03");
  assert.equal(kanbanGroupKey(items[1], "date_applied_week"), "2026-08-03");
  assert.equal(kanbanGroupKey(items[0], "date_applied_month"), "2026-08");
  assert.equal(kanbanGroupKey(items[2], "next_action_day"), "no-date");
  assert.deepEqual(
    groupKanbanItems(items, "date_applied_week").map((group) => [
      group.key,
      group.items.length,
    ]),
    [
      ["2026-08-03", 2],
      ["no-date", 1],
    ],
  );
});

test("widget reordering supports keyboard and mobile move directions", () => {
  const widgets = [
    { widget_id: "a", position: 0 },
    { widget_id: "b", position: 1 },
    { widget_id: "c", position: 2 },
  ];
  assert.deepEqual(
    moveWidget(widgets, 1, -1).map((item) => item.widget_id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    moveWidget(widgets, 1, 1).map((item) => item.widget_id),
    ["a", "c", "b"],
  );
  assert.deepEqual(
    moveWidget(widgets, 0, -1).map((item) => item.widget_id),
    ["a", "b", "c"],
  );
});

test("dashboard bulk selection preserves order, sizes, and mixed state", () => {
  const defaults = [
    { widget_id: "a", position: 0, width: 1, height: 1, enabled: 1 },
    { widget_id: "b", position: 1, width: 2, height: 1, enabled: 1 },
    { widget_id: "c", position: 2, width: 3, height: 1, enabled: 0 },
  ];
  const draft = [
    { ...defaults[1], position: 0, width: 3, enabled: 1 },
    { ...defaults[0], position: 1, enabled: 1 },
    { ...defaults[2], position: 2, width: 0, enabled: 0 },
  ];
  const all = selectAllWidgets(draft, defaults);
  assert.deepEqual(
    all.map((item) => item.widget_id),
    ["b", "a", "c"],
  );
  assert.equal(all[0].width, 3);
  assert.equal(all[2].width, 3);
  assert.deepEqual(widgetSelectionState(all), {
    checked: true,
    indeterminate: false,
  });
  const none = deselectAllWidgets(all);
  assert.ok(none.every((item) => !item.enabled));
  assert.deepEqual(widgetSelectionState([{ enabled: 1 }, { enabled: 0 }]), {
    checked: false,
    indeterminate: true,
  });
});

test("theme resolution supports light, dark, and system", () => {
  const root = { dataset: {} };
  assert.equal(applyTheme("system", root, { matches: true }), "dark");
  assert.equal(root.dataset.themePreference, "system");
  assert.equal(applyTheme("light", root, { matches: true }), "light");
});

test("calendar month has stable six-week grid and aging bands", () => {
  const cells = monthCells(2026, 7);
  assert.equal(cells.length, 42);
  assert.ok(
    cells.some((cell) => cell.date === "2026-08-03" && cell.currentMonth),
  );
  assert.deepEqual([0, 5, 10, 20, 31].map(agingBand), [
    "New",
    "Waiting",
    "Follow-Up Recommended",
    "Stale",
    "Long Waiting",
  ]);
});

test("feature upgrade UI includes accessible Table, Kanban, filters, settings, goal chart, and export controls", () => {
  const source = ["app.js", "application-table.js"]
    .map((file) =>
      readFileSync(new URL(`../../frontend/src/${file}`, import.meta.url), "utf8"),
    )
    .join("\n");
  const css = readFileSync(
    new URL("../../frontend/src/styles.css", import.meta.url),
    "utf8",
  );
  for (const marker of [
    'aria-label="Applications view"',
    'aria-label="Application Kanban board"',
    "Move to stage",
    "Resume Version",
    "More Filters",
    "Excel (.xlsx)",
    "Goal Settings",
    "daily-goal-chart",
    "application-summary",
    "Application pipeline summary",
    "Search applications",
  ])
    assert.ok(source.includes(marker), `missing ${marker}`);
  for (const marker of [
    "prefers-reduced-motion",
    ".kanban-card:focus-visible",
    ".mobile-menu",
    "dialog::backdrop",
  ])
    assert.ok(css.includes(marker), `missing ${marker}`);
});

test("Excel text escaping prevents formula injection", () => {
  for (const value of ["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)"])
    assert.equal(safeCell(value), `'${value}`);
  assert.equal(safeCell("Normal company"), "Normal company");
});

test("every dashboard widget is assigned to exactly one information-hierarchy tier", () => {
  const widgets = DASHBOARD_WIDGETS.map((widget, position) => ({
    widget_id: widget.id,
    position,
    width: 1,
  }));
  const tiers = groupWidgetsByTier(widgets);
  const seen = tiers.flatMap((tier) => tier.widgets.map((item) => item.widget_id));
  assert.equal(seen.length, DASHBOARD_WIDGETS.length);
  assert.equal(new Set(seen).size, DASHBOARD_WIDGETS.length);
  assert.ok(tiers.every((tier) => TIERS.some((definition) => definition.id === tier.id)));
});

test("dashboard tiers preserve each widget's existing position order", () => {
  const widgets = [
    { widget_id: "recent-activity", position: 0 },
    { widget_id: "overdue-follow-ups", position: 1 },
    { widget_id: "aging-applications", position: 2 },
    { widget_id: "follow-ups-due", position: 3 },
  ];
  const actionsTier = groupWidgetsByTier(widgets).find((tier) => tier.id === "actions");
  assert.deepEqual(
    actionsTier.widgets.map((item) => item.widget_id),
    ["overdue-follow-ups", "follow-ups-due"],
  );
});

test("quick filters map onto the existing date_field/date_from/date_to/status_group params", () => {
  const today = new Date(2026, 8, 14); // 2026-09-14, a Monday
  assert.deepEqual(quickFilterValues("applied-today", today), {
    date_field: "date_applied",
    date_from: "2026-09-14",
    date_to: "2026-09-14",
  });
  assert.deepEqual(quickFilterValues("applied-week", today), {
    date_field: "date_applied",
    date_from: "2026-09-14",
    date_to: "2026-09-14",
  });
  assert.deepEqual(quickFilterValues("applied-month", today), {
    date_field: "date_applied",
    date_from: "2026-09-01",
    date_to: "2026-09-14",
  });
  assert.deepEqual(quickFilterValues("recently-updated", today), {
    date_field: "updated_at",
    date_from: "2026-09-07",
    date_to: "2026-09-14",
  });
  assert.deepEqual(quickFilterValues("active", today), { status_group: "active" });
  assert.deepEqual(quickFilterValues("closed", today), { status_group: "closed" });
  assert.equal(QUICK_FILTERS.length, 6);
});

test("toggling a quick filter is independent and mutually exclusive", () => {
  const today = new Date(2026, 8, 14);
  let params = new URLSearchParams({ search: "engineer", sort: "company", direction: "asc" });
  params = toggleQuickFilter(params, "active", today);
  assert.equal(isQuickFilterActive("active", params, today), true);
  assert.equal(activeQuickFilter(params, today), "active");
  // Search/sort untouched by the quick filter.
  assert.equal(params.get("search"), "engineer");
  assert.equal(params.get("sort"), "company");
  // Switching to a different quick filter replaces, rather than adds to, the
  // previous one's params.
  params = toggleQuickFilter(params, "applied-today", today);
  assert.equal(activeQuickFilter(params, today), "applied-today");
  assert.equal(params.get("status_group"), null);
  // Toggling the active quick filter again clears it.
  params = toggleQuickFilter(params, "applied-today", today);
  assert.equal(activeQuickFilter(params, today), null);
  assert.equal(params.get("date_from"), null);
});
