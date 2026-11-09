-- Notify the provider when the seeker is the first participant to mark a job complete.
-- The existing provider-first and final-completion prompts remain in 0022.
CREATE TRIGGER IF NOT EXISTS job_worker_completion_prompt
AFTER UPDATE OF worker_confirmed_at ON interactions
WHEN NEW.kind = 'job'
  AND OLD.worker_confirmed_at IS NULL
  AND NEW.worker_confirmed_at IS NOT NULL
  AND NEW.status = 'IN_PROGRESS'
BEGIN
  INSERT INTO notifications(id, user_id, type, title, message, data, read, created_at)
  VALUES(
    lower(hex(randomblob(16))),
    NEW.owner_id,
    'JOB_COMPLETION_CONFIRMATION',
    'Confirm completed work',
    'The seeker marked "' || COALESCE((SELECT NULLIF(title, '') FROM jobs WHERE id = NEW.job_id), 'your job') || '" complete. Open the application to confirm the work.',
    json_object('interactionId', NEW.id, 'jobId', NEW.job_id, 'recipientRole', 'provider'),
    0,
    unixepoch()
  );
END;
