ALTER TABLE application_view_preferences ADD COLUMN kanban_grouping TEXT NOT NULL DEFAULT 'date_applied_day'
  CHECK (kanban_grouping IN ('date_applied_day','date_applied_week','date_applied_month','last_updated_day','next_action_day','none'));
ALTER TABLE application_view_preferences ADD COLUMN collapsed_groups_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE application_view_preferences ADD COLUMN table_density TEXT NOT NULL DEFAULT 'compact'
  CHECK (table_density IN ('compact','comfortable'));
ALTER TABLE application_view_preferences ADD COLUMN cards_per_group INTEGER NOT NULL DEFAULT 15
  CHECK (cards_per_group BETWEEN 10 AND 20);
ALTER TABLE users ADD COLUMN dashboard_visualization_json TEXT NOT NULL DEFAULT '{}';
