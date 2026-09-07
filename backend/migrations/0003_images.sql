ALTER TABLE users ADD COLUMN photo_url TEXT;
CREATE TABLE image_intents(asset_id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
CREATE INDEX image_intent_expiry ON image_intents(expires_at);
