-- Post Work v2 fields used by current job routes and the dynamic job cards.
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
-- Role icons are queried by the job catalog and were missing from the original baseline.
ALTER TABLE roles ADD COLUMN icon TEXT NOT NULL DEFAULT '💼';
