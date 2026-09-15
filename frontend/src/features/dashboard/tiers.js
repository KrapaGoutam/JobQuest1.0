// Round 3: information-hierarchy grouping for the Dashboard widget grid.
//
// Every widget already carries a `kind` (kpi/goal/chart/insight/activity/action)
// in dashboard-config.js. This assigns each *widget id* to one of three tiers —
// the operational hierarchy the Round 3 brief asks for — without changing any
// widget's id, name, kind, or persisted layout (position/width/enabled still
// come from the server; this only decides which visual section a widget lands
// in). Add new widget ids to a tier here; unassigned ids fall back to "context"
// so nothing silently disappears from the dashboard.

export const TIERS = Object.freeze([
  {
    id: "actions",
    label: "Needs your attention",
    description: "Follow-ups, interviews, and applications waiting on you",
  },
  {
    id: "pipeline",
    label: "Current pipeline",
    description: "Where your active applications stand right now",
  },
  {
    id: "context",
    label: "Trends & context",
    description: "Longer-run patterns — useful, but not urgent",
  },
]);

const TIER_BY_WIDGET_ID = Object.freeze({
  "follow-ups-due": "actions",
  "overdue-follow-ups": "actions",
  "upcoming-interviews": "actions",
  "reminder-center": "actions",
  "pinned-applications": "actions",
  "health-summary": "actions",
  "calendar-preview": "actions",

  "applications-today": "pipeline",
  "applications-week": "pipeline",
  "applications-month": "pipeline",
  "active-applications": "pipeline",
  responses: "pipeline",
  rejections: "pipeline",
  ghosted: "pipeline",
  offers: "pipeline",
  acceptances: "pipeline",
  "job-funnel": "pipeline",
  "applications-stage": "pipeline",
  "daily-goals": "pipeline",
  "daily-goal-chart": "pipeline",
  "weekly-goals": "pipeline",
  "goal-comparison": "pipeline",

  "activity-chart": "context",
  "applications-source": "context",
  "applications-work-arrangement": "context",
  "resume-performance": "context",
  "goal-trends": "context",
  "aging-applications": "context",
  "stage-duration": "context",
  "recent-activity": "context",
});

export const tierForWidget = (widgetId) => TIER_BY_WIDGET_ID[widgetId] || "context";

// Groups already-position-sorted widgets into the three tiers above, preserving
// each widget's existing relative order within its tier. Empty tiers are
// dropped so a near-empty custom layout doesn't render hollow section headers.
export function groupWidgetsByTier(widgets) {
  const byTier = new Map(TIERS.map((tier) => [tier.id, []]));
  for (const widget of widgets)
    byTier.get(tierForWidget(widget.widget_id)).push(widget);
  return TIERS.map((tier) => ({ ...tier, widgets: byTier.get(tier.id) })).filter(
    (tier) => tier.widgets.length > 0,
  );
}
