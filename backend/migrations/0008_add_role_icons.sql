-- Add icon column to roles table
ALTER TABLE roles ADD COLUMN icon TEXT NOT NULL DEFAULT '👤';
