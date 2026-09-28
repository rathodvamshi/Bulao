-- Keep the original form selections so a service can be edited without losing details.
ALTER TABLE service_profiles ADD COLUMN wizard_state TEXT NOT NULL DEFAULT '{}';
