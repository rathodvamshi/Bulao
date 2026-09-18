-- ============================================================
-- Bulao Database Reset Script
-- Deletes all user & application data completely to start fresh.
-- Keeps schema migrations and seeds default reference locations.
-- ============================================================

-- Disable foreign key constraints during purge
PRAGMA foreign_keys = OFF;

-- 1. Purge interaction messages and uploads
DELETE FROM interaction_messages;
DELETE FROM job_uploads;

-- 2. Purge user reviews, blocks, and reports
DELETE FROM reviews;
DELETE FROM blocks;
DELETE FROM reports;

-- 3. Purge user interactions & service applications
DELETE FROM interactions;

-- 4. Purge jobs & service profiles
DELETE FROM jobs;
DELETE FROM service_profiles;

-- 5. Purge notifications
DELETE FROM notifications;

-- 6. Purge user locations & saved places
DELETE FROM saved_places;
DELETE FROM user_saved_locations;
DELETE FROM user_contact_phones;

-- 7. Purge auth, sessions, challenges & cooldowns
DELETE FROM sessions;
DELETE FROM auth_events;
DELETE FROM otp_challenges;
DELETE FROM otp_cooldowns;
DELETE FROM rate_limits;
DELETE FROM image_intents;
DELETE FROM provider_usage;

-- 8. Purge all users
DELETE FROM users;

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Reseed default reference locations if missing
INSERT OR IGNORE INTO locations(id, area, latitude, longitude) VALUES
  ('kukatpally', 'Kukatpally, Hyderabad', 17.4948, 78.3996),
  ('madhapur', 'Madhapur, Hyderabad', 17.4483, 78.3915),
  ('gachibowli', 'Gachibowli, Hyderabad', 17.4401, 78.3489),
  ('ameerpet', 'Ameerpet, Hyderabad', 17.4375, 78.4483),
  ('secunderabad', 'Secunderabad', 17.4399, 78.4983),
  ('hyderabad', 'Hyderabad', 17.3850, 78.4867);
