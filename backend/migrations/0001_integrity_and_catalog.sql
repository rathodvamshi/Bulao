CREATE TABLE otp_challenges(id TEXT PRIMARY KEY, phone TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0);
CREATE INDEX otp_expiry ON otp_challenges(expires_at);
CREATE TABLE rate_limits(key TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(key,bucket));
CREATE TABLE provider_usage(provider TEXT NOT NULL,service TEXT NOT NULL,period TEXT NOT NULL,request_count INTEGER NOT NULL DEFAULT 0,success_count INTEGER NOT NULL DEFAULT 0,failure_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(provider,service,period));
CREATE INDEX session_expiry ON sessions(expires_at);
CREATE UNIQUE INDEX active_service_request ON interactions(service_id,worker_id) WHERE kind='service' AND status IN ('PENDING','ACCEPTED','IN_PROGRESS');

CREATE TRIGGER job_validate BEFORE INSERT ON jobs BEGIN
 SELECT (CASE WHEN NEW.workers NOT BETWEEN 1 AND 100 OR NEW.pay_paise NOT BETWEEN 100 AND 100000000 OR NEW.pay_unit NOT IN ('hour','day','job','month') OR NEW.latitude NOT BETWEEN -90 AND 90 OR NEW.longitude NOT BETWEEN -180 AND 180 THEN RAISE(ABORT,'INVALID_JOB') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM roles r JOIN categories c ON c.id=r.category_id WHERE r.id=NEW.role_id AND r.category_id=NEW.category_id AND c.kind='job') THEN RAISE(ABORT,'INVALID_ROLE') END);
END;
CREATE TRIGGER service_validate BEFORE INSERT ON service_profiles BEGIN
 SELECT (CASE WHEN NEW.radius_km NOT BETWEEN 1 AND 50 OR NEW.experience NOT BETWEEN 0 AND 70 OR NEW.latitude NOT BETWEEN -90 AND 90 OR NEW.longitude NOT BETWEEN -180 AND 180 OR NEW.available NOT IN (0,1) THEN RAISE(ABORT,'INVALID_SERVICE') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM categories WHERE id=NEW.category_id AND kind='service') THEN RAISE(ABORT,'INVALID_CATEGORY') END);
END;
CREATE TRIGGER interaction_validate BEFORE INSERT ON interactions BEGIN
 SELECT (CASE WHEN NEW.owner_id=NEW.worker_id OR NEW.status!='PENDING' OR NEW.owner_confirmed_at IS NOT NULL OR NEW.worker_confirmed_at IS NOT NULL THEN RAISE(ABORT,'INVALID_INTERACTION') END);
 SELECT (CASE WHEN NEW.kind NOT IN ('job','service') OR (NEW.kind='job' AND (NEW.job_id IS NULL OR NEW.service_id IS NOT NULL)) OR (NEW.kind='service' AND (NEW.service_id IS NULL OR NEW.job_id IS NOT NULL)) THEN RAISE(ABORT,'INVALID_INTERACTION') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM blocks WHERE (user_id=NEW.owner_id AND target_id=NEW.worker_id) OR (user_id=NEW.worker_id AND target_id=NEW.owner_id)) THEN RAISE(ABORT,'BLOCKED_INTERACTION') END);
 SELECT (CASE WHEN NEW.kind='job' AND NOT EXISTS(SELECT 1 FROM jobs WHERE id=NEW.job_id AND owner_id=NEW.owner_id AND status='PUBLISHED' AND starts_at>unixepoch()) THEN RAISE(ABORT,'JOB_UNAVAILABLE') END);
 SELECT (CASE WHEN NEW.kind='service' AND NOT EXISTS(SELECT 1 FROM service_profiles WHERE id=NEW.service_id AND user_id=NEW.owner_id AND available=1) THEN RAISE(ABORT,'SERVICE_UNAVAILABLE') END);
