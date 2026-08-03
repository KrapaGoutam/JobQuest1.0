ALTER TABLE users ADD COLUMN pin_hash TEXT;
ALTER TABLE users ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'legacy_password'
  CHECK (auth_method IN ('legacy_password','pin'));
