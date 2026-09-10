import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import type { AppEnv } from "../../config/env";
import { savedPlaces } from "../../db/schema";
import { ApiError, ok } from "../../middleware/errors";
import { now, requireAuth } from "../auth/session";

export const savedPlacesRoutes = new Hono<AppEnv>();

// Get all saved places for the user
savedPlacesRoutes.get("/", requireAuth, async (c) => {
  const db = drizzle(c.env.DB);
  const places = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.userId, c.get("userId")))
    .orderBy(desc(savedPlaces.lastUsedAt))
    .all();

  return ok(c, places);
});

// Create a new saved place
savedPlacesRoutes.post("/", requireAuth, async (c) => {
  const input = z
    .object({
      label: z.string().min(1).max(50),
      icon: z.string().default("📍"),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      locality: z.string().min(1).max(200),
      address: z.string().max(500).default(""),
    })
    .parse(await c.req.json());

  const db = drizzle(c.env.DB);
  const id = crypto.randomUUID();
  const timestamp = now();

  await db.insert(savedPlaces).values({
    id,
    userId: c.get("userId"),
    label: input.label,
    icon: input.icon,
    latitude: input.latitude,
    longitude: input.longitude,
    locality: input.locality,
    address: input.address,
    lastUsedAt: timestamp,
    createdAt: timestamp,
  });

  const place = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.id, id))
    .get();

  return ok(c, place);
});

// Update a saved place's last used timestamp
savedPlacesRoutes.patch("/:id/use", requireAuth, async (c) => {
  const db = drizzle(c.env.DB);
  const placeId = c.req.param("id");

  const place = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.id, placeId))
    .get();

  if (!place) {
    throw new ApiError("PLACE_NOT_FOUND", 404);
  }

  if (place.userId !== c.get("userId")) {
    throw new ApiError("UNAUTHORIZED", 403);
  }

  await c.env.DB.prepare(
    "UPDATE saved_places SET last_used_at = ? WHERE id = ?"
  )
    .bind(now(), placeId)
    .run();

  return ok(c, { success: true });
});

// Delete a saved place
savedPlacesRoutes.delete("/:id", requireAuth, async (c) => {
  const db = drizzle(c.env.DB);
  const placeId = c.req.param("id");

  const place = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.id, placeId))
    .get();

  if (!place) {
    throw new ApiError("PLACE_NOT_FOUND", 404);
  }

  if (place.userId !== c.get("userId")) {
    throw new ApiError("UNAUTHORIZED", 403);
  }

  await c.env.DB.prepare("DELETE FROM saved_places WHERE id = ?")
    .bind(placeId)
    .run();

  return ok(c, { success: true });
});
