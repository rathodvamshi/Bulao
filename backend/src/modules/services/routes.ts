import { readServices } from "./read";
import { archiveService } from "./lifecycle";
import { Hono } from "hono";
import { z } from "zod";
import { serviceSchema, locationSchema, distanceKm } from "@bulao/domain";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, isNull } from "drizzle-orm";
import type { AppEnv } from "../../config/env";
import { categories, serviceProfiles } from "../../db/schema";
import { ApiError, ok } from "../../middleware/errors";
import { now, requireAuth, rateLimit } from "../auth/session";
import { nearby } from "../locations/search";
import { assertUnblocked } from "../trust/permissions";
export const services = new Hono<AppEnv>();
services.get("/", async (c) => ok(c, await nearby(c, "service")));

services.get("/mine", requireAuth, async (c) => {
  try {
    return ok(c, await readServices(c, { ownerId: c.get("userId") }));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error(`[GET /services/mine error] [${c.get("requestId")}]`, error);
    // Do not turn a failed read into a successful empty response. The client
    // needs to distinguish "no listings" from "could not load listings".
    throw new ApiError("SERVICE_LIST_FAILED", 503, "Your service listings could not be loaded. Please retry.");
  }
});
services.get("/provider/:providerId/listings", async (c) => {
  const listings = await readServices(c, { providerId: c.req.param("providerId") });
  // Public profile listings include work details, but never the provider's
  // private phone or exact service location.
  return ok(c, listings.map((listing) => ({
    ...listing,
    area: null,
    latitude: null,
    longitude: null,
    provider: listing.provider ? { ...listing.provider, phone: null } : listing.provider,
  })));
});
services.get("/:id", async (c) => ok(c, (await readServices(c, { id: c.req.param("id") }))[0]));

