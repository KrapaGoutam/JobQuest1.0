-- Round 8: habit tracker, distinct from goals (goal_settings/goal_snapshots are fixed
-- KPI categories computed from other tables), tasks (recurrence advances to a new row,
-- no per-row history), and reminders (no repetition at all). See
-- docs/FEATURE_UPGRADE_8.md "Domain Boundaries".
CREATE TABLE habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekdays','weekly')),
    target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count > 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_habit_owner_active ON habits(user_id, active);

-- One row per (habit, calendar date) storing an absolute count - not one row per
-- action. Covers boolean habits (target_count=1, value 0/1) and count habits
-- (target_count=5, value incrementing toward 5) with a single model. The UNIQUE
-- constraint is what makes PUT .../progress idempotent under retry.
CREATE TABLE habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    completion_date TEXT NOT NULL,
    value INTEGER NOT NULL DEFAULT 0 CHECK (value >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(habit_id, completion_date)
);
CREATE INDEX idx_habit_log_habit_date ON habit_logs(habit_id, completion_date);
CREATE INDEX idx_habit_log_owner_date ON habit_logs(user_id, completion_date);
