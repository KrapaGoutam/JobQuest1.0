export const STAGES = [
  "Saved",
  "Preparing",
  "Applied",
  "Assessment",
  "Recruiter Screen",
  "Interview",
  "Final Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Ghosted",
  "Position Closed",
  "Accepted",
];
export const STAGE_CLASS = Object.fromEntries(
  STAGES.map((stage) => [
    stage,
    `stage-${stage.toLowerCase().replaceAll(" ", "-")}`,
  ]),
);

export function moveWidget(items, index, direction) {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((item, position) => ({ ...item, position }));
}

export function selectAllWidgets(items, defaults) {
  const enabled = items.filter((item) => item.enabled);
  const enabledIds = new Set(enabled.map((item) => item.widget_id));
  const byId = new Map(items.map((item) => [item.widget_id, item]));
  const appended = defaults
    .filter((item) => !enabledIds.has(item.widget_id))
    .map((fallback) => {
      const saved = byId.get(fallback.widget_id);
      return {
        ...fallback,
        ...(saved || {}),
        enabled: 1,
        width: saved?.width > 0 ? saved.width : fallback.width,
        height: saved?.height > 0 ? saved.height : fallback.height,
      };
    });
  return [...enabled.map((item) => ({ ...item, enabled: 1 })), ...appended].map(
    (item, position) => ({ ...item, position }),
  );
}

export const deselectAllWidgets = (items) =>
  items.map((item) => ({ ...item, enabled: 0 }));

export function widgetSelectionState(items) {
  const selected = items.filter((item) => item.enabled).length;
  return {
    checked: items.length > 0 && selected === items.length,
    indeterminate: selected > 0 && selected < items.length,
  };
}

export function applyTheme(
  preference,
  root = document.documentElement,
  media = window.matchMedia("(prefers-color-scheme: dark)"),
) {
  const resolved =
    preference === "system" ? (media.matches ? "dark" : "light") : preference;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  return resolved;
}

export function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      currentMonth: date.getUTCMonth() === month,
    };
  });
}

export function agingBand(days) {
  if (days <= 3) return "New";
  if (days <= 7) return "Waiting";
  if (days <= 14) return "Follow-Up Recommended";
  if (days <= 30) return "Stale";
  return "Long Waiting";
}