END;
CREATE TRIGGER interaction_transition BEFORE UPDATE ON interactions BEGIN
 SELECT (CASE WHEN NEW.owner_id!=OLD.owner_id OR NEW.worker_id!=OLD.worker_id OR NEW.kind!=OLD.kind OR NEW.job_id IS NOT OLD.job_id OR NEW.service_id IS NOT OLD.service_id THEN RAISE(ABORT,'IMMUTABLE_PARTICIPANTS') END);
 SELECT (CASE WHEN NOT (
 (OLD.status='PENDING' AND NEW.status IN ('ACCEPTED','REJECTED','WITHDRAWN','CANCELLED')) OR
 (OLD.status='ACCEPTED' AND NEW.status IN ('IN_PROGRESS','CANCELLED')) OR
 (OLD.status='IN_PROGRESS' AND NEW.status IN ('IN_PROGRESS','COMPLETED','CANCELLED'))
 ) THEN RAISE(ABORT,'INVALID_TRANSITION') END);
 SELECT (CASE WHEN (OLD.owner_confirmed_at IS NOT NULL AND NEW.owner_confirmed_at IS NOT OLD.owner_confirmed_at) OR (OLD.worker_confirmed_at IS NOT NULL AND NEW.worker_confirmed_at IS NOT OLD.worker_confirmed_at) THEN RAISE(ABORT,'IMMUTABLE_CONFIRMATION') END);
 SELECT (CASE WHEN NEW.status='COMPLETED' AND (NEW.owner_confirmed_at IS NULL OR NEW.worker_confirmed_at IS NULL) THEN RAISE(ABORT,'COMPLETION_REQUIRED') END);
 SELECT (CASE WHEN NEW.status='ACCEPTED' AND NEW.kind='job' AND (SELECT COUNT(*) FROM interactions WHERE job_id=NEW.job_id AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED')) >= (SELECT workers FROM jobs WHERE id=NEW.job_id) THEN RAISE(ABORT,'JOB_CAPACITY') END);
END;
CREATE TRIGGER review_validate BEFORE INSERT ON reviews BEGIN
 SELECT (CASE WHEN NEW.stars NOT BETWEEN 1 AND 5 OR NEW.author_id=NEW.target_id THEN RAISE(ABORT,'INVALID_REVIEW') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM interactions WHERE id=NEW.interaction_id AND status='COMPLETED' AND owner_confirmed_at IS NOT NULL AND worker_confirmed_at IS NOT NULL AND ((owner_id=NEW.author_id AND worker_id=NEW.target_id) OR (worker_id=NEW.author_id AND owner_id=NEW.target_id))) THEN RAISE(ABORT,'REVIEW_NOT_ALLOWED') END);
END;
INSERT INTO categories(id,kind,name,icon) VALUES
 ('events','job','Event & Function Workers','calendar'),
 ('shops','job','Shop & Business Helpers','storefront'),
 ('household','job','Household & Personal Services','home'),
 ('promotion','job','Promotional & Temporary Workers','megaphone'),
 ('food','job','Food & Hospitality','restaurant'),
 ('plumber','service','Plumber','water'),('electrician','service','Electrician','flash'),
 ('mechanic','service','Mechanic','build'),('carpenter','service','Carpenter','hammer'),
 ('driver','service','Driver','car'),('ac','service','AC Technician','snow'),
 ('appliance','service','Appliance Repair','construct'),('painter','service','Painter','color-palette'),
 ('cleaner','service','Cleaner','sparkles'),('gardener','service','Gardener','leaf'),('other','service','Other local technicians','build');
INSERT INTO roles(id,category_id,name) VALUES
 ('event-helper','events','Event Helper'),('event-server','events','Event Server'),
 ('shop-helper','shops','Shop Helper'),('sales-assistant','shops','Sales Assistant'),
 ('housekeeper','household','Housekeeper'),('personal-driver','household','Personal Driver'),
 ('promoter','promotion','Promoter'),('temp-helper','promotion','Temporary Helper'),
 ('restaurant','food','Restaurant & Café Staff'),('kitchen-helper','food','Kitchen Staff'),
 ('bakery','food','Bakery & Sweets Staff'),('barista','food','Café & Beverage Staff'),
 ('catering','food','Catering & Event Staff'),('hotel','food','Hotel Food & Service Staff'),
 ('packing','food','Food Packing & Kitchen Support'),('kitchen-cleaner','food','Food Business Cleaning & Support');
INSERT INTO locations(id,area,latitude,longitude) VALUES
 ('kukatpally','Kukatpally, Hyderabad',17.4948,78.3996),
 ('madhapur','Madhapur, Hyderabad',17.4483,78.3915),
 ('gachibowli','Gachibowli, Hyderabad',17.4401,78.3489),
 ('ameerpet','Ameerpet, Hyderabad',17.4375,78.4483),
 ('secunderabad','Secunderabad',17.4399,78.4983),
 ('hyderabad','Hyderabad',17.3850,78.4867);
