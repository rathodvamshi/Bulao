-- Create service_ratings table for ratings and reviews on service profiles
CREATE TABLE IF NOT EXISTS service_ratings (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES service_profiles(id),
  provider_id TEXT NOT NULL REFERENCES users(id),
  customer_id TEXT NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL,
  feedback TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_customer_service_rating ON service_ratings(customer_id, service_id);
CREATE INDEX IF NOT EXISTS service_ratings_service_id ON service_ratings(service_id);
CREATE INDEX IF NOT EXISTS service_ratings_provider_id ON service_ratings(provider_id);
