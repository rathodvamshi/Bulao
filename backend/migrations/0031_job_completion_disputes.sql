-- Keep rejected completion requests in the existing interaction workflow.
ALTER TABLE interactions ADD COLUMN completion_rejected_at INTEGER;
ALTER TABLE interactions ADD COLUMN completion_rejected_by TEXT REFERENCES users(id);
ALTER TABLE interactions ADD COLUMN completion_rejection_reason TEXT;

DROP TRIGGER IF EXISTS interaction_transition;
CREATE TRIGGER interaction_transition BEFORE UPDATE ON interactions BEGIN
 SELECT CASE WHEN NEW.owner_id!=OLD.owner_id OR NEW.worker_id!=OLD.worker_id OR NEW.kind!=OLD.kind OR NEW.job_id IS NOT OLD.job_id OR NEW.service_id IS NOT OLD.service_id THEN RAISE(ABORT,'IMMUTABLE_PARTICIPANTS') END;
 SELECT CASE WHEN OLD.status != NEW.status AND NOT (
   (OLD.status='PENDING' AND NEW.status IN ('ACCEPTED','REJECTED','WITHDRAWN','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER')) OR
   (OLD.status='REJECTED' AND NEW.status='ACCEPTED') OR
   (OLD.status='ACCEPTED' AND NEW.status IN ('IN_PROGRESS','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER')) OR
   (OLD.status='IN_PROGRESS' AND NEW.status IN ('IN_PROGRESS','COMPLETED','CANCELLED','CANCELLED_BY_SEEKER','CANCELLED_BY_PROVIDER'))
 ) THEN RAISE(ABORT,'INVALID_TRANSITION') END;
 SELECT CASE WHEN
   (OLD.owner_confirmed_at IS NOT NULL AND NEW.owner_confirmed_at IS NOT OLD.owner_confirmed_at AND NOT (NEW.owner_confirmed_at IS NULL AND OLD.completion_rejected_at IS NULL AND NEW.completion_rejected_at IS NOT NULL)) OR
   (OLD.worker_confirmed_at IS NOT NULL AND NEW.worker_confirmed_at IS NOT OLD.worker_confirmed_at AND NOT (NEW.worker_confirmed_at IS NULL AND OLD.completion_rejected_at IS NULL AND NEW.completion_rejected_at IS NOT NULL))
   THEN RAISE(ABORT,'IMMUTABLE_CONFIRMATION') END;
 SELECT CASE WHEN NEW.status='COMPLETED' AND (NEW.owner_confirmed_at IS NULL OR NEW.worker_confirmed_at IS NULL OR NEW.completion_rejected_at IS NOT NULL) THEN RAISE(ABORT,'COMPLETION_REQUIRED') END;
 SELECT CASE WHEN NEW.status='ACCEPTED' AND OLD.status!='ACCEPTED' AND NEW.kind='job' AND (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.job_id AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) >= (SELECT workers FROM jobs WHERE id=NEW.job_id) THEN RAISE(ABORT,'JOB_CAPACITY') END;
END;

CREATE INDEX IF NOT EXISTS interactions_completion_dispute_idx
  ON interactions(completion_rejected_at, status, kind);

CREATE TRIGGER IF NOT EXISTS job_completion_rejected_notification
AFTER UPDATE OF completion_rejected_at ON interactions
WHEN NEW.kind='job' AND OLD.completion_rejected_at IS NULL AND NEW.completion_rejected_at IS NOT NULL
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  VALUES(
    lower(hex(randomblob(16))),
    CASE WHEN NEW.completion_rejected_by=NEW.owner_id THEN NEW.worker_id ELSE NEW.owner_id END,
    'JOB_COMPLETION_REJECTED','Completion needs another look',
    COALESCE((SELECT NULLIF(name,'') FROM users WHERE id=NEW.completion_rejected_by),'The other participant') || ' reported that the work is not complete yet.',
    json_object('interactionId',NEW.id,'jobId',NEW.job_id,'recipientRole',CASE WHEN NEW.completion_rejected_by=NEW.owner_id THEN 'seeker' ELSE 'provider' END),
    0,unixepoch()
  );
END;
