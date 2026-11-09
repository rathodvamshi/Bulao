-- Immutable collection revisions; publish by switching one active pointer.
CREATE TABLE IF NOT EXISTS story_collections (
  id TEXT PRIMARY KEY,
  active_revision TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS story_images (
  collection_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  id TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK(sort_order >= 0),
  label TEXT NOT NULL,
  public_id TEXT NOT NULL,
  url TEXT NOT NULL,
  width INTEGER NOT NULL CHECK(width > 0),
  height INTEGER NOT NULL CHECK(height > 0),
  bytes INTEGER NOT NULL CHECK(bytes > 0),
  fit TEXT NOT NULL CHECK(fit IN ('contain', 'cover')),
  scale REAL NOT NULL DEFAULT 1 CHECK(scale BETWEEN 0.5 AND 2),
  offset REAL NOT NULL DEFAULT 0.18 CHECK(offset BETWEEN 0 AND 1),
  PRIMARY KEY(collection_id, revision, id),
  UNIQUE(collection_id, revision, sort_order)
);
