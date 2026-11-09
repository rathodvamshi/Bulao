-- ============================================================
-- Bulao Database Complete Reset Script
-- Deletes every user and all user-generated/operational data
-- so you can start completely fresh.
--
-- Preserves system catalog data:
-- categories, roles, locations, app_assets,
-- story_collections, story_images, service_category_schemas.
-- ============================================================

PRAGMA foreign_keys = OFF;

-- 1. Purge user image uploads & upload intents
DELETE FROM uploaded_image_assets;
DELETE FROM image_intents;

-- 2. Purge user reviews, ratings, reports, and blocks
DELETE FROM reviews;
DELETE FROM service_ratings;
DELETE FROM service_review_reports;
DELETE FROM reports;
DELETE FROM blocks;

-- 3. Purge user interactions, bookings & offline payment confirmations
DELETE FROM service_offline_payments;
DELETE FROM interactions;

-- 4. Purge services, offerings & jobs
DELETE FROM service_offerings;
DELETE FROM service_profiles;
DELETE FROM provider_common_profiles;
DELETE FROM jobs;

-- 5. Purge user notifications
DELETE FROM notifications;

-- 6. Purge user locations & saved places
DELETE FROM saved_places;
DELETE FROM user_locations;

-- 7. Purge auth, sessions, challenges, cooldowns & rate limits
DELETE FROM sessions;
DELETE FROM auth_events;
DELETE FROM otp_challenges;
DELETE FROM otp_cooldowns;
DELETE FROM rate_limits;
DELETE FROM provider_usage;

-- 8. Purge all users completely
DELETE FROM users;

PRAGMA foreign_keys = ON;
