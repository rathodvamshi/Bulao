-- Apply exclusively to Cloudflare D1 using --remote.
-- Existing users.phone already has a UNIQUE constraint and stores E.164 numbers.
ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN updated_at INTEGER;
ALTER TABLE users ADD COLUMN last_login_at INTEGER;
ALTER TABLE sessions ADD COLUMN created_at INTEGER;
ALTER TABLE sessions ADD COLUMN revoked_at INTEGER;
CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);
CREATE TABLE auth_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  phone_hash TEXT,
  ip_hash TEXT,
  event_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  success INTEGER NOT NULL CHECK(success IN (0,1)),
  code TEXT
);
CREATE INDEX auth_events_user_id ON auth_events(user_id);
CREATE INDEX auth_events_created_at ON auth_events(created_at);
CREATE INDEX auth_events_request_id ON auth_events(request_id);
