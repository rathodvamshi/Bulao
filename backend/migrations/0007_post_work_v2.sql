ALTER TABLE jobs ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN experience TEXT NOT NULL DEFAULT 'any';
ALTER TABLE jobs ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN duration TEXT NOT NULL DEFAULT 'one';
ALTER TABLE jobs ADD COLUMN ends_at INTEGER;
ALTER TABLE jobs ADD COLUMN hours TEXT NOT NULL DEFAULT 'full';
ALTER TABLE jobs ADD COLUMN start_time TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE jobs ADD COLUMN end_time TEXT NOT NULL DEFAULT '17:00';
ALTER TABLE jobs ADD COLUMN paid_when TEXT NOT NULL DEFAULT 'after';
ALTER TABLE jobs ADD COLUMN extras TEXT NOT NULL DEFAULT '[]';
CREATE TABLE saved_places (
 id TEXT PRIMARY KEY, provider_id TEXT NOT NULL REFERENCES users(id),
 label TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'location',
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 area TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', last_used_at INTEGER NOT NULL,
 UNIQUE(provider_id, label)
);
CREATE INDEX saved_places_provider_recent ON saved_places(provider_id, last_used_at DESC);
INSERT OR IGNORE INTO categories(id,kind,name,icon) VALUES ('construction','job','Construction','hammer'),('other-work','job','Other work','grid');
INSERT OR IGNORE INTO roles(id,category_id,name) VALUES ('construction-painter','construction','Painter'),('construction-mason','construction','Mason'),('construction-helper','construction','Construction helper'),('other-work-role','other-work','Other work');
