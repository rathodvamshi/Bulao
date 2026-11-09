import { Hono } from 'hono';
import type { AppEnv } from '../../config/env';
import { ApiError, ok } from '../../middleware/errors';

export const stories = new Hono<AppEnv>();
stories.get('/:collection', async c => {
  const collection = c.req.param('collection');
  if (!['hire-someone', 'request-service'].includes(collection)) throw new ApiError('NOT_FOUND', 404);
  // A single query sees a coherent active revision during publication.
  const result = await c.env.DB.prepare(`
    SELECT i.id, i.label, i.url, i.width, i.height, i.fit, i.scale, i.offset,
           i.sort_order AS sortOrder, i.revision
    FROM story_images i JOIN story_collections c
      ON c.id = i.collection_id AND c.active_revision = i.revision
    WHERE c.id = ? ORDER BY i.sort_order LIMIT 50
  `).bind(collection).all();
  const first = result.results[0];
  if (!first) throw new ApiError('NOT_FOUND', 404);
  c.header('Cache-Control', 'public, max-age=300');
  return ok(c, { collection, revision: first.revision, scenes: result.results });
});
