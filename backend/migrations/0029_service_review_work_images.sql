-- Migration 0029: Work images for service reviews & ratings
CREATE TABLE IF NOT EXISTS service_review_images (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES service_ratings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS service_review_images_review_id ON service_review_images(review_id);
