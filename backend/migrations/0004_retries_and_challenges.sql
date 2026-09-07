ALTER TABLE jobs ADD COLUMN submission_key TEXT;
CREATE UNIQUE INDEX job_submission ON jobs(owner_id,submission_key);
ALTER TABLE otp_challenges ADD COLUMN provider TEXT NOT NULL DEFAULT 'development';
CREATE TABLE otp_cooldowns(phone_hash TEXT PRIMARY KEY,sent_at INTEGER NOT NULL);
CREATE TRIGGER replace_otp AFTER INSERT ON otp_challenges BEGIN
 UPDATE otp_challenges SET used=1 WHERE phone=NEW.phone AND id!=NEW.id;
END;
