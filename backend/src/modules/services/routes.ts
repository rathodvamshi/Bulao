import { Hono } from "hono";
import { z } from "zod";
import { serviceSchema, locationSchema, distanceKm } from "@bulao/domain";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../config/env";
import { categories, serviceProfiles } from "../../db/schema";
import { ApiError, ok } from "../../middleware/errors";
import { now, requireAuth, rateLimit } from "../auth/session";
import { nearby } from "../locations/search";
import { assertUnblocked } from "../trust/permissions";
export const services = new Hono<AppEnv>();
services.get("/", async (c) => ok(c, await nearby(c, "service")));
services.post("/", requireAuth, async (c) => {
  const input = serviceSchema.parse(await c.req.json());
  const db = drizzle(c.env.DB);
  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.id, input.categoryId))
    .get();
  if (category?.kind !== "service") throw new ApiError("INVALID_CATEGORY");
  const id = crypto.randomUUID();
  const result = await db
    .insert(serviceProfiles)
    .values({ ...input, id, userId: c.get("userId") })
    .onConflictDoNothing()
    .returning();
  if (!result.length)
    throw new ApiError(
      "SERVICE_EXISTS",
      409,
      "You already offer this service.",
    );
  return ok(c, { id });
});
export const requests = new Hono<AppEnv>();
requests.post("/", requireAuth, async (c) => {
  const input = locationSchema
    .extend({
      serviceId: z.string().uuid(),
      details: z.string().trim().min(2).max(1000),
      scheduledAt: z.number().int().positive(),
    })
    .parse(await c.req.json());
  const profile = await drizzle(c.env.DB)
    .select()
    .from(serviceProfiles)
    .where(eq(serviceProfiles.id, input.serviceId))
    .get();
  if (!profile?.available) throw new ApiError("SERVICE_UNAVAILABLE", 409);
  if (profile.userId === c.get("userId")) throw new ApiError("SELF_REQUEST");
  await assertUnblocked(c.env.DB, profile.userId, c.get("userId"));
  await rateLimit(c.env.DB, `request:${c.get("userId")}`, 20, 3600);
  if (distanceKm(input, profile) > profile.radiusKm)
    throw new ApiError(
      "OUTSIDE_SERVICE_AREA",
      400,
      "Choose a professional who works in your area.",
    );
  if (input.scheduledAt < now() - 60 || input.scheduledAt > now() + 90 * 86400)
    throw new ApiError("INVALID_DATE");
  const id = crypto.randomUUID();
  const result = await c.env.DB.prepare(
    "INSERT INTO interactions(id,kind,service_id,owner_id,worker_id,status,details,created_at,area,latitude,longitude,scheduled_at) SELECT ?,'service',?,?,?,'PENDING',?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM interactions WHERE service_id=? AND worker_id=? AND status IN ('PENDING','ACCEPTED','IN_PROGRESS')) RETURNING id",
  )
    .bind(
      id,
      profile.id,
      profile.userId,
      c.get("userId"),
      input.details,
      now(),
      input.area,
      input.latitude,
      input.longitude,
      input.scheduledAt,
      profile.id,
      c.get("userId"),
    )
    .first();
  if (!result)
    throw new ApiError(
      "REQUEST_EXISTS",
      409,
      "You already have an active request with this professional.",
    );
  return ok(c, { id });
});