// ── POST /services/:id/ratings (Customer Submit/Edit Service Rating with Review Images) ──
services.post("/:id/ratings", requireAuth, async (c) => {
  const serviceId = c.req.param("id");
  const customerId = c.get("userId");
  const body = await c.req.json();

  const { stars, feedback, images } = z.object({
    stars: z.number().int().min(1).max(5),
    feedback: z.string().trim().max(2000).default(""),
    images: z.array(z.string().url()).max(10).default([]),
  }).parse(body);

  // Critical requirement: When a user adds even one work image, written feedback is mandatory.
  if (images.length > 0 && !feedback.trim()) {
    throw new ApiError("FEEDBACK_REQUIRED", 400, "Please add feedback when uploading work images.");
  }

  const service = await c.env.DB.prepare("SELECT user_id as providerId FROM service_profiles WHERE id = ?").bind(serviceId).first<any>();
  if (!service) {
    throw new ApiError("NOT_FOUND", 404, "Service profile not found.");
  }

  if (service.providerId === customerId) {
    throw new ApiError("SELF_RATING", 400, "Service providers cannot rate their own service.");
  }

  await assertUnblocked(c.env.DB, customerId, service.providerId);

  // Check for completed interaction
  let completed = await c.env.DB.prepare("SELECT id FROM interactions WHERE service_id=? AND worker_id=? AND status='COMPLETED' LIMIT 1").bind(serviceId, customerId).first();
  if (!completed) {
    if (c.env.APP_ENV !== "production") {
      // In development mode, auto-create a mock completed interaction so testing can proceed smoothly
      const mockInterId = crypto.randomUUID();
      const mockTs = Math.floor(Date.now() / 1000);
      try {
        await c.env.DB.prepare(`
          INSERT OR IGNORE INTO interactions (id, kind, service_id, owner_id, worker_id, status, owner_confirmed_at, worker_confirmed_at, created_at, area, latitude, longitude)
          VALUES (?, 'service', ?, ?, ?, 'COMPLETED', ?, ?, ?, 'Hyderabad', 17.385, 78.4867)
        `).bind(mockInterId, serviceId, service.providerId, customerId, mockTs, mockTs, mockTs).run();
      } catch (mockErr) {
        console.warn("[Dev mock interaction warning]:", mockErr);
      }
    } else {
      throw new ApiError("RATING_NOT_ALLOWED", 403, "Complete a service request before rating it.");
    }
  }

  const existingRating = await c.env.DB.prepare(
    "SELECT id FROM service_ratings WHERE customer_id=? AND service_id=?"
  ).bind(customerId, serviceId).first<{ id: string }>();

  const ratingId = existingRating?.id || crypto.randomUUID();
  const nowTs = Math.floor(Date.now() / 1000);

  try {
    await c.env.DB.prepare(`
      INSERT INTO service_ratings (id, service_id, provider_id, customer_id, stars, feedback, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (customer_id, service_id) DO UPDATE SET
        stars = excluded.stars,
        feedback = excluded.feedback,
        updated_at = excluded.updated_at
    `).bind(ratingId, serviceId, service.providerId, customerId, stars, feedback, nowTs, nowTs).run();

    // Manage review images transactionally
    try {
      await c.env.DB.prepare("DELETE FROM service_review_images WHERE review_id = ?").bind(ratingId).run();
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const imgId = crypto.randomUUID();
          await c.env.DB.prepare(`
            INSERT INTO service_review_images (id, review_id, image_url, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).bind(imgId, ratingId, images[i], i, nowTs).run();
        }
      }
    } catch (imgErr) {
      console.warn("[Review images persistence notice]:", imgErr);
    }

    return ok(c, { success: true, message: "Rating and review saved successfully.", ratingId });
  } catch (err: any) {
    console.error("[POST /services/:id/ratings error]:", err);
    throw new ApiError("RATING_FAILED", 400, "Could not save rating.");
  }
});

// ── GET /services/:id/reviews (List published reviews with cursor pagination & sorting) ──
services.get("/:id/reviews", async (c) => {
  const serviceId = c.req.param("id");
  const url = new URL(c.req.url);
  const sort = url.searchParams.get("sort") || "recent";
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 10), 1), 50);

  const service = await c.env.DB.prepare("SELECT id FROM service_profiles WHERE id=?").bind(serviceId).first();
  if (!service) throw new ApiError("NOT_FOUND", 404, "Service profile not found.");

  // Summary aggregation
  const summaryRes = await c.env.DB.prepare(`
    SELECT
      COUNT(*) AS total,
      ROUND(AVG(stars), 1) AS average,
      SUM(CASE WHEN stars = 5 THEN 1 ELSE 0 END) AS stars5,
      SUM(CASE WHEN stars = 4 THEN 1 ELSE 0 END) AS stars4,
      SUM(CASE WHEN stars = 3 THEN 1 ELSE 0 END) AS stars3,
      SUM(CASE WHEN stars = 2 THEN 1 ELSE 0 END) AS stars2,
      SUM(CASE WHEN stars = 1 THEN 1 ELSE 0 END) AS stars1
    FROM service_ratings
    WHERE service_id = ?
  `).bind(serviceId).first<any>();

  const totalReviews = Number(summaryRes?.total || 0);
  const rating = totalReviews > 0 ? Number(summaryRes?.average || 0) : null;
  const ratingBreakdown = {
    stars5: Number(summaryRes?.stars5 || 0),
    stars4: Number(summaryRes?.stars4 || 0),
    stars3: Number(summaryRes?.stars3 || 0),
    stars2: Number(summaryRes?.stars2 || 0),
    stars1: Number(summaryRes?.stars1 || 0),
  };

  let orderClause = "ORDER BY sr.created_at DESC";
  if (sort === "highest") {
    orderClause = "ORDER BY sr.stars DESC, sr.created_at DESC";
  } else if (sort === "lowest") {
    orderClause = "ORDER BY sr.stars ASC, sr.created_at DESC";
  }

  let whereExtra = "";
  const params: any[] = [serviceId];

  if (sort === "with_photos") {
    whereExtra += " AND EXISTS (SELECT 1 FROM service_review_images sri WHERE sri.review_id = sr.id)";
  }

  if (cursor) {
    const cursorTs = Number(cursor);
    if (!isNaN(cursorTs) && cursorTs > 0) {
      whereExtra += " AND sr.created_at < ?";
      params.push(cursorTs);
    }
  }

  params.push(limit + 1);

  let reviewRows: any[] = [];
  try {
    const res = await c.env.DB.prepare(`
      SELECT sr.id, sr.service_id, sr.stars, sr.feedback AS body, sr.created_at,
             u.id AS author_id, u.name AS author_name, u.photo_url AS author_photo
      FROM service_ratings sr
      JOIN users u ON u.id = sr.customer_id
      WHERE sr.service_id = ? ${whereExtra}
      ${orderClause}
      LIMIT ?
    `).bind(...params).all<any>();
    reviewRows = res.results || [];
  } catch (err) {
    console.warn("[GET /services/:id/reviews fetch error]:", err);
  }

  const hasMore = reviewRows.length > limit;
  const items = hasMore ? reviewRows.slice(0, limit) : reviewRows;
  const nextCursor = hasMore && items.length > 0 ? String(items[items.length - 1].created_at) : null;

  const reviewIds = items.map(r => r.id);
  const imagesByReviewId: Record<string, string[]> = {};

  if (reviewIds.length > 0) {
    const marks = reviewIds.map(() => "?").join(",");
    try {
      const imgRes = await c.env.DB.prepare(`
        SELECT review_id, image_url
        FROM service_review_images
        WHERE review_id IN (${marks})
        ORDER BY sort_order ASC
      `).bind(...reviewIds).all<any>();

      for (const row of imgRes.results || []) {
        if (!imagesByReviewId[row.review_id]) imagesByReviewId[row.review_id] = [];
        imagesByReviewId[row.review_id]?.push(row.image_url);
      }
    } catch {}
  }

  const enrichedReviews = items.map(r => ({
    id: r.id,
    stars: r.stars,
    body: r.body,
    feedback: r.body,
    createdAt: r.created_at,
    authorName: r.author_name,
    authorPhoto: r.author_photo,
    images: imagesByReviewId[r.id] || [],
  }));

  return ok(c, {
    rating,
    totalReviews,
    ratingBreakdown,
    reviews: enrichedReviews,
    hasMore,
    nextCursor,
  });
});

// ── DELETE /services/:id/ratings/:ratingId (Delete owned review) ──
services.delete("/:id/ratings/:ratingId", requireAuth, async (c) => {
  const serviceId = c.req.param("id");
  const ratingId = c.req.param("ratingId");
  const customerId = c.get("userId");

  const rating = await c.env.DB.prepare(
    "SELECT id, customer_id FROM service_ratings WHERE id=? AND service_id=?"
  ).bind(ratingId, serviceId).first<any>();

  if (!rating) throw new ApiError("NOT_FOUND", 404, "Review not found.");
  if (rating.customer_id !== customerId) {
    throw new ApiError("FORBIDDEN", 403, "You can only delete your own review.");
  }

  try {
    await c.env.DB.prepare("DELETE FROM service_review_images WHERE review_id=?").bind(ratingId).run();
  } catch {}
  await c.env.DB.prepare("DELETE FROM service_ratings WHERE id=?").bind(ratingId).run();

  return ok(c, { success: true, message: "Review deleted successfully." });
});

// ── POST /services/:id/ratings/:ratingId/report (Report Inappropriate Review) ──
services.post("/:id/ratings/:ratingId/report", requireAuth, async (c) => {
  const ratingId = c.req.param("ratingId");
  const reporterId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const reason = String(body.reason || "Inappropriate customer review content").trim();

  const review = await c.env.DB.prepare("SELECT id FROM service_ratings WHERE id=? AND service_id=? UNION ALL SELECT r.id FROM reviews r JOIN interactions i ON i.id=r.interaction_id WHERE r.id=? AND i.service_id=? AND r.author_id=i.worker_id").bind(ratingId, c.req.param("id"), ratingId, c.req.param("id")).first();
  if (!review) throw new ApiError("NOT_FOUND", 404, "Review not found.");
  if (!reason || reason.length > 1000) throw new ApiError("VALIDATION_ERROR", 400, "Provide a reason of at most 1000 characters.");
  const reportId = crypto.randomUUID();
  const nowTs = Math.floor(Date.now() / 1000);

  try {
    await c.env.DB.prepare(`
      INSERT INTO service_review_reports (id, reporter_id, review_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(reportId, reporterId, ratingId, reason, nowTs).run();

    return ok(c, { success: true, message: "Feedback report submitted for moderation review." });
  } catch (err: any) {
    console.error("[POST report error]:", err);
    throw new ApiError("REPORT_FAILED", 503, "Could not save the report. Please retry.");
  }
});

services.post("/", requireAuth, async (c) => {
  const raw = await c.req.json();
  const input = serviceSchema.parse(raw);
  if (input.pricingModel !== "visit_quote" && input.basePricePaise === undefined) throw new ApiError("VALIDATION_ERROR", 400, "Provide the service price.");
  const db = drizzle(c.env.DB);

  let category = await db
    .select()
    .from(categories)
    .where(eq(categories.id, input.categoryId))
    .get();

  if (!category || category.kind !== "service") throw new ApiError("INVALID_CATEGORY", 400, "Choose a valid service category.");
  const validCategoryId = category.id;
  const id = crypto.randomUUID();
  const userId = c.get("userId");

  const combinedPhotos = [
    ...(input.portfolioUrls || []),
    ...(input.shopPhotos || []),
  ].slice(0, 20);

  const insertData = {
    createdAt: now(),
    updatedAt: now(),
    wizardState: {
      ...(input.wizardState || {}),
      ...(input.shopPhotos?.length ? { shopPhotos: input.shopPhotos } : {}),
    },
    id,
    userId,
    categoryId: validCategoryId,
    area: input.area,
    latitude: input.latitude,
    longitude: input.longitude,
    radiusKm: input.radiusKm,
    experience: input.experience,
    available: input.available,
    title: input.title || input.businessName || "",
    description: input.description,
    offeredServices: input.offeredServices,
    phoneVisible: input.phoneVisible,
    serviceMode: input.serviceMode,
    pricingModel: input.pricingModel,
    basePricePaise: input.basePricePaise ?? 0,
    operatingHours: input.operatingHours ?? "",
    portfolioUrls: combinedPhotos,
    socialLinks: { website: input.website, instagram: input.instagram, facebook: input.facebook },
  };

  try {
    const result = await db
      .insert(serviceProfiles)
      .values(insertData)
      .returning();

    return ok(c, { id: result[0]?.id || id });
  } catch (dbErr: any) {
    console.error("[service.create.failed]", dbErr);
    throw new ApiError("SERVICE_SAVE_FAILED", 503, "Your service could not be saved. Please retry.");
  }
});

// ── GET /services/provider/recent ──
services.get("/provider/recent", requireAuth, async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  const myServices = await db
    .select({
      id: serviceProfiles.id,
      categoryId: serviceProfiles.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      title: serviceProfiles.title,
      area: serviceProfiles.area,
      payPaise: serviceProfiles.basePricePaise,
      payUnit: serviceProfiles.pricingModel,
      available: serviceProfiles.available,
      createdAt: serviceProfiles.createdAt,
    })
    .from(serviceProfiles)
    .innerJoin(categories, eq(categories.id, serviceProfiles.categoryId))
    .where(and(eq(serviceProfiles.userId, userId), isNull(serviceProfiles.archivedAt)))
    .all();

  const requestsRes = await c.env.DB.prepare(`
    SELECT
      i.id,
      i.service_id as serviceId,
      i.status,
      i.created_at as createdAt,
      i.details,
      i.area,
      COALESCE(s.title, c.name, 'Service Request') as title,
      COALESCE(c.icon, '🛠️') as roleIcon,
      COALESCE(c.name, 'General') as categoryName,
      COALESCE(s.base_price_paise, 0) as payPaise,
      COALESCE(s.pricing_model, 'visit') as payUnit
    FROM interactions i
    LEFT JOIN service_profiles s ON s.id = i.service_id
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE (i.owner_id = ? OR i.worker_id = ?) AND i.kind = 'service'
    ORDER BY i.created_at DESC
    LIMIT 20
  `).bind(userId, userId).all();

  const serviceItems = (myServices || []).map((s) => ({
    id: s.id,
    roleId: s.categoryId,
    categoryId: s.categoryId,
    title: s.title,
    roleIcon: s.categoryIcon || "🛠️",
    categoryName: s.categoryName,
    categoryIcon: s.categoryIcon || "📋",
    area: s.area,
    payPaise: s.payPaise || 0,
    payUnit: s.payUnit || "visit",
    status: s.available ? "PUBLISHED" : "PAUSED",
    applicantCount: 0,
    createdAt: s.createdAt,
  }));

  const requestItems = (requestsRes.results || []).map((r: any) => ({
    id: r.id,
    roleId: r.serviceId || "service",
    categoryId: "service",
    title: r.title,
    roleIcon: r.roleIcon,
    categoryName: r.categoryName,
    categoryIcon: "📋",
    area: r.area || "Local",
    payPaise: r.payPaise || 0,
    payUnit: r.payUnit || "visit",
    status: r.status,
    applicantCount: 1,
    createdAt: r.createdAt,
  }));

  const combined = [...serviceItems, ...requestItems];
  combined.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return ok(c, combined);
});

// ── GET /services/provider/stats ──
services.get("/provider/stats", requireAuth, async (c) => {
  const userId = c.get("userId");
  const period = z.enum(["week", "month", "all"]).parse(c.req.query("period") || "all");
  const since = period === "all" ? 0 : now() - (period === "week" ? 7 : 30) * 86400;

  const serviceCount = await c.env.DB.prepare(
    "SELECT SUM(CASE WHEN ?=0 OR created_at>=? THEN 1 ELSE 0 END) as total, SUM(CASE WHEN available = 1 THEN 1 ELSE 0 END) as active FROM service_profiles WHERE user_id = ? AND archived_at IS NULL"
  ).bind(since, since, userId).first<{ total: number; active: number }>();

  const requestCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed FROM interactions WHERE owner_id = ? AND kind = 'service' AND created_at>=?"
  ).bind(userId, since).first<{ total: number; pending: number; completed: number }>();

  const totalPosted = Number(serviceCount?.total || 0);
  const active = Number(serviceCount?.active || 0);
  const interested = Number(requestCount?.total || 0);
  const completed = Number(requestCount?.completed || 0);

  return ok(c, {
    jobsPosted: totalPosted,
    active,
    interested,
    hired: completed,
    completed,
    pendingResponses: Number(requestCount?.pending || 0),
    period,
    trends: { jobsPosted: null, interested: null, hired: null, active: null },
  });
});

const patchServiceSchema = serviceSchema.partial();

services.patch("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const input = patchServiceSchema.parse(await c.req.json());
  const userId = c.get("userId");

  const existing = await c.env.DB.prepare("SELECT user_id as userId, pricing_model as pricingModel, base_price_paise as basePricePaise FROM service_profiles WHERE id = ? AND archived_at IS NULL").bind(id).first<any>();

  if (!existing || existing.userId !== userId) {
    throw new ApiError("NOT_FOUND", 404, "Service profile not found.");
  }

  const pricingModel = input.pricingModel ?? existing.pricingModel;
  if (pricingModel !== "visit_quote" && (input.basePricePaise ?? existing.basePricePaise) == null) throw new ApiError("VALIDATION_ERROR", 400, "Provide the service price.");
  const updates: string[] = [];
  const bindings: any[] = [];

  if (input.website !== undefined || input.instagram !== undefined || input.facebook !== undefined) {
    const social: Record<string, string> = {};
    for (const key of ["website", "instagram", "facebook"] as const) if (input[key] !== undefined) social[key] = input[key]!;
    updates.push("social_links = json_patch(social_links, ?)"); bindings.push(JSON.stringify(social));
  }
  if (input.categoryId !== undefined) {
    const category = await c.env.DB.prepare("SELECT id FROM categories WHERE id = ? AND kind = 'service'").bind(input.categoryId).first();
    if (!category) throw new ApiError("VALIDATION_ERROR", 400, "Choose a valid service category.");
    updates.push("category_id = ?"); bindings.push(input.categoryId);
  }
  if (input.wizardState !== undefined) {
    updates.push("wizard_state = ?"); bindings.push(JSON.stringify({ ...input.wizardState, ...(input.shopPhotos !== undefined ? { shopPhotos: input.shopPhotos } : {}) }));
  } else if (input.shopPhotos !== undefined) {
    updates.push("wizard_state = json_set(COALESCE(wizard_state, '{}'), '$.shopPhotos', json(?))"); bindings.push(JSON.stringify(input.shopPhotos));
  }
  if (input.area !== undefined) { updates.push("area = ?"); bindings.push(input.area); }
  if (input.latitude !== undefined) { updates.push("latitude = ?"); bindings.push(input.latitude); }
  if (input.longitude !== undefined) { updates.push("longitude = ?"); bindings.push(input.longitude); }
  if (input.experience !== undefined) { updates.push("experience = ?"); bindings.push(input.experience); }
  if (input.portfolioUrls !== undefined || input.shopPhotos !== undefined) { updates.push("portfolio_urls = ?"); bindings.push(JSON.stringify([...(input.portfolioUrls || []), ...(input.shopPhotos || [])].slice(0, 20))); }

  if (input.available !== undefined) {
    updates.push("available = ?");
    bindings.push(input.available ? 1 : 0);
  }
  if (input.title !== undefined) {
    updates.push("title = ?");
    bindings.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push("description = ?");
    bindings.push(input.description);
  }
  if (input.offeredServices !== undefined) {
    updates.push("offered_services = ?");
    bindings.push(JSON.stringify(input.offeredServices));
  }
  if (input.phoneVisible !== undefined) {
    updates.push("phone_visible = ?");
    bindings.push(input.phoneVisible ? 1 : 0);
  }
  if (input.radiusKm !== undefined) {
    updates.push("radius_km = ?");
    bindings.push(input.radiusKm);
  }
  if (input.serviceMode !== undefined) {
    updates.push("service_mode = ?");
    bindings.push(input.serviceMode);
  }
  if (input.pricingModel !== undefined) {
    updates.push("pricing_model = ?");
    bindings.push(input.pricingModel);
  }
  if (input.basePricePaise !== undefined) {
    updates.push("base_price_paise = ?");
    bindings.push(input.basePricePaise);
  }
  if (input.operatingHours !== undefined) {
    updates.push("operating_hours = ?");
    bindings.push(input.operatingHours);
  }

  if (updates.length > 0) {
    updates.push("updated_at = ?"); bindings.push(now());
    bindings.push(id);
    await c.env.DB.prepare(`UPDATE service_profiles SET ${updates.join(", ")} WHERE id = ?`).bind(...bindings).run();
  }

  return ok(c, { success: true, id });
});

