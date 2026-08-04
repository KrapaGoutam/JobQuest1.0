ALTER TABLE users ADD COLUMN preferred_applications_view TEXT NOT NULL DEFAULT 'table'
  CHECK (preferred_applications_view IN ('table','kanban'));
ALTER TABLE users ADD COLUMN navigation_collapsed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN navigation_groups_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE applications ADD COLUMN board_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_app_owner_board ON applications(user_id,stage,board_order,updated_at);
CREATE INDEX idx_app_owner_updated ON applications(user_id,updated_at);
CREATE INDEX idx_app_owner_resume ON applications(user_id,resume_id);

ALTER TABLE resumes ADD COLUMN revision_label TEXT;
ALTER TABLE resumes ADD COLUMN parent_resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL;
ALTER TABLE resumes ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE resumes ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resumes ADD COLUMN change_summary TEXT;
CREATE INDEX idx_resume_parent ON resumes(user_id,parent_resume_id);

CREATE TABLE resume_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    actor_user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    version_name TEXT NOT NULL,
    parent_resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
    change_summary TEXT,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_resume_history_owner ON resume_history(user_id,resume_id,created_at);

CREATE TABLE application_view_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    dashboard_type TEXT NOT NULL CHECK (dashboard_type IN ('user','manager')),
    preferred_view TEXT NOT NULL DEFAULT 'table' CHECK (preferred_view IN ('table','kanban')),
    visible_columns_json TEXT NOT NULL DEFAULT '[]',
    collapsed_columns_json TEXT NOT NULL DEFAULT '[]',
    board_sort TEXT NOT NULL DEFAULT 'updated_desc',
    filters_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id,dashboard_type)
);

ALTER TABLE saved_views ADD COLUMN board_settings_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE export_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    format TEXT NOT NULL DEFAULT 'xlsx' CHECK (format IN ('csv','json','xlsx')),
    date_field TEXT NOT NULL DEFAULT 'date_applied' CHECK (date_field IN ('date_applied','created_at','updated_at')),
    date_preset TEXT NOT NULL DEFAULT 'all',
    include_archived INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
