CREATE TRIGGER job_interaction_status AFTER UPDATE OF status ON interactions WHEN NEW.kind='job' BEGIN
 UPDATE jobs SET status = (CASE
  WHEN (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.job_id AND status='COMPLETED')>=workers THEN 'COMPLETED'
  WHEN (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.job_id AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED'))>=workers THEN 'FILLED'
  ELSE 'PUBLISHED' END)
 WHERE id=NEW.job_id AND status IN ('PUBLISHED','FILLED');
END;
CREATE TRIGGER job_cancel_interactions AFTER UPDATE OF status ON jobs WHEN NEW.status='CANCELLED' BEGIN
 UPDATE interactions SET status='CANCELLED' WHERE job_id=NEW.id AND status IN ('PENDING','ACCEPTED','IN_PROGRESS');
END;
