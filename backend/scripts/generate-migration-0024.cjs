const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.resolve('packages/domain/src/services/taxonomy.ts'), 'utf8');
const match = content.match(/export const CATEGORY_SCHEMAS: Record<string, CategoryFormSchema> = (\{[\s\S]*\});\s*$/);
if (!match) throw new Error('Could not parse CATEGORY_SCHEMAS');
const schemas = eval('(' + match[1] + ')');

let sql = `-- Migration 0024: Find a Service - Complete Marketplace Foundation
-- Provider Common Profiles, Discrete Service Offerings, and Versioned Category Schemas

CREATE TABLE IF NOT EXISTS provider_common_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  provider_type TEXT NOT NULL DEFAULT 'individual' CHECK(provider_type IN ('individual', 'business', 'team')),
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  introduction TEXT NOT NULL DEFAULT '',
  overall_experience INTEGER NOT NULL DEFAULT 0 CHECK(overall_experience >= 0),
  languages TEXT NOT NULL DEFAULT '["English"]',
  alternate_phone TEXT,
  business_name TEXT,
  team_size INTEGER CHECK(team_size IS NULL OR team_size >= 1),
  business_description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS service_offerings (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES service_profiles(id),
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  pricing_model TEXT NOT NULL CHECK(pricing_model IN ('fixed', 'hourly', 'per_day', 'per_session', 'per_month', 'per_task', 'price_range', 'quote', 'inspection')),
  price_paise INTEGER CHECK(price_paise IS NULL OR price_paise >= 0),
  min_price_paise INTEGER CHECK(min_price_paise IS NULL OR min_price_paise >= 0),
  max_price_paise INTEGER CHECK(max_price_paise IS NULL OR max_price_paise >= 0),
  pricing_unit TEXT NOT NULL DEFAULT 'per task',
  included_work TEXT NOT NULL DEFAULT '',
  additional_charges TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS service_offerings_service ON service_offerings(service_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS service_offerings_category ON service_offerings(category_id, is_active);

CREATE TABLE IF NOT EXISTS service_category_schemas (
  category_id TEXT PRIMARY KEY REFERENCES categories(id),
  schema_version INTEGER NOT NULL DEFAULT 1,
  schema_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

`;

for (const [catId, schema] of Object.entries(schemas)) {
  const jsonStr = JSON.stringify(schema).replace(/'/g, "''");
  sql += `INSERT INTO service_category_schemas (category_id, schema_version, schema_json, updated_at)
VALUES ('${catId}', ${schema.schemaVersion}, '${jsonStr}', unixepoch())
ON CONFLICT(category_id) DO UPDATE SET
  schema_version = excluded.schema_version,
  schema_json = excluded.schema_json,
  updated_at = excluded.updated_at;

`;
}

fs.writeFileSync(path.resolve('backend/migrations/0024_find_a_service_marketplace.sql'), sql, 'utf8');
console.log('Migration 0024 created successfully with', Object.keys(schemas).length, 'schemas.');
