-- Add Service Profile v2 columns to service_profiles table
ALTER TABLE service_profiles ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE service_profiles ADD COLUMN service_mode TEXT NOT NULL DEFAULT 'doorstep';
ALTER TABLE service_profiles ADD COLUMN pricing_model TEXT NOT NULL DEFAULT 'fixed';
ALTER TABLE service_profiles ADD COLUMN base_price_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_profiles ADD COLUMN operating_hours TEXT NOT NULL DEFAULT '9:00 AM - 7:00 PM';
ALTER TABLE service_profiles ADD COLUMN portfolio_urls TEXT NOT NULL DEFAULT '[]';
