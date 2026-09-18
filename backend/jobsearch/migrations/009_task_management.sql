-- Round 7: general-purpose task management, distinct from the existing
-- reminders domain (see docs/FEATURE_UPGRADE_7.md "Domain Boundaries").
-- due_date is nullable (reminders.due_date is NOT NULL) so a task can live in
-- an unscheduled Backlog/Inbox state, which reminders cannot represent.
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed')),
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
    due_date TEXT,
    completed_at TEXT,
    recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN ('daily','weekdays','weekly','monthly')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_task_owner_due ON tasks(user_id, due_date);
CREATE INDEX idx_task_owner_status ON tasks(user_id, status);
CREATE INDEX idx_task_application ON tasks(application_id);
