import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, count } from "drizzle-orm";
import { userLocations } from "../../db/schema";
import { requireAuth } from "../auth/session";
import { ok, ApiError } from "../../middleware/errors";
import type { AppEnv } from "../../config/env";

export const locations = new Hono<AppEnv>();

// Search for locations via Nominatim API (OpenStreetMap)
locations.get("/search", requireAuth, async (c) => {
  const query = c.req.query("q");
  if (!query || query.length < 3) {
    return ok(c, { results: [] });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=jsonv2&addressdetails=1&limit=5`,
      {
        headers: {
          "User-Agent": "BulaoApp/1.0 (contact@bulao.app)",
        },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch location data");

    const data = (await response.json()) as any[];
    const results = data.map((item) => ({
      name: item.name || item.display_name.split(",")[0],
      address: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    }));

    return ok(c, { results });
  } catch (error) {
    throw new ApiError("GEOCODING_FAILED", 500, "Failed to search for location.");
  }
});

// Get user's saved locations
locations.get("/users/me/locations", requireAuth, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");

  const results = await db
    .select()
    .from(userLocations)
    .where(eq(userLocations.userId, userId))
    .all();

  return ok(c, { locations: results });
});

// Add a saved location
locations.post("/users/me/locations", requireAuth, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");

  const input = z
    .object({
      label: z.enum(["Home", "Work", "Other"]),
      area: z.string().min(2),
      address: z.string().min(2),
      latitude: z.number(),
      longitude: z.number(),
    })
    .parse(await c.req.json());

  const currentCount = await db
    .select({ value: count() })
    .from(userLocations)
    .where(eq(userLocations.userId, userId))
    .get();

  if (currentCount && currentCount.value >= 3) {
    throw new ApiError("LIMIT_REACHED", 400, "You can only save up to 3 locations.");
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const newLocation = {
    id,
    userId,
    ...input,
    isDefault: false,
    createdAt: now,
  };

  await db.insert(userLocations).values(newLocation).run();

  return ok(c, newLocation);
});

// Delete a saved location
locations.delete("/users/me/locations/:id", requireAuth, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");
  const locationId = c.req.param("id");

  await db
    .delete(userLocations)
    .where(and(eq(userLocations.id, locationId), eq(userLocations.userId, userId)))
    .run();

  return ok(c, { success: true });
});
