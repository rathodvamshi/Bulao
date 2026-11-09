-- Durable Android push pipeline. Inbox rows remain the source of truth.
CREATE TABLE IF NOT EXISTS push_devices (
  installation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform = 'android'),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_devices_user_active_idx
  ON push_devices(user_id, active);
CREATE TRIGGER IF NOT EXISTS push_devices_active_limit
BEFORE INSERT ON push_devices
WHEN (SELECT COUNT(*) FROM push_devices
       WHERE user_id=NEW.user_id AND active=1 AND installation_id<>NEW.installation_id) >= 10
BEGIN
  SELECT RAISE(ABORT,'PUSH_DEVICE_LIMIT');
END;

CREATE TABLE IF NOT EXISTS notification_push_outbox (
  notification_id TEXT PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'expanded')),
  created_at INTEGER NOT NULL,
  expanded_at INTEGER
);
CREATE INDEX IF NOT EXISTS notification_push_outbox_pending_idx
  ON notification_push_outbox(state, created_at);

CREATE TABLE IF NOT EXISTS push_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL REFERENCES push_devices(installation_id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (
    state IN ('pending', 'queued', 'sending', 'receipt_pending', 'accepted', 'failed', 'disabled')
  ),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  lease_until INTEGER,
  expo_ticket_id TEXT,
  receipt_checked_at INTEGER,
  last_error_code TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS push_delivery_notification_device_idx
  ON push_deliveries(notification_id, installation_id);
CREATE INDEX IF NOT EXISTS push_deliveries_dispatch_idx
  ON push_deliveries(state, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS push_deliveries_receipt_idx
  ON push_deliveries(state, receipt_checked_at);

-- This trigger covers notifications written by both application code and SQL triggers.
CREATE TRIGGER IF NOT EXISTS notifications_push_outbox
AFTER INSERT ON notifications
BEGIN
  INSERT OR IGNORE INTO notification_push_outbox(notification_id, state, created_at)
  VALUES (NEW.id, 'pending', NEW.created_at);
END;

-- Keep event creation in the same D1 transaction as the business change. The
-- outbox trigger above then atomically records its push obligation as well.
CREATE TRIGGER IF NOT EXISTS job_application_notification
AFTER INSERT ON interactions
WHEN NEW.kind='job'
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  VALUES(
    lower(hex(randomblob(16))),NEW.owner_id,'APPLICATION_CREATED','New Job Application',
    COALESCE((SELECT NULLIF(name,'') FROM users WHERE id=NEW.worker_id),'A seeker') || ' applied for "' ||
      COALESCE((SELECT NULLIF(title,'') FROM jobs WHERE id=NEW.job_id),'your job posting') || '".',
    json_object('interactionId',NEW.id,'jobId',NEW.job_id,'workerId',NEW.worker_id,'recipientRole','provider'),
    0,unixepoch()
  );
END;

CREATE TRIGGER IF NOT EXISTS job_application_accepted_notification
AFTER UPDATE OF status ON interactions
WHEN NEW.kind='job' AND OLD.status IS NOT NEW.status AND NEW.status='ACCEPTED'
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  VALUES(lower(hex(randomblob(16))),NEW.worker_id,'APPLICATION_ACCEPTED','Application Accepted!',
    'Your application was accepted. Open Bulao to review the work details.',
    json_object('interactionId',NEW.id,'jobId',NEW.job_id,'recipientRole','seeker'),0,unixepoch());
END;

CREATE TRIGGER IF NOT EXISTS job_application_rejected_notification
AFTER UPDATE OF status ON interactions
WHEN NEW.kind='job' AND OLD.status IS NOT NEW.status AND NEW.status='REJECTED'
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  VALUES(lower(hex(randomblob(16))),NEW.worker_id,'APPLICATION_REJECTED','Application Update',
    'Your application was not accepted. Open Bulao to view the latest status.',
    json_object('interactionId',NEW.id,'jobId',NEW.job_id,'recipientRole','seeker'),0,unixepoch());
END;

CREATE TRIGGER IF NOT EXISTS job_application_cancelled_by_seeker_notification
AFTER UPDATE OF status ON interactions
WHEN NEW.kind='job' AND OLD.status IS NOT NEW.status AND NEW.status='CANCELLED_BY_SEEKER'
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  VALUES(lower(hex(randomblob(16))),NEW.owner_id,'APPLICATION_CANCELLED_BY_SEEKER','Application cancelled',
    'A seeker cancelled their application. Open Bulao to view the latest status.',
    json_object('interactionId',NEW.id,'jobId',NEW.job_id,'recipientRole','provider'),0,unixepoch());
END;

CREATE TRIGGER IF NOT EXISTS job_application_cancelled_by_provider_notification
AFTER UPDATE OF status ON interactions
WHEN NEW.kind='job' AND OLD.status IS NOT NEW.status AND NEW.status='CANCELLED_BY_PROVIDER'
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  VALUES(lower(hex(randomblob(16))),NEW.worker_id,'APPLICATION_CANCELLED_BY_PROVIDER','Application cancelled',
    'The provider cancelled this application. Open Bulao to view the latest status.',
    json_object('interactionId',NEW.id,'jobId',NEW.job_id,'recipientRole','seeker'),0,unixepoch());
END;

CREATE TRIGGER IF NOT EXISTS job_worksite_updated_notifications
AFTER UPDATE OF area,address,latitude,longitude ON jobs
WHEN OLD.area IS NOT NEW.area OR OLD.address IS NOT NEW.address OR
     OLD.latitude IS NOT NEW.latitude OR OLD.longitude IS NOT NEW.longitude
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  SELECT lower(hex(randomblob(16))),i.worker_id,'JOB_LOCATION_UPDATED','Worksite location updated',
         'The provider updated the worksite. Open Bulao to review the new details.',
         json_object('jobId',NEW.id,'interactionId',i.id,'recipientRole','seeker'),0,unixepoch()
    FROM interactions i
   WHERE i.job_id=NEW.id AND i.kind='job' AND i.status IN ('ACCEPTED','IN_PROGRESS');
END;

CREATE TRIGGER IF NOT EXISTS review_received_notification
AFTER INSERT ON reviews
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  SELECT lower(hex(randomblob(16))),NEW.target_id,'REVIEW_RECEIVED','New rating received',
         'A participant left you a rating. Open Bulao to view it.',
         json_object('interactionId',NEW.interaction_id,
           'recipientRole',CASE WHEN i.owner_id=NEW.target_id THEN 'provider' ELSE 'seeker' END),
         0,unixepoch()
    FROM interactions i WHERE i.id=NEW.interaction_id;
END;

CREATE TRIGGER IF NOT EXISTS service_review_received_notification
AFTER INSERT ON service_ratings
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  VALUES(lower(hex(randomblob(16))),NEW.provider_id,'SERVICE_REVIEW_RECEIVED','New service rating',
    'A customer left a rating for your service. Open Bulao to view it.',
    json_object('serviceId',NEW.service_id,'ratingId',NEW.id,'recipientRole','provider'),0,unixepoch());
END;

CREATE TRIGGER IF NOT EXISTS service_offline_payment_provider_update_notification
AFTER UPDATE OF provider_confirmed_at ON service_offline_payments
WHEN NEW.provider_confirmed_at IS NOT OLD.provider_confirmed_at
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  SELECT lower(hex(randomblob(16))),i.worker_id,
         CASE WHEN NEW.provider_confirmed_at IS NULL THEN 'SERVICE_OFFLINE_PAYMENT_UNDONE'
              WHEN NEW.customer_confirmed_at IS NOT NULL THEN 'SERVICE_OFFLINE_PAYMENT_CONFIRMED'
              ELSE 'SERVICE_OFFLINE_PAYMENT_UPDATED' END,
         'Offline payment update','The provider updated their offline payment confirmation. Open Bulao to review it.',
         json_object('interactionId',i.id,'recipientRole','seeker'),0,unixepoch()
    FROM interactions i WHERE i.id=NEW.interaction_id;
END;

CREATE TRIGGER IF NOT EXISTS service_offline_payment_customer_update_notification
AFTER UPDATE OF customer_confirmed_at ON service_offline_payments
WHEN NEW.customer_confirmed_at IS NOT OLD.customer_confirmed_at
BEGIN
  INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
  SELECT lower(hex(randomblob(16))),i.owner_id,
         CASE WHEN NEW.customer_confirmed_at IS NULL THEN 'SERVICE_OFFLINE_PAYMENT_UNDONE'
              WHEN NEW.provider_confirmed_at IS NOT NULL THEN 'SERVICE_OFFLINE_PAYMENT_CONFIRMED'
              ELSE 'SERVICE_OFFLINE_PAYMENT_UPDATED' END,
         'Offline payment update','The customer updated their offline payment confirmation. Open Bulao to review it.',
         json_object('interactionId',i.id,'recipientRole','provider'),0,unixepoch()
    FROM interactions i WHERE i.id=NEW.interaction_id;
END;
