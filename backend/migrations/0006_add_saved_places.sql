-- Migration: Add saved_places table
-- Description: Adds a table to store provider's frequently used work locations

CREATE TABLE IF NOT EXISTS saved_places (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📍',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  locality TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  last_used_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_saved_places_user ON saved_places(user_id, last_used_at);

-- Note: This migration supports the "Post Work" flow v2
-- which allows providers to save frequently used locations
-- for faster job posting on subsequent uses.
