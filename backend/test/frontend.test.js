import test from "node:test";
import assert from "node:assert/strict";
import {
  moveWidget,
  applyTheme,
  monthCells,
  agingBand,
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
