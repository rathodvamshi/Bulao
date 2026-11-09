-- Keep cancellation metadata and seeker notifications complete whether a job
-- is cancelled or archived, including writes made outside the API route.
DROP TRIGGER IF EXISTS job_cancel_interactions;

CREATE TRIGGER job_cancel_interactions
AFTER UPDATE OF status ON jobs
WHEN NEW.status IN ('CANCELLED', 'DELETED') AND OLD.status NOT IN ('CANCELLED', 'DELETED')
BEGIN
  INSERT INTO notifications(id, user_id, type, title, message, data, read, created_at)
  SELECT lower(hex(randomblob(16))), i.worker_id,
      'APPLICATION_CANCELLED_BY_PROVIDER', 'Application cancelled',
      'The provider closed "' || COALESCE(NULLIF(NEW.title, ''), 'the job') || '". Your application has been cancelled.',
      json_object('interactionId', i.id, 'jobId', NEW.id, 'recipientRole', 'seeker'),
      0, unixepoch()
  FROM interactions i
  WHERE i.job_id = NEW.id AND i.kind = 'job'
    AND i.status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS');

  UPDATE interactions
  SET status = 'CANCELLED',
      cancelled_by = NEW.owner_id,
      cancellation_reason = 'Job closed by employer',
      cancelled_at = unixepoch()
  WHERE job_id = NEW.id
    AND kind = 'job'
    AND status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS');
END;
