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

export const PRIORITY_TONE = { High: "destructive", Medium: "warning", Low: "muted" };
export function priorityBadgeHtml(priority, esc = (value) => value) {
  return `<span class="badge priority-badge tone-${PRIORITY_TONE[priority] || "muted"}">${esc(priority || "—")}</span>`;
}

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

function validDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match
    ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    : null;
}

function dateFromParts(parts) {
  return new Date(parts.year, parts.month - 1, parts.day, 12);
}

export function kanbanGroupKey(item, mode) {
  if (mode === "none") return "all";
  const field = mode.startsWith("date_applied")
    ? "date_applied"
    : mode === "last_updated_day"
      ? "updated_at"
      : "next_action_date";
  const parts = validDate(item[field]);
  if (!parts) return "no-date";
  if (mode === "date_applied_month")
    return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  if (mode === "date_applied_week") {
    const value = dateFromParts(parts);
    const offset = (value.getDay() + 6) % 7;
    value.setDate(value.getDate() - offset);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function kanbanGroupLabel(key, mode, locale = "en-US") {
  if (key === "all") return "All applications";
  if (key === "no-date") return "No date";
  const parts = validDate(`${key}-01`);
  const value = dateFromParts(parts);
  if (mode === "date_applied_month")
    return value.toLocaleDateString(locale, { month: "long", year: "numeric" });
  if (mode === "date_applied_week") {
    const end = new Date(value);
    end.setDate(end.getDate() + 6);
    return `Week of ${value.toLocaleDateString(locale, { month: "short", day: "numeric" })}–${end.toLocaleDateString(locale, { month: "short", day: "numeric" })}`;
  }
  return value.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function groupKanbanItems(items, mode) {
  const groups = new Map();
  for (const item of items) {
    const key = kanbanGroupKey(item, mode);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()]
    .sort(([a], [b]) =>
      a === "no-date" ? 1 : b === "no-date" ? -1 : b.localeCompare(a),
    )
    .map(([key, groupedItems]) => ({
      key,
      label: kanbanGroupLabel(key, mode),
      items: groupedItems,
    }));
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
