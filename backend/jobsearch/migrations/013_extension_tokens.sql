-- Migration 013: extension_tokens
-- Stores hashed bearer tokens for the browser capture extension.
-- Raw tokens are never stored; only SHA-256 hashes (same pattern as sessions).
-- One user may have multiple tokens (e.g., work machine + home machine).
-- Revoked tokens keep their row (revoked_at non-null) so last_used_at is auditable.

CREATE TABLE extension_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT     NOT NULL UNIQUE,
  label       TEXT     NOT NULL DEFAULT 'Extension',
  created_at  TEXT     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at  TEXT
);

CREATE INDEX idx_ext_token_user ON extension_tokens(user_id, revoked_at);
