-- Production-Grade OTP System (Reuses existing otp_challenges and rate_limits tables)
-- Preserves all existing users, sessions, and auth_events data.

DROP TRIGGER IF EXISTS replace_otp;

ALTER TABLE otp_challenges ADD COLUMN phone_hash TEXT;
ALTER TABLE otp_challenges ADD COLUMN purpose TEXT NOT NULL DEFAULT 'login';
ALTER TABLE otp_challenges ADD COLUMN otp_hmac TEXT;
ALTER TABLE otp_challenges ADD COLUMN otp_encrypted TEXT;
ALTER TABLE otp_challenges ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE otp_challenges ADD COLUMN resend_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE otp_challenges ADD COLUMN last_sent_at INTEGER;
ALTER TABLE otp_challenges ADD COLUMN cooldown_until INTEGER;
ALTER TABLE otp_challenges ADD COLUMN idempotency_key TEXT;
ALTER TABLE otp_challenges ADD COLUMN created_at INTEGER;
ALTER TABLE otp_challenges ADD COLUMN consumed_at INTEGER;

CREATE INDEX IF NOT EXISTS otp_challenges_active_idx
  ON otp_challenges(phone_hash, purpose, status, expires_at);

CREATE INDEX IF NOT EXISTS otp_challenges_idempotency_idx
  ON otp_challenges(phone_hash, purpose, idempotency_key);

ALTER TABLE rate_limits ADD COLUMN expires_at INTEGER;

CREATE INDEX IF NOT EXISTS rate_limits_expiry_idx
  ON rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS otp_devices (
  installation_hash TEXT PRIMARY KEY,
  last_user_id TEXT REFERENCES users(id),
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS otp_deliveries (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES otp_challenges(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'SENT', 'DELIVERED', 'FAILED', 'UNKNOWN')),
  error_code TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS otp_deliveries_challenge_idx
  ON otp_deliveries(challenge_id);

CREATE INDEX IF NOT EXISTS otp_deliveries_provider_msg_idx
  ON otp_deliveries(provider_message_id);
