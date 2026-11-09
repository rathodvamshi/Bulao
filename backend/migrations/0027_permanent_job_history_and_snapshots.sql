-- Migration 0027: Permanent Job History, Soft Delete Retention, and Snapshots

-- 1. Fix interaction transition trigger so non-status metadata updates are permitted
DROP TRIGGER IF EXISTS interaction_transition;
CREATE TRIGGER interaction_transition BEFORE UPDATE ON interactions BEGIN
 SELECT (CASE WHEN NEW.owner_id!=OLD.owner_id OR NEW.worker_id!=OLD.worker_id OR NEW.kind!=OLD.kind OR NEW.job_id IS NOT OLD.job_id OR NEW.service_id IS NOT OLD.service_id THEN RAISE(ABORT,'IMMUTABLE_PARTICIPANTS') END);
 SELECT (CASE WHEN OLD.status != NEW.status AND NOT (
 (OLD.status='PENDING' AND NEW.status IN ('ACCEPTED','REJECTED','WITHDRAWN','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER')) OR
 (OLD.status='REJECTED' AND NEW.status='ACCEPTED') OR
 (OLD.status='ACCEPTED' AND NEW.status IN ('IN_PROGRESS','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER')) OR
 (OLD.status='IN_PROGRESS' AND NEW.status IN ('IN_PROGRESS','COMPLETED','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER'))
 ) THEN RAISE(ABORT,'INVALID_TRANSITION') END);
 SELECT (CASE WHEN (OLD.owner_confirmed_at IS NOT NULL AND NEW.owner_confirmed_at IS NOT OLD.owner_confirmed_at) OR (OLD.worker_confirmed_at IS NOT NULL AND NEW.worker_confirmed_at IS NOT OLD.worker_confirmed_at) THEN RAISE(ABORT,'IMMUTABLE_CONFIRMATION') END);
  SELECT (CASE WHEN NEW.status='COMPLETED' AND (NEW.owner_confirmed_at IS NULL OR NEW.worker_confirmed_at IS NULL) THEN RAISE(ABORT,'COMPLETION_REQUIRED') END);
  SELECT (CASE WHEN NEW.status='ACCEPTED' AND OLD.status!='ACCEPTED' AND NEW.kind='job' AND (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.job_id AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) >= (SELECT workers FROM jobs WHERE id=NEW.job_id) THEN RAISE(ABORT,'JOB_CAPACITY') END);
END;

-- 2. Add soft-delete and retention columns to jobs
ALTER TABLE jobs ADD COLUMN archived_at INTEGER;
ALTER TABLE jobs ADD COLUMN deleted_at INTEGER;

-- 3. Add immutable snapshot columns to interactions
ALTER TABLE interactions ADD COLUMN job_title_snapshot TEXT;
ALTER TABLE interactions ADD COLUMN role_name_snapshot TEXT;
ALTER TABLE interactions ADD COLUMN pay_paise_snapshot INTEGER;
ALTER TABLE interactions ADD COLUMN pay_unit_snapshot TEXT;

-- 4. Backfill snapshots for existing job interactions
UPDATE interactions
SET job_title_snapshot = (
  SELECT COALESCE(NULLIF(j.title, ''), r.name, 'Work Opportunity')
  FROM jobs j
  LEFT JOIN roles r ON r.id = j.role_id
  WHERE j.id = interactions.job_id
),
role_name_snapshot = (
  SELECT COALESCE(r.name, 'Worker')
  FROM jobs j
  LEFT JOIN roles r ON r.id = j.role_id
  WHERE j.id = interactions.job_id
),
pay_paise_snapshot = (
  SELECT j.pay_paise
  FROM jobs j
  WHERE j.id = interactions.job_id
),
pay_unit_snapshot = (
  SELECT j.pay_unit
  FROM jobs j
  WHERE j.id = interactions.job_id
)
WHERE kind = 'job' AND job_id IS NOT NULL;

-- 5. Backfill lifecycle timestamps for existing interactions
UPDATE interactions
SET accepted_at = created_at
WHERE accepted_at IS NULL AND status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED');

UPDATE interactions
SET rejected_at = created_at
WHERE rejected_at IS NULL AND status = 'REJECTED';

UPDATE interactions
SET cancelled_at = created_at
WHERE cancelled_at IS NULL
  AND status IN ('CANCELLED', 'CANCELLED_BY_SEEKER', 'CANCELLED_BY_PROVIDER', 'WITHDRAWN');
