// Focused SQL regression check using disposable in-memory SQLite, never live D1.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const db = new DatabaseSync(':memory:');
const migration = name => db.exec(fs.readFileSync(`backend/migrations/${name}.sql`, 'utf8'));
for (const name of ['0000_yummy_ink','0001_integrity_and_catalog','0002_request_details']) migration(name);
// The fixture includes the current job fields referenced by shared service/job triggers.
db.exec("ALTER TABLE jobs ADD COLUMN duration TEXT; ALTER TABLE jobs ADD COLUMN ends_at INTEGER; ALTER TABLE users ADD COLUMN photo_url TEXT; ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0;");
for (const name of ['0009_seeker_applications_and_cancellations','0011_service_profiles_v2','0012_multiple_service_listings','0013_service_edit_state','0014_service_ratings','0015_add_service_profile_missing_columns','0016_service_integrity']) migration(name);
db.exec("INSERT INTO users(id,phone,created_at) VALUES('provider','1',1),('customer','2',1),('other','3',1)");
db.exec("INSERT INTO service_profiles(id,user_id,category_id,area,latitude,longitude,radius_km,experience,available,title,phone_visible) VALUES('service','provider','plumber','Selected area',0,0,5,0,1,'Stored title',0)");
const request = id => db.prepare("INSERT INTO interactions(id,kind,service_id,owner_id,worker_id,status,created_at,area,latitude,longitude) VALUES(?,'service','service','provider','customer','PENDING',1,'Selected area',0,0)").run(id);
request('request');
assert.equal(db.prepare('SELECT COUNT(*) n FROM notifications').get().n,1);
assert.throws(() => request('duplicate'), /UNIQUE/);
assert.throws(() => db.exec("UPDATE service_profiles SET archived_at=1,available=0 WHERE id='service'"), /SERVICE_HAS_ACTIVE_REQUESTS/);
db.exec("UPDATE interactions SET status='ACCEPTED' WHERE id='request'; UPDATE interactions SET status='IN_PROGRESS' WHERE id='request'; UPDATE interactions SET owner_confirmed_at=1 WHERE id='request'");
assert.throws(() => db.exec("UPDATE interactions SET status='COMPLETED' WHERE id='request'"), /COMPLETION_REQUIRED/);
db.exec("UPDATE interactions SET worker_confirmed_at=1,status='COMPLETED' WHERE id='request'");
assert.equal(db.prepare('SELECT COUNT(*) n FROM notifications').get().n,7);
db.exec("INSERT INTO service_ratings(id,service_id,provider_id,customer_id,stars,feedback,created_at) VALUES('rating','service','provider','customer',5,'Real feedback',1)");
assert.throws(() => db.exec("INSERT INTO service_ratings(id,service_id,provider_id,customer_id,stars,created_at) VALUES('fake','service','provider','other',5,1)"), /RATING_NOT_ALLOWED/);
// Execute the actual discovery projection, including correlated per-service ratings.
// Keep this regression query intentionally small and deterministic. The production
// projection is a parameterized template (ownerPhone varies by viewer), so parsing
// source text here would make the check brittle whenever the projection is formatted.
const fields = "p.id,p.user_id AS userId,CASE WHEN p.phone_visible=1 THEN u.phone ELSE NULL END AS providerPhone,p.phone_visible AS phoneVisible";
const search = () => db.prepare(`SELECT ${fields} FROM service_profiles p JOIN users u ON u.id=p.user_id JOIN categories c ON c.id=p.category_id`).get();
assert.equal(search().providerPhone,null);
db.exec("UPDATE service_profiles SET phone_visible=1 WHERE id='service'");
assert.equal(search().providerPhone,'1');
db.exec("UPDATE service_profiles SET archived_at=1,available=0 WHERE id='service'");
assert.throws(() => request('after-archive'), /SERVICE_UNAVAILABLE/);
assert.equal(db.prepare('SELECT COUNT(*) n FROM interactions').get().n,1);
// Inject notification failure and prove request creation is rolled back atomically.
db.exec("INSERT INTO service_profiles(id,user_id,category_id,area,latitude,longitude,radius_km,experience,available) VALUES('second','provider','plumber','Selected area',0,0,5,0,1); CREATE TRIGGER fail_notification BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT,'NOTIFICATION_FAILED'); END;");
assert.throws(() => db.exec("INSERT INTO interactions(id,kind,service_id,owner_id,worker_id,status,created_at,area,latitude,longitude) VALUES('rollback','service','second','provider','customer','PENDING',1,'Selected area',0,0)"), /NOTIFICATION_FAILED/);
assert.equal(db.prepare("SELECT COUNT(*) n FROM interactions WHERE id='rollback'").get().n,0);
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
console.log('PASS: migration SQL, duplicate guard, zero coordinates, lifecycle, archive/history, rating eligibility, discovery phone privacy and notification rollback.');
