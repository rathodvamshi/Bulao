-- Add missing service_profiles columns for description, offered_services, phone_visible, social_links
ALTER TABLE service_profiles ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE service_profiles ADD COLUMN offered_services TEXT NOT NULL DEFAULT '[]';
ALTER TABLE service_profiles ADD COLUMN phone_visible INTEGER NOT NULL DEFAULT 1;
ALTER TABLE service_profiles ADD COLUMN social_links TEXT NOT NULL DEFAULT '{}';
