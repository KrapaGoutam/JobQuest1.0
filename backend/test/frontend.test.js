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
} from "../../frontend/ui-utils.js";

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
  const source = readFileSync(
    new URL("../../frontend/app.js", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("../../frontend/styles.css", import.meta.url),
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
