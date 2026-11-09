import { Hono } from 'hono';
import type { AppEnv } from '../../config/env';
import { ok } from '../../middleware/errors';

// Curated public artwork only. User photos must never be included here.
export const appAssets = new Hono<AppEnv>();
appAssets.get('/', async c => {
  const rows = await c.env.DB.prepare(
    'SELECT id, group_name AS groupName, url, width, height, revision FROM app_assets ORDER BY id LIMIT 500',
  ).all();
  c.header('Cache-Control','public, max-age=300');
  return ok(c,{assets:rows.results});
});
