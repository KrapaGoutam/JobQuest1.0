ALTER TABLE users ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('light','dark','system'));
ALTER TABLE users ADD COLUMN week_start INTEGER NOT NULL DEFAULT 1 CHECK (week_start BETWEEN 0 AND 6);
ALTER TABLE users ADD COLUMN first_follow_up_delay INTEGER NOT NULL DEFAULT 5;
ALTER TABLE users ADD COLUMN second_follow_up_delay INTEGER NOT NULL DEFAULT 7;
ALTER TABLE users ADD COLUMN follow_up_day_type TEXT NOT NULL DEFAULT 'business' CHECK (follow_up_day_type IN ('calendar','business'));
ALTER TABLE users ADD COLUMN default_reminder_time TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE users ADD COLUMN auto_create_follow_up_reminder INTEGER NOT NULL DEFAULT 1;

ALTER TABLE applications ADD COLUMN resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL;
ALTER TABLE applications ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN important INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN archived_at TEXT;
ALTER TABLE applications ADD COLUMN next_action_completed_at TEXT;

CREATE TABLE timeline_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    actor_user_id INTEGER NOT NULL REFERENCES users(id),
    event_date TEXT NOT NULL,
    event_time TEXT,
    category TEXT NOT NULL,
    event_type TEXT NOT NULL,
    stage TEXT,
    title TEXT NOT NULL,
    description TEXT,
    contact_person TEXT,
    source TEXT NOT NULL CHECK (source IN ('automatic','manual')),
    related_record_type TEXT,
    related_record_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_timeline_owner_date ON timeline_events(user_id,event_date,event_time);
CREATE INDEX idx_timeline_application_date ON timeline_events(application_id,event_date,event_time);

CREATE TABLE stage_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    actor_user_id INTEGER NOT NULL REFERENCES users(id),
    previous_stage TEXT,
    new_stage TEXT NOT NULL,
    entered_at TEXT NOT NULL,
    left_at TEXT,
    reason TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_stage_history_owner_stage ON stage_history(user_id,new_stage,entered_at);
CREATE INDEX idx_stage_history_app ON stage_history(application_id,entered_at);

CREATE TABLE resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    version_name TEXT NOT NULL,
    target_role TEXT,
    job_category TEXT,
    file_name TEXT,
    secure_file_reference TEXT,
    resume_date TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id,version_name)
);
CREATE INDEX idx_resume_owner_active ON resumes(user_id,is_archived);

CREATE TABLE reminder_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    stable_key TEXT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3157d5',
    icon TEXT NOT NULL DEFAULT 'bell',
    is_builtin INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id,name),
    UNIQUE(stable_key)
);

INSERT INTO reminder_categories(stable_key,name,color,icon,is_builtin) VALUES
('application-follow-up','Application Follow-Up','#3157d5','send',1),
('interview','Interview','#7c3aed','calendar',1),
('interview-preparation','Interview Preparation','#6d28d9','book',1),
('thank-you-note','Thank-You Note','#db2777','heart',1),
('networking','Networking','#0891b2','users',1),
('recruiter-contact','Recruiter Contact','#4f46e5','phone',1),
('resume','Resume','#475569','file',1),
('goal','Goal','#16a34a','target',1),
('reapplication','Reapplication','#ea580c','refresh',1),
('next-action','Next Action','#ca8a04','bolt',1),
('custom','Custom','#64748b','bell',1);

CREATE TABLE reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    category_id INTEGER NOT NULL REFERENCES reminder_categories(id),
    related_record_type TEXT,
    related_record_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT NOT NULL,
    due_time TEXT,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
    status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Upcoming','Snoozed','Completed','Cancelled')),
    snoozed_until TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_reminder_owner_due ON reminders(user_id,due_date,status);
CREATE INDEX idx_reminder_category ON reminders(user_id,category_id);

CREATE TABLE goal_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    period_type TEXT NOT NULL CHECK (period_type IN ('daily','weekly')),
    category TEXT NOT NULL CHECK (category IN ('applications','follow_ups','connections','recruiter_messages','interview_prep_minutes')),
    enabled INTEGER NOT NULL DEFAULT 1,
    target INTEGER NOT NULL DEFAULT 0 CHECK (target >= 0),
    effective_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id,period_type,category,effective_date)
);
CREATE INDEX idx_goal_setting_owner_effective ON goal_settings(user_id,effective_date,end_date);

CREATE TABLE goal_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    period_type TEXT NOT NULL CHECK (period_type IN ('daily','weekly','monthly')),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    category TEXT NOT NULL,
    target INTEGER NOT NULL,
    actual INTEGER NOT NULL,
    completion_percentage REAL NOT NULL,
    achieved INTEGER NOT NULL,
    calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id,period_type,period_start,category)
);
CREATE INDEX idx_goal_snapshot_owner_period ON goal_snapshots(user_id,period_start,category);

CREATE TABLE dashboard_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    dashboard_type TEXT NOT NULL CHECK (dashboard_type IN ('user','manager')),
    widget_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL,
    width INTEGER NOT NULL DEFAULT 1 CHECK (width BETWEEN 1 AND 3),
    height INTEGER NOT NULL DEFAULT 1 CHECK (height BETWEEN 1 AND 3),
    settings_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id,dashboard_type,widget_id)
);
CREATE INDEX idx_dashboard_owner_order ON dashboard_preferences(user_id,dashboard_type,position);

CREATE TABLE saved_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    view_type TEXT NOT NULL DEFAULT 'applications',
    name TEXT NOT NULL,
    filters_json TEXT NOT NULL DEFAULT '{}',
    sorting_json TEXT NOT NULL DEFAULT '{}',
    columns_json TEXT NOT NULL DEFAULT '[]',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id,view_type,name)
);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#64748b',
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id,name)
);

CREATE TABLE application_tags (
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    PRIMARY KEY(application_id,tag_id)
);

CREATE TABLE checklist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    label TEXT NOT NULL,
    is_custom INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    note TEXT,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_checklist_app_order ON checklist_items(application_id,position);

INSERT INTO stage_history(application_id,user_id,actor_user_id,previous_stage,new_stage,entered_at,note)
SELECT id,user_id,created_by,NULL,stage,created_at,'Backfilled from existing application' FROM applications;

INSERT INTO timeline_events(application_id,user_id,actor_user_id,event_date,event_time,category,event_type,stage,title,description,source,created_at,updated_at)
SELECT id,user_id,created_by,substr(created_at,1,10),substr(created_at,12,5),'application','application_created',stage,'Application created',company || ' — ' || job_title,'automatic',created_at,updated_at FROM applications;
