-- Notify each seeker when the provider records completion, and prompt both
-- participants to review only after the interaction is truly completed.
CREATE TRIGGER IF NOT EXISTS job_provider_completion_prompt
AFTER UPDATE OF owner_confirmed_at ON interactions
WHEN NEW.kind='job'
  AND OLD.owner_confirmed_at IS NULL
  AND NEW.owner_confirmed_at IS NOT NULL
  AND NEW.status='IN_PROGRESS'
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  VALUES(
    lower(hex(randomblob(16))),
    NEW.worker_id,
    'JOB_COMPLETION_CONFIRMATION',
    'Confirm completed work',
    'The provider marked "' || COALESCE((SELECT NULLIF(title,'') FROM jobs WHERE id=NEW.job_id),'your job') || '" complete. Open your request to confirm the work.',
    json_object('interactionId',NEW.id,'jobId',NEW.job_id,'recipientRole','seeker'),
    0,
    unixepoch()
  );
END;

CREATE TRIGGER IF NOT EXISTS job_completed_review_prompts
AFTER UPDATE OF status ON interactions
WHEN NEW.kind='job' AND OLD.status!='COMPLETED' AND NEW.status='COMPLETED'
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  VALUES(
    lower(hex(randomblob(16))),
    NEW.worker_id,
    'JOB_COMPLETED',
    'Job completed — share your feedback',
    '"' || COALESCE((SELECT NULLIF(title,'') FROM jobs WHERE id=NEW.job_id),'Your job') || '" was marked completed. Please rate your experience!',
    json_object('interactionId',NEW.id,'jobId',NEW.job_id,'recipientRole','seeker'),
    0,
    unixepoch()
  );
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  VALUES(
    lower(hex(randomblob(16))),
    NEW.owner_id,
    'JOB_COMPLETED',
    'Job completed — share your feedback',
    '"' || COALESCE((SELECT NULLIF(title,'') FROM jobs WHERE id=NEW.job_id),'Your job') || '" was marked completed. Please rate your experience!',
    json_object('interactionId',NEW.id,'jobId',NEW.job_id,'recipientRole','provider'),
    0,
    unixepoch()
  );
END;