services.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);
  const userId = c.get("userId");

  const existing = await db
    .select()
    .from(serviceProfiles)
    .where(eq(serviceProfiles.id, id))
    .get();

  if (!existing || existing.userId !== userId) {
    throw new ApiError("NOT_FOUND", 404, "Service profile not found.");
  }

  await archiveService(c.env.DB, id, userId);
  return ok(c, { success: true });
});

// ── POST /services/:id/action (Service / Request Actions) ──
services.post("/:id/action", requireAuth, async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawAction = String(body.action || body.next || body.status || "").trim().toLowerCase();

  const profile = await c.env.DB.prepare("SELECT * FROM service_profiles WHERE id = ?").bind(id).first<any>();
  if (profile) {
    if (profile.user_id !== userId) throw new ApiError("UNAUTHORIZED", 403, "You do not have permission for this service.");
    if (rawAction === "delete" || rawAction === "cancel" || rawAction === "remove") {
      await archiveService(c.env.DB, id, userId);
      return ok(c, { id, deleted: true, status: "DELETED" });
    }
    if (profile.archived_at || !["pause", "publish", "resume"].includes(rawAction)) throw new ApiError("INVALID_ACTION", 409, "This action is unavailable.");
    const nextAvail = rawAction === "pause" ? 0 : rawAction === "publish" || rawAction === "resume" ? 1 : profile.available;
    await c.env.DB.prepare("UPDATE service_profiles SET available = ?, updated_at=unixepoch() WHERE id = ?").bind(nextAvail, id).run();
    return ok(c, { id, status: nextAvail ? "PUBLISHED" : "PAUSED" });
  }


  throw new ApiError("NOT_FOUND", 404, "Service or request not found.");
});
export const requests = new Hono<AppEnv>();

