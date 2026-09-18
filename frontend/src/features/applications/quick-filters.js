// Round 3: one-click quick filters for the Applications workspace.
//
// Every value here maps onto query params the backend already understands
// (`date_field`/`date_from`/`date_to` from Feature Upgrade 1's advanced filter
// bar, plus `status_group` added in Round 3 — see
// backend/src/feature-upgrade.js's buildApplicationWhere). No client-side
// filtering: these just seed the same server-side query every other filter
// control uses, so quick filters compose with search/filters/sort exactly
// like the rest of the toolbar.

const pad = (value) => String(value).padStart(2, "0");

const isoDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Monday-start week, matching ui-utils.js's kanbanGroupKey("date_applied_week").
function startOfWeek(date) {
  const result = new Date(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

export const QUICK_FILTERS = Object.freeze([
  { id: "applied-today", label: "Applied Today" },
  { id: "applied-week", label: "Applied This Week" },
  { id: "applied-month", label: "Applied This Month" },
  { id: "recently-updated", label: "Recently Updated" },
  { id: "active", label: "Active Applications" },
  { id: "closed", label: "Closed Applications" },
]);

const QUICK_FILTER_PARAM_KEYS = ["date_field", "date_from", "date_to", "status_group"];

export function quickFilterValues(id, today = new Date()) {
  switch (id) {
    case "applied-today":
      return { date_field: "date_applied", date_from: isoDate(today), date_to: isoDate(today) };
    case "applied-week":
      return {
        date_field: "date_applied",
        date_from: isoDate(startOfWeek(today)),
        date_to: isoDate(today),
      };
    case "applied-month":
      return {
        date_field: "date_applied",
        date_from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
        date_to: isoDate(today),
      };
    case "recently-updated": {
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      return { date_field: "updated_at", date_from: isoDate(from), date_to: isoDate(today) };
    }
    case "active":
      return { status_group: "active" };
    case "closed":
      return { status_group: "closed" };
    default:
      return {};
  }
}

export function isQuickFilterActive(id, params, today = new Date()) {
  const values = quickFilterValues(id, today);
  return (
    Object.keys(values).length > 0 &&
    Object.entries(values).every(([key, value]) => params.get(key) === value)
  );
}

export function activeQuickFilter(params, today = new Date()) {
  return QUICK_FILTERS.find((filter) => isQuickFilterActive(filter.id, params, today))?.id ?? null;
}

// Toggling an already-active quick filter clears it (independently of any
// other filter/search/sort state); toggling a different one replaces only
// the quick-filter param keys, leaving search/other filters/sort untouched.
export function toggleQuickFilter(params, id, today = new Date()) {
  const next = new URLSearchParams(params);
  for (const key of QUICK_FILTER_PARAM_KEYS) next.delete(key);
  if (!isQuickFilterActive(id, params, today)) {
    for (const [key, value] of Object.entries(quickFilterValues(id, today)))
      next.set(key, value);
  }
  next.delete("page");
  return next;
}
