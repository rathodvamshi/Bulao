ALTER TABLE interactions ADD COLUMN cancelled_by TEXT REFERENCES users(id);
ALTER TABLE interactions ADD COLUMN cancellation_reason TEXT;
ALTER TABLE interactions ADD COLUMN cancelled_at INTEGER;
ALTER TABLE interactions ADD COLUMN accepted_at INTEGER;
ALTER TABLE interactions ADD COLUMN rejected_at INTEGER;

DROP TRIGGER IF EXISTS interaction_transition;
CREATE TRIGGER interaction_transition BEFORE UPDATE ON interactions BEGIN
 SELECT (CASE WHEN NEW.owner_id!=OLD.owner_id OR NEW.worker_id!=OLD.worker_id OR NEW.kind!=OLD.kind OR NEW.job_id IS NOT OLD.job_id OR NEW.service_id IS NOT OLD.service_id THEN RAISE(ABORT,'IMMUTABLE_PARTICIPANTS') END);
 SELECT (CASE WHEN NOT (
 (OLD.status='PENDING' AND NEW.status IN ('ACCEPTED','REJECTED','WITHDRAWN','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER')) OR
 (OLD.status='REJECTED' AND NEW.status='ACCEPTED') OR
 (OLD.status='ACCEPTED' AND NEW.status IN ('IN_PROGRESS','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER')) OR
 (OLD.status='IN_PROGRESS' AND NEW.status IN ('IN_PROGRESS','COMPLETED','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER'))
 ) THEN RAISE(ABORT,'INVALID_TRANSITION') END);
 SELECT (CASE WHEN (OLD.owner_confirmed_at IS NOT NULL AND NEW.owner_confirmed_at IS NOT OLD.owner_confirmed_at) OR (OLD.worker_confirmed_at IS NOT NULL AND NEW.worker_confirmed_at IS NOT OLD.worker_confirmed_at) THEN RAISE(ABORT,'IMMUTABLE_CONFIRMATION') END);
  SELECT (CASE WHEN NEW.status='COMPLETED' AND (NEW.owner_confirmed_at IS NULL OR NEW.worker_confirmed_at IS NULL) THEN RAISE(ABORT,'COMPLETION_REQUIRED') END);
  SELECT (CASE WHEN NEW.status='ACCEPTED' AND OLD.status!='ACCEPTED' AND NEW.kind='job' AND (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.job_id AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) >= (SELECT workers FROM jobs WHERE id=NEW.job_id) THEN RAISE(ABORT,'JOB_CAPACITY') END);
END;

DROP TRIGGER IF EXISTS interaction_validate;
CREATE TRIGGER interaction_validate BEFORE INSERT ON interactions BEGIN
 SELECT (CASE WHEN NEW.kind='job' AND NOT EXISTS(SELECT 1 FROM jobs WHERE id=NEW.job_id AND owner_id=NEW.owner_id AND status='PUBLISHED' AND (duration='ongoing' OR (ends_at IS NOT NULL AND ends_at>=unixepoch()-86400*7) OR starts_at>=unixepoch()-86400*30)) THEN RAISE(ABORT,'JOB_UNAVAILABLE') END);
 SELECT (CASE WHEN NEW.kind='service' AND NOT EXISTS(SELECT 1 FROM service_profiles WHERE id=NEW.service_id AND user_id=NEW.owner_id AND available=1) THEN RAISE(ABORT,'SERVICE_UNAVAILABLE') END);
END;

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read, created_at DESC);
