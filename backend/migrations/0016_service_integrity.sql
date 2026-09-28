-- Additive migration: preserves listings, reviews, requests and all historical values.
ALTER TABLE service_profiles ADD COLUMN archived_at INTEGER;
ALTER TABLE service_profiles ADD COLUMN created_at INTEGER;
ALTER TABLE service_profiles ADD COLUMN updated_at INTEGER;
DROP INDEX IF EXISTS service_user_category;
CREATE INDEX service_user_category ON service_profiles(user_id, category_id);
CREATE UNIQUE INDEX IF NOT EXISTS active_service_request ON interactions(service_id,worker_id)
 WHERE kind='service' AND status IN ('PENDING','ACCEPTED','IN_PROGRESS');
CREATE INDEX IF NOT EXISTS interaction_service_status ON interactions(service_id,status);

-- A booking may be unscheduled; coordinates must always be supplied by the seeker.
DROP TRIGGER IF EXISTS request_location;
CREATE TRIGGER request_location BEFORE INSERT ON interactions WHEN NEW.kind='service' BEGIN
 SELECT CASE WHEN NEW.area IS NULL OR length(trim(NEW.area))<2 OR NEW.latitude IS NULL OR NEW.longitude IS NULL
 OR NEW.latitude NOT BETWEEN -90 AND 90 OR NEW.longitude NOT BETWEEN -180 AND 180
 THEN RAISE(ABORT,'REQUEST_LOCATION_REQUIRED') END;
END;

CREATE TABLE service_review_reports (
 id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES users(id),
 review_id TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL
);

-- Service-only guards supplement the shared job/service triggers.
CREATE TRIGGER service_request_integrity BEFORE INSERT ON interactions WHEN NEW.kind='service' BEGIN
 SELECT CASE WHEN NEW.owner_id=NEW.worker_id OR NEW.job_id IS NOT NULL OR NEW.status!='PENDING'
 OR NEW.owner_confirmed_at IS NOT NULL OR NEW.worker_confirmed_at IS NOT NULL
 THEN RAISE(ABORT,'INVALID_INTERACTION') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM service_profiles s JOIN users u ON u.id=s.user_id
 WHERE s.id=NEW.service_id AND s.user_id=NEW.owner_id AND s.available=1 AND s.archived_at IS NULL AND u.suspended=0)
 THEN RAISE(ABORT,'SERVICE_UNAVAILABLE') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM blocks WHERE
 (user_id=NEW.owner_id AND target_id=NEW.worker_id) OR (user_id=NEW.worker_id AND target_id=NEW.owner_id))
 THEN RAISE(ABORT,'BLOCKED_INTERACTION') END;
END;
CREATE TRIGGER service_request_transition BEFORE UPDATE ON interactions WHEN NEW.kind='service' BEGIN
 SELECT CASE WHEN OLD.status='REJECTED' THEN RAISE(ABORT,'INVALID_TRANSITION') END;
 SELECT CASE WHEN NEW.status IN ('ACCEPTED','IN_PROGRESS') AND OLD.status!=NEW.status AND
 (NOT EXISTS(SELECT 1 FROM service_profiles s JOIN users u ON u.id=s.user_id WHERE s.id=NEW.service_id
 AND s.available=1 AND s.archived_at IS NULL AND u.suspended=0)
 OR EXISTS(SELECT 1 FROM blocks WHERE (user_id=NEW.owner_id AND target_id=NEW.worker_id)
 OR (user_id=NEW.worker_id AND target_id=NEW.owner_id))) THEN RAISE(ABORT,'SERVICE_UNAVAILABLE') END;
END;
CREATE TRIGGER service_update_validate BEFORE UPDATE ON service_profiles BEGIN
 SELECT CASE WHEN NEW.radius_km NOT BETWEEN 1 AND 50 OR NEW.experience NOT BETWEEN 0 AND 70
 OR NEW.latitude NOT BETWEEN -90 AND 90 OR NEW.longitude NOT BETWEEN -180 AND 180
 OR NEW.available NOT IN (0,1) OR NEW.phone_visible NOT IN (0,1)
 OR NOT EXISTS(SELECT 1 FROM categories WHERE id=NEW.category_id AND kind='service')
 THEN RAISE(ABORT,'INVALID_SERVICE') END;
 SELECT CASE WHEN OLD.archived_at IS NOT NULL AND (NEW.archived_at IS NULL OR NEW.available=1)
 THEN RAISE(ABORT,'SERVICE_ARCHIVED') END;
 SELECT CASE WHEN NEW.archived_at IS NOT NULL AND EXISTS(SELECT 1 FROM interactions
 WHERE service_id=NEW.id AND status IN ('PENDING','ACCEPTED','IN_PROGRESS')) THEN RAISE(ABORT,'SERVICE_HAS_ACTIVE_REQUESTS') END;
END;

CREATE TRIGGER service_rating_insert BEFORE INSERT ON service_ratings BEGIN
 SELECT CASE WHEN NEW.stars NOT BETWEEN 1 AND 5 OR NEW.stars!=CAST(NEW.stars AS INTEGER)
 OR NOT EXISTS(SELECT 1 FROM interactions WHERE service_id=NEW.service_id AND worker_id=NEW.customer_id
 AND owner_id=NEW.provider_id AND status='COMPLETED') THEN RAISE(ABORT,'RATING_NOT_ALLOWED') END;
END;
CREATE TRIGGER service_rating_update BEFORE UPDATE ON service_ratings BEGIN
 SELECT CASE WHEN NEW.stars NOT BETWEEN 1 AND 5 OR NEW.stars!=CAST(NEW.stars AS INTEGER)
 OR NEW.service_id!=OLD.service_id OR NEW.customer_id!=OLD.customer_id OR NEW.provider_id!=OLD.provider_id
 THEN RAISE(ABORT,'RATING_NOT_ALLOWED') END;
END;

-- Notifications commit with the request change; failures roll back the change.
CREATE TRIGGER service_request_created AFTER INSERT ON interactions WHEN NEW.kind='service' BEGIN
 INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.owner_id,'SERVICE_REQUEST','New service request',
 'A customer requested your service.',json_object('interactionId',NEW.id,'serviceId',NEW.service_id,'recipientRole','provider'),0,unixepoch());
END;
CREATE TRIGGER service_request_changed AFTER UPDATE OF status ON interactions
 WHEN NEW.kind='service' AND NEW.status!=OLD.status BEGIN
 INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.worker_id,'SERVICE_REQUEST_UPDATED','Service request updated',
 'Request status: ' || NEW.status,json_object('interactionId',NEW.id,'serviceId',NEW.service_id,'recipientRole','seeker'),0,unixepoch());
 INSERT INTO notifications(id,user_id,type,title,message,data,read,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.owner_id,'SERVICE_REQUEST_UPDATED','Service request updated',
 'Request status: ' || NEW.status,json_object('interactionId',NEW.id,'serviceId',NEW.service_id,'recipientRole','provider'),0,unixepoch());
END;