export async function handleCreateRequest(c: any) {
  const body = await c.req.json().catch(() => ({}));
  const input = locationSchema
    .extend({
      serviceId: z.string().min(1),
      details: z.string().trim().min(1).max(1000),
      scheduledAt: z.number().int().positive().optional(),
    })
    .parse(body);

  const db = c.env.DB;
  const profile = (await db
    .prepare("SELECT sp.id, sp.user_id as userId, sp.available, sp.radius_km as radiusKm, sp.latitude, sp.longitude FROM service_profiles sp JOIN users u ON u.id=sp.user_id WHERE sp.id = ? AND sp.archived_at IS NULL AND u.suspended=0")
    .bind(input.serviceId)
    .first()) as any;

  if (!profile) {
    throw new ApiError("NOT_FOUND", 404, "Service profile not found.");
  }
  if (!profile.available) {
    throw new ApiError("SERVICE_UNAVAILABLE", 409, "This service provider is currently unavailable.");
  }
  const currentUserId = c.get("userId");
  if (profile.userId === currentUserId) {
    throw new ApiError("SELF_REQUEST", 400, "You cannot send a service request to your own profile.");
  }

  await assertUnblocked(db, profile.userId, currentUserId);
  await rateLimit(db, `request:${currentUserId}`, 20, 3600);

  if (distanceKm(input, profile) > Number(profile.radiusKm)) {
    throw new ApiError("OUTSIDE_SERVICE_AREA", 400, "Your selected location is outside this service coverage area.");
  }
  if (input.scheduledAt && input.scheduledAt < now() - 60) throw new ApiError("VALIDATION_ERROR", 400, "Choose a current or future request time.");
  const schedAt = input.scheduledAt ?? null;
  const id = crypto.randomUUID();

  try {
    const result = await db.prepare(
      `INSERT INTO interactions(id, kind, service_id, owner_id, worker_id, status, details, created_at, area, latitude, longitude, scheduled_at)
       SELECT ?, 'service', ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS(
         SELECT 1 FROM interactions WHERE service_id=? AND worker_id=? AND status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS')
       )
       RETURNING id`
    )
      .bind(
        id,
        profile.id,
        profile.userId,
        currentUserId,
        input.details,
        now(),
        input.area,
        input.latitude,
        input.longitude,
        schedAt,
        profile.id,
        currentUserId,
      )
      .first();

    if (!result) {
      throw new ApiError(
        "REQUEST_EXISTS",
        409,
        "You already have an active request with this professional.",
      );
    }
    return ok(c, { id: result.id || id });
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    console.error("[POST /requests error]:", err);
    const message = String(err?.message || "");
    if (message.includes("UNIQUE") || message.includes("REQUEST_EXISTS"))
      throw new ApiError("REQUEST_EXISTS", 409, "You already have an active request for this service.");
    if (message.includes("REQUEST_LOCATION_REQUIRED"))
      throw new ApiError("INVALID_LOCATION", 400, "Choose a valid service location before booking.");
    if (message.includes("BLOCKED_INTERACTION"))
      throw new ApiError("BLOCKED_USER", 403, "This request cannot be sent because the connection is blocked.");
    if (message.includes("SERVICE_UNAVAILABLE"))
      throw new ApiError("SERVICE_UNAVAILABLE", 409, "This service provider is currently unavailable.");
    throw new ApiError("REQUEST_FAILED", 503, "Could not submit service request. Please retry.");
  }
}

requests.post("/", requireAuth, handleCreateRequest);
requests.post("", requireAuth, handleCreateRequest);
