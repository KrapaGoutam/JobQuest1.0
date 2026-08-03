CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    full_name TEXT NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'MANAGER')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company TEXT NOT NULL,
    job_title TEXT NOT NULL,
    date_applied TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'Applied' CHECK (stage IN ('Saved','Preparing','Applied','Assessment','Recruiter Screen','Interview','Final Interview','Offer','Rejected','Withdrawn','Ghosted','Position Closed','Accepted')),
    job_url TEXT, location TEXT,
    work_arrangement TEXT CHECK (work_arrangement IS NULL OR work_arrangement IN ('Remote','Hybrid','Onsite')),
    employment_type TEXT CHECK (employment_type IS NULL OR employment_type IN ('Full-time','Part-time','Contract','Internship','Temporary','Other')),
    date_found TEXT, source TEXT,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
    salary_min REAL, salary_max REAL, salary_currency TEXT, salary_range TEXT,
    resume_version TEXT, cover_letter_version TEXT,
    recruiter_name TEXT, recruiter_email TEXT, recruiter_phone TEXT,
    job_description TEXT, notes TEXT, next_action TEXT, next_action_date TEXT,
    last_response_date TEXT, external_job_id TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    updated_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_app_owner_date ON applications(user_id, date_applied);
CREATE INDEX idx_app_owner_stage ON applications(user_id, stage);
CREATE INDEX idx_app_owner_identity ON applications(user_id, company, job_title);

CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    actor_user_id INTEGER NOT NULL REFERENCES users(id),
    activity_type TEXT NOT NULL,
    previous_stage TEXT, new_stage TEXT, note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_activity_app ON activities(application_id, created_at);

CREATE TABLE interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    interview_round TEXT NOT NULL, interview_type TEXT NOT NULL,
    scheduled_at TEXT NOT NULL, time_zone TEXT, format TEXT,
    meeting_link TEXT, interviewer_names TEXT, interviewer_contact TEXT,
    preparation_notes TEXT, questions_expected TEXT, questions_asked TEXT,
    performance_notes TEXT, thank_you_status TEXT, follow_up_date TEXT,
    result TEXT, next_step TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_interview_owner_date ON interviews(user_id, scheduled_at);

CREATE TABLE rejections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    rejection_date TEXT NOT NULL, stage_at_rejection TEXT NOT NULL,
    rejection_reason TEXT, feedback_received TEXT, recruiter_feedback TEXT,
    lessons_learned TEXT, eligible_for_reapplication INTEGER NOT NULL DEFAULT 0,
    reapplication_date TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(application_id, rejection_date)
);

CREATE TABLE networking_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
    contact_name TEXT NOT NULL, company TEXT, job_title TEXT, linkedin_url TEXT,
    email TEXT, phone TEXT, relationship_type TEXT, connection_request_date TEXT,
    connection_accepted INTEGER DEFAULT 0, first_message_sent INTEGER DEFAULT 0,
    response_received INTEGER DEFAULT 0, referral_requested INTEGER DEFAULT 0,
    referral_received INTEGER DEFAULT 0, last_contact_date TEXT,
    next_follow_up_date TEXT, networking_stage TEXT NOT NULL DEFAULT 'Identified', notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_network_owner_followup ON networking_contacts(user_id, next_follow_up_date);

CREATE TABLE follow_ups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
    interview_id INTEGER REFERENCES interviews(id) ON DELETE CASCADE,
    networking_contact_id INTEGER REFERENCES networking_contacts(id) ON DELETE CASCADE,
    follow_up_type TEXT NOT NULL, contact_name TEXT, communication_channel TEXT,
    due_date TEXT NOT NULL, sent_date TEXT,
    status TEXT NOT NULL DEFAULT 'Due' CHECK (status IN ('Due','Sent','Waiting','Responded','No Response','Completed','Cancelled')),
    response_status TEXT, next_follow_up_date TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (application_id IS NOT NULL OR interview_id IS NOT NULL OR networking_contact_id IS NOT NULL)
);
CREATE INDEX idx_followup_owner_due ON follow_ups(user_id, due_date);

CREATE TABLE daily_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id), goal_date TEXT NOT NULL,
    applications_target INTEGER NOT NULL DEFAULT 0, jobs_researched_target INTEGER NOT NULL DEFAULT 0,
    resumes_target INTEGER NOT NULL DEFAULT 0, recruiter_messages_target INTEGER NOT NULL DEFAULT 0,
    connections_target INTEGER NOT NULL DEFAULT 0, follow_ups_target INTEGER NOT NULL DEFAULT 0,
    interview_prep_minutes_target INTEGER NOT NULL DEFAULT 0, interview_prep_minutes_actual INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, goal_date)
);
CREATE INDEX idx_daily_owner_date ON daily_goals(user_id, goal_date);

CREATE TABLE weekly_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id), week_start TEXT NOT NULL, week_end TEXT NOT NULL,
    application_target INTEGER NOT NULL DEFAULT 0, networking_target INTEGER NOT NULL DEFAULT 0,
    follow_up_target INTEGER NOT NULL DEFAULT 0, interview_prep_target INTEGER NOT NULL DEFAULT 0,
    custom_goal_label TEXT, custom_goal_target INTEGER NOT NULL DEFAULT 0, custom_goal_completed INTEGER NOT NULL DEFAULT 0,
    main_accomplishment TEXT, main_challenge TEXT, applications_generating_responses INTEGER NOT NULL DEFAULT 0,
    priorities_next_week TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, week_start)
);
CREATE INDEX idx_weekly_owner_start ON weekly_goals(user_id, week_start);

CREATE TABLE import_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id), actor_user_id INTEGER NOT NULL REFERENCES users(id),
    input_format TEXT NOT NULL, import_mode TEXT NOT NULL, duplicate_action TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0, valid_rows INTEGER NOT NULL DEFAULT 0,
    invalid_rows INTEGER NOT NULL DEFAULT 0, duplicate_rows INTEGER NOT NULL DEFAULT 0,
    created_rows INTEGER NOT NULL DEFAULT 0, updated_rows INTEGER NOT NULL DEFAULT 0,
    skipped_rows INTEGER NOT NULL DEFAULT 0, rejected_rows INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
);
CREATE INDEX idx_import_owner_created ON import_batches(user_id, created_at);

CREATE TABLE import_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id), row_number INTEGER NOT NULL,
    status TEXT NOT NULL, messages_json TEXT NOT NULL DEFAULT '[]', application_id INTEGER REFERENCES applications(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
    actor_user_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL,
    entity_type TEXT NOT NULL, entity_id INTEGER, details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
