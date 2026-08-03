ALTER TABLE follow_ups ADD COLUMN suggested_date TEXT;
ALTER TABLE follow_ups ADD COLUMN completed_at TEXT;
CREATE INDEX idx_followup_owner_suggested ON follow_ups(user_id,suggested_date);
