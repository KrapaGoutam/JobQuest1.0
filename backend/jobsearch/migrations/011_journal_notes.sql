-- Round 9: journal/notes, a genuinely independent domain from the notes-like fields
-- already embedded on applications/interviews/rejections/networking_contacts/
-- follow_ups/resumes/weekly_goals/tasks - those stay exactly as they are (see
-- docs/FEATURE_UPGRADE_9.md "Domain Boundaries"). title is nullable (a note is valid
-- with just a body); application_id is nullable and SET NULL on delete, matching the
-- same pattern tasks.application_id and networking_contacts.application_id already use.
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
    title TEXT,
    body TEXT NOT NULL DEFAULT '',
    note_type TEXT NOT NULL DEFAULT 'general' CHECK (note_type IN ('general','daily_journal','interview','company_research','reflection')),
    entry_date TEXT,
    pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_note_owner_updated ON notes(user_id, updated_at);
CREATE INDEX idx_note_owner_application ON notes(user_id, application_id);
CREATE INDEX idx_note_owner_type ON notes(user_id, note_type);
