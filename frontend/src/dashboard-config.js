export const DASHBOARD_WIDGETS = Object.freeze([
  ["applications-today", "Applications Today", "kpi"],
  ["applications-week", "Applications This Week", "kpi"],
  ["applications-month", "Applications This Month", "kpi"],
  ["active-applications", "Active Applications", "kpi"],
  ["follow-ups-due", "Follow-Ups Due", "kpi"],
  ["overdue-follow-ups", "Overdue Follow-Ups", "kpi"],
  ["upcoming-interviews", "Upcoming Interviews", "kpi"],
  ["responses", "Responses", "kpi"],
  ["rejections", "Rejections", "kpi"],
  ["ghosted", "Ghosted", "kpi"],
  ["offers", "Offers", "kpi"],
  ["acceptances", "Acceptances", "kpi"],
  ["daily-goals", "Daily Goal Progress", "goal"],
  ["daily-goal-chart", "Daily Target vs Actual", "chart"],
  ["weekly-goals", "Weekly Goal Progress", "goal"],
  ["goal-comparison", "Goal Achievement Comparison", "goal"],
  ["activity-chart", "Application Activity Chart", "chart"],
  ["job-funnel", "Job Funnel", "chart"],
  ["applications-stage", "Applications by Stage", "chart"],
  ["applications-source", "Applications by Source", "insight"],
  ["applications-work-arrangement", "Applications by Work Arrangement", "insight"],
  ["resume-performance", "Resume Performance", "insight"],
  ["goal-trends", "Goal Trends", "goal"],
  ["reminder-center", "Reminder Center", "action"],
  ["aging-applications", "Aging Applications", "insight"],
  ["stage-duration", "Stage-Duration Summary", "insight"],
  ["recent-activity", "Recent Activity", "activity"],
  ["pinned-applications", "Pinned Applications", "action"],
  ["health-summary", "Application Health Summary", "insight"],
  ["calendar-preview", "Calendar Preview", "action"],
].map(([id, name, kind]) => Object.freeze({ id, name, kind })));

export const WIDGET_NAMES = Object.freeze(
  Object.fromEntries(DASHBOARD_WIDGETS.map(({ id, name }) => [id, name])),
);

export const widgetDefinition = (id) =>
  DASHBOARD_WIDGETS.find((widget) => widget.id === id);
