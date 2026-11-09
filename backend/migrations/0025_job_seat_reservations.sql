-- Job capacity is derived from active accepted work, never by mutating jobs.workers.
-- Pending applications do not reserve seats; cancellation releases a seat.

DROP INDEX IF EXISTS application_unique;
CREATE UNIQUE INDEX application_unique ON interactions(job_id, worker_id)
WHERE kind='job' AND status IN ('PENDING','ACCEPTED','IN_PROGRESS','COMPLETED');

DROP TRIGGER IF EXISTS interaction_validate;
CREATE TRIGGER interaction_validate BEFORE INSERT ON interactions BEGIN
  SELECT CASE WHEN NEW.kind='job' AND NOT EXISTS(
    SELECT 1 FROM jobs WHERE id=NEW.job_id AND owner_id=NEW.owner_id AND status='PUBLISHED'
      AND (duration='ongoing' OR (ends_at IS NOT NULL AND ends_at>=unixepoch()-86400*7) OR starts_at>=unixepoch()-86400*30)
      AND (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.job_id AND kind='job' AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) < workers
  ) THEN RAISE(ABORT,'JOB_UNAVAILABLE') END;
  SELECT CASE WHEN NEW.kind='service' AND NOT EXISTS(SELECT 1 FROM service_profiles WHERE id=NEW.service_id AND user_id=NEW.owner_id AND available=1) THEN RAISE(ABORT,'SERVICE_UNAVAILABLE') END;
END;

DROP TRIGGER IF EXISTS interaction_transition;
CREATE TRIGGER interaction_transition BEFORE UPDATE ON interactions BEGIN
  SELECT CASE WHEN NEW.owner_id!=OLD.owner_id OR NEW.worker_id!=OLD.worker_id OR NEW.kind!=OLD.kind OR NEW.job_id IS NOT OLD.job_id OR NEW.service_id IS NOT OLD.service_id THEN RAISE(ABORT,'IMMUTABLE_PARTICIPANTS') END;
  SELECT CASE WHEN NOT (
    (OLD.status='PENDING' AND NEW.status IN ('ACCEPTED','REJECTED','WITHDRAWN','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER')) OR
    (OLD.status='REJECTED' AND NEW.status='ACCEPTED') OR
    (OLD.status='ACCEPTED' AND NEW.status IN ('IN_PROGRESS','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER')) OR
    (OLD.status='IN_PROGRESS' AND NEW.status IN ('IN_PROGRESS','COMPLETED','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER'))
  ) THEN RAISE(ABORT,'INVALID_TRANSITION') END;
  SELECT CASE WHEN (OLD.owner_confirmed_at IS NOT NULL AND NEW.owner_confirmed_at IS NOT OLD.owner_confirmed_at) OR (OLD.worker_confirmed_at IS NOT NULL AND NEW.worker_confirmed_at IS NOT OLD.worker_confirmed_at) THEN RAISE(ABORT,'IMMUTABLE_CONFIRMATION') END;
  SELECT CASE WHEN NEW.status='COMPLETED' AND (NEW.owner_confirmed_at IS NULL OR NEW.worker_confirmed_at IS NULL) THEN RAISE(ABORT,'COMPLETION_REQUIRED') END;
  SELECT CASE WHEN NEW.status='ACCEPTED' AND OLD.status!='ACCEPTED' AND NEW.kind='job' AND NOT EXISTS(
    SELECT 1 FROM jobs WHERE id=NEW.job_id AND status='PUBLISHED'
      AND (duration='ongoing' OR (ends_at IS NOT NULL AND ends_at>=unixepoch()-86400*7) OR starts_at>=unixepoch()-86400*30)
  ) THEN RAISE(ABORT,'JOB_UNAVAILABLE') END;
  SELECT CASE WHEN NEW.status='ACCEPTED' AND OLD.status!='ACCEPTED' AND NEW.kind='job' AND
    (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.job_id AND kind='job' AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) >=
    (SELECT workers FROM jobs WHERE id=NEW.job_id) THEN RAISE(ABORT,'JOB_CAPACITY') END;
END;

DROP TRIGGER IF EXISTS job_interaction_status;
CREATE TRIGGER job_interaction_status AFTER UPDATE OF status ON interactions
WHEN NEW.kind='job' AND OLD.status IS NOT NEW.status BEGIN
  UPDATE jobs SET status=CASE
    WHEN (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.job_id AND kind='job' AND status='COMPLETED')>=workers THEN 'COMPLETED'
    WHEN (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.job_id AND kind='job' AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED'))>=workers THEN 'FILLED'
    WHEN duration='ongoing' OR (ends_at IS NOT NULL AND ends_at>=unixepoch()-86400*7) OR starts_at>=unixepoch()-86400*30 THEN 'PUBLISHED'
    ELSE 'EXPIRED' END
  WHERE id=NEW.job_id AND status IN ('PUBLISHED','FILLED');
END;

DROP TRIGGER IF EXISTS jobs_workers_range;
CREATE TRIGGER jobs_workers_range BEFORE UPDATE OF workers ON jobs
WHEN NEW.workers NOT BETWEEN 1 AND 100
BEGIN SELECT RAISE(ABORT,'INVALID_JOB'); END;

DROP TRIGGER IF EXISTS jobs_capacity_guard;
CREATE TRIGGER jobs_capacity_guard BEFORE UPDATE OF workers ON jobs
WHEN NEW.workers < (SELECT COUNT(*) FROM interactions WHERE job_id=OLD.id AND kind='job' AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED'))
BEGIN SELECT RAISE(ABORT,'CAPACITY_BELOW_RESERVED'); END;

DROP TRIGGER IF EXISTS jobs_capacity_status;
CREATE TRIGGER jobs_capacity_status AFTER UPDATE OF workers ON jobs
WHEN OLD.workers IS NOT NEW.workers AND OLD.status IN ('PUBLISHED','FILLED') BEGIN
  UPDATE jobs SET status=CASE
    WHEN (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.id AND kind='job' AND status='COMPLETED')>=NEW.workers THEN 'COMPLETED'
    WHEN (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.id AND kind='job' AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED'))>=NEW.workers THEN 'FILLED'
    WHEN NEW.duration='ongoing' OR (NEW.ends_at IS NOT NULL AND NEW.ends_at>=unixepoch()-86400*7) OR NEW.starts_at>=unixepoch()-86400*30 THEN 'PUBLISHED'
    ELSE 'EXPIRED' END
  WHERE id=NEW.id AND status IN ('PUBLISHED','FILLED');
END;

DROP TRIGGER IF EXISTS jobs_schedule_status;
CREATE TRIGGER jobs_schedule_status AFTER UPDATE OF starts_at, duration, ends_at ON jobs
WHEN OLD.status IN ('PUBLISHED','FILLED') BEGIN
  UPDATE jobs SET status=CASE
    WHEN (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.id AND kind='job' AND status='COMPLETED')>=NEW.workers THEN 'COMPLETED'
    WHEN (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.id AND kind='job' AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED'))>=NEW.workers THEN 'FILLED'
    WHEN NEW.duration='ongoing' OR (NEW.ends_at IS NOT NULL AND NEW.ends_at>=unixepoch()-86400*7) OR NEW.starts_at>=unixepoch()-86400*30 THEN 'PUBLISHED'
    ELSE 'EXPIRED' END
  WHERE id=NEW.id AND status IN ('PUBLISHED','FILLED');
END;
