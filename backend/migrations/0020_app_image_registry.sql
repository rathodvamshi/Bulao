CREATE TABLE IF NOT EXISTS app_assets (
  id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  public_id TEXT NOT NULL,
  url TEXT NOT NULL,
  width INTEGER NOT NULL CHECK(width > 0),
  height INTEGER NOT NULL CHECK(height > 0),
  bytes INTEGER NOT NULL CHECK(bytes > 0),
  revision TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS uploaded_image_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL CHECK(purpose IN ('profile','service')),
  thumbnail_url TEXT NOT NULL,
  medium_url TEXT NOT NULL,
  full_url TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS uploaded_image_assets_owner ON uploaded_image_assets(user_id, created_at);
