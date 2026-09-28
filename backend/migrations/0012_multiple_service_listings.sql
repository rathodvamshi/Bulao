-- Preserve separate service listings, including multiple offers in the same category.
-- This changes only the index; existing service IDs and associated bookings remain intact.
DROP INDEX IF EXISTS service_user_category;
CREATE INDEX service_user_category ON service_profiles (user_id, category_id);
