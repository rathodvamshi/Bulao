import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, isNull, inArray } from "drizzle-orm";
import type { AppEnv } from "../../config/env";
import {
  categories,
  serviceProfiles,
  providerCommonProfiles,
  serviceOfferings,
  serviceCategorySchemas,
  users,
} from "../../db/schema";
import { ApiError, ok } from "../../middleware/errors";
import { now, requireAuth } from "../auth/session";
import { CATEGORY_SCHEMAS } from "@bulao/domain";

export const marketplace = new Hono<AppEnv>();

// ── 1. GET /api/v1/service/categories ──
marketplace.get("/categories", async (c) => {
  const db = drizzle(c.env.DB);
  const [dbCategories, dbSchemas] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.kind, "service"))
      .all(),
    db
      .select({
        categoryId: serviceCategorySchemas.categoryId,
        schemaVersion: serviceCategorySchemas.schemaVersion,
        schemaJson: serviceCategorySchemas.schemaJson,
      })
      .from(serviceCategorySchemas)
      .all(),
  ]);

  const schemaMap = new Map<string, any>();
  for (const s of dbSchemas) {
    try {
      schemaMap.set(s.categoryId, JSON.parse(s.schemaJson));
    } catch {}
  }

  const result = dbCategories.map((cat) => {
    const schema = schemaMap.get(cat.id) || CATEGORY_SCHEMAS[cat.id];
    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      slug: schema?.slug || cat.id,
      schemaVersion: schema?.schemaVersion || 1,
      subcategories: schema?.subcategories || [],
      isPopular: [
        "mechanic",
        "plumber",
        "electrician",
        "ac",
        "appliance",
        "cleaner",
        "painter",
        "beauty-service",
        "mobile-repair",
        "tutoring",
      ].includes(cat.id),
    };
  });

  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  return ok(c, result);
});

// ── 2. GET /api/v1/service/categories/:id/schema ──
marketplace.get("/categories/:id/schema", async (c) => {
  const categoryId = c.req.param("id");
  const db = drizzle(c.env.DB);

  const row = await db
    .select()
    .from(serviceCategorySchemas)
    .where(eq(serviceCategorySchemas.categoryId, categoryId))
    .get();

  if (row) {
    try {
      const parsed = JSON.parse(row.schemaJson);
      c.header("Cache-Control", "no-cache, no-store, must-revalidate");
      return ok(c, parsed);
    } catch {}
  }

  // Fallback to in-memory domain taxonomy
  const fallback = CATEGORY_SCHEMAS[categoryId];
  if (!fallback) {
    throw new ApiError("NOT_FOUND", 404, "Category schema not found.");
  }

  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  return ok(c, fallback);
});

// ── 3. GET /api/v1/provider/service-profile ──
marketplace.get("/provider-profile", requireAuth, async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  const [common, serviceRows] = await Promise.all([
    db
      .select()
      .from(providerCommonProfiles)
      .where(eq(providerCommonProfiles.userId, userId))
      .get(),
    db
      .select()
      .from(serviceProfiles)
      .where(and(eq(serviceProfiles.userId, userId), isNull(serviceProfiles.archivedAt)))
      .all(),
  ]);

  const serviceIds = serviceRows.map((s) => s.id);
  const offerings = serviceIds.length
    ? await db
        .select()
        .from(serviceOfferings)
        .where(inArray(serviceOfferings.serviceId, serviceIds))
        .all()
    : [];

  const offeringsByService: Record<string, any[]> = {};
  for (const off of offerings) {
    const list = offeringsByService[off.serviceId] || [];
    list.push({
      id: off.id,
      serviceId: off.serviceId,
      categoryId: off.categoryId,
      name: off.name,
      description: off.description,
      pricingModel: off.pricingModel,
      pricePaise: off.pricePaise,
      minPricePaise: off.minPricePaise,
      maxPricePaise: off.maxPricePaise,
      pricingUnit: off.pricingUnit,
      includedWork: off.includedWork,
      additionalCharges: off.additionalCharges,
      isActive: Boolean(off.isActive),
      sortOrder: off.sortOrder,
    });
    offeringsByService[off.serviceId] = list;
  }

  const categoriesWithOfferings = serviceRows.map((s) => ({
    ...s,
    available: Boolean(s.available),
    phoneVisible: Boolean(s.phoneVisible),
    offerings: offeringsByService[s.id] || [],
  }));

  return ok(c, {
    commonProfile: common
      ? {
          ...common,
          languages: typeof common.languages === "string" ? JSON.parse(common.languages) : common.languages,
        }
      : null,
    categories: categoriesWithOfferings,
    totalCategories: categoriesWithOfferings.length,
    activeCategories: categoriesWithOfferings.filter((c) => c.available).length,
  });
});

// ── 4. POST /api/v1/provider/service-profile (Upsert Common Profile) ──
const commonProfileSchema = z.object({
  providerType: z.enum(["individual", "business", "team"]).default("individual"),
  displayName: z.string().trim().min(2).max(100),
  avatarUrl: z.string().optional().default(""),
  introduction: z.string().trim().max(2000).default(""),
  overallExperience: z.number().int().min(0).max(70).default(0),
  languages: z.array(z.string().trim().min(1)).min(1).default(["English"]),
  alternatePhone: z.string().trim().max(20).optional().default(""),
  businessName: z.string().trim().max(100).optional().default(""),
  teamSize: z.number().int().min(1).max(500).optional(),
  businessDescription: z.string().trim().max(2000).optional().default(""),
});

marketplace.post("/provider-profile", requireAuth, async (c) => {
  const userId = c.get("userId");
  const raw = await c.req.json().catch(() => ({}));
  const input = commonProfileSchema.parse(raw);
  const db = drizzle(c.env.DB);
  const nowTs = now();

  await db
    .insert(providerCommonProfiles)
    .values({
      userId,
      providerType: input.providerType,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl || null,
      introduction: input.introduction,
      overallExperience: input.overallExperience,
      languages: input.languages,
      alternatePhone: input.alternatePhone || null,
      businessName: input.businessName || null,
      teamSize: input.teamSize ?? null,
      businessDescription: input.businessDescription || null,
      createdAt: nowTs,
      updatedAt: nowTs,
    })
    .onConflictDoUpdate({
      target: providerCommonProfiles.userId,
      set: {
        providerType: input.providerType,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl || null,
        introduction: input.introduction,
        overallExperience: input.overallExperience,
        languages: input.languages,
        alternatePhone: input.alternatePhone || null,
        businessName: input.businessName || null,
        teamSize: input.teamSize ?? null,
        businessDescription: input.businessDescription || null,
        updatedAt: nowTs,
      },
    });

  return ok(c, { success: true, userId });
});

// ── 5. POST /api/v1/provider/service-profile/offerings (Create / Update Offering) ──
const offeringInputSchema = z.object({
  id: z.string().optional(),
  serviceId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional().default(""),
  pricingModel: z.enum([
    "fixed",
    "hourly",
    "per_day",
    "per_session",
    "per_month",
    "per_task",
    "price_range",
    "quote",
    "inspection",
  ]),
  pricePaise: z.number().int().min(0).optional(),
  minPricePaise: z.number().int().min(0).optional(),
  maxPricePaise: z.number().int().min(0).optional(),
  pricingUnit: z.string().trim().max(50).default("per task"),
  includedWork: z.string().trim().max(1000).optional().default(""),
  additionalCharges: z.string().trim().max(1000).optional().default(""),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

marketplace.post("/provider-profile/offerings", requireAuth, async (c) => {
  const userId = c.get("userId");
  const raw = await c.req.json().catch(() => ({}));
  const input = offeringInputSchema.parse(raw);
  const db = drizzle(c.env.DB);

  // Validate ownership of the parent service profile
  const service = await db
    .select()
    .from(serviceProfiles)
    .where(and(eq(serviceProfiles.id, input.serviceId), eq(serviceProfiles.userId, userId), isNull(serviceProfiles.archivedAt)))
    .get();

  if (!service) {
    throw new ApiError("NOT_FOUND", 404, "Service category profile not found.");
  }

  const id = input.id || crypto.randomUUID();
  const nowTs = now();

  await db
    .insert(serviceOfferings)
    .values({
      id,
      serviceId: input.serviceId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      pricingModel: input.pricingModel,
      pricePaise: input.pricePaise ?? null,
      minPricePaise: input.minPricePaise ?? null,
      maxPricePaise: input.maxPricePaise ?? null,
      pricingUnit: input.pricingUnit,
      includedWork: input.includedWork,
      additionalCharges: input.additionalCharges,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      createdAt: nowTs,
      updatedAt: nowTs,
    })
    .onConflictDoUpdate({
      target: serviceOfferings.id,
      set: {
        name: input.name,
        description: input.description,
        pricingModel: input.pricingModel,
        pricePaise: input.pricePaise ?? null,
        minPricePaise: input.minPricePaise ?? null,
        maxPricePaise: input.maxPricePaise ?? null,
        pricingUnit: input.pricingUnit,
        includedWork: input.includedWork,
        additionalCharges: input.additionalCharges,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        updatedAt: nowTs,
      },
    });

  return ok(c, { success: true, id, serviceId: input.serviceId });
});

// ── 6. DELETE /api/v1/provider/service-profile/offerings/:id ──
marketplace.delete("/provider-profile/offerings/:id", requireAuth, async (c) => {
  const offeringId = c.req.param("id");
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  const offering = await db
    .select({
      id: serviceOfferings.id,
      serviceId: serviceOfferings.serviceId,
      serviceOwnerId: serviceProfiles.userId,
    })
    .from(serviceOfferings)
    .innerJoin(serviceProfiles, eq(serviceProfiles.id, serviceOfferings.serviceId))
    .where(eq(serviceOfferings.id, offeringId))
    .get();

  if (!offering || offering.serviceOwnerId !== userId) {
    throw new ApiError("NOT_FOUND", 404, "Offering not found.");
  }

  await db.delete(serviceOfferings).where(eq(serviceOfferings.id, offeringId));
  return ok(c, { success: true, id: offeringId });
});

// ── 7. GET /api/v1/provider/service-profile/completion ──
marketplace.get("/provider-profile/completion", requireAuth, async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  const [common, services] = await Promise.all([
    db.select().from(providerCommonProfiles).where(eq(providerCommonProfiles.userId, userId)).get(),
    db.select().from(serviceProfiles).where(and(eq(serviceProfiles.userId, userId), isNull(serviceProfiles.archivedAt))).all(),
  ]);

  const missingCommon: string[] = [];
  if (!common?.displayName) missingCommon.push("Display name");
  if (!common?.introduction) missingCommon.push("Introduction");
  if (!common?.languages?.length) missingCommon.push("Languages");

  const categoryValidation: Record<string, { isComplete: boolean; errors: string[] }> = {};
  for (const s of services) {
    const errs: string[] = [];
    if (!s.area || !s.latitude || !s.longitude) errs.push("Service area & location");
    if (!s.title) errs.push("Service title");
    if (!s.offeredServices?.length) errs.push("At least one offered task or service");
    categoryValidation[s.categoryId] = {
      isComplete: errs.length === 0,
      errors: errs,
    };
  }

  const isReady = missingCommon.length === 0 && services.length > 0 && Object.values(categoryValidation).every((v) => v.isComplete);

  return ok(c, {
    isReadyToPublish: isReady,
    missingCommon,
    totalCategories: services.length,
    categoryValidation,
  });
});

// ── 8. POST /api/v1/provider/service-profile/publish (Atomic Publish) ──
marketplace.post("/provider-profile/publish", requireAuth, async (c) => {
  const userId = c.get("userId");
  const db = drizzle(c.env.DB);

  const [common, services] = await Promise.all([
    db.select().from(providerCommonProfiles).where(eq(providerCommonProfiles.userId, userId)).get(),
    db.select().from(serviceProfiles).where(and(eq(serviceProfiles.userId, userId), isNull(serviceProfiles.archivedAt))).all(),
  ]);

  if (!services.length) {
    throw new ApiError("NO_SERVICES", 400, "Please add at least one service category before publishing.");
  }

  // Atomically activate all provider categories
  await c.env.DB.prepare(
    "UPDATE service_profiles SET available = 1, updated_at = unixepoch() WHERE user_id = ? AND archived_at IS NULL"
  )
    .bind(userId)
    .run();

  return ok(c, {
    success: true,
    message: "Service profile published successfully.",
    publishedCategories: services.length,
  });
});

// ── 9. POST /api/v1/provider/service-profile/pause (Pause/Resume Profile or Category) ──
marketplace.post("/provider-profile/pause", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const categoryId = body.categoryId ? String(body.categoryId).trim() : null;
  const pause = body.pause === true || body.action === "pause";
  const newAvailable = pause ? 0 : 1;

  if (categoryId) {
    await c.env.DB.prepare(
      "UPDATE service_profiles SET available = ?, updated_at = unixepoch() WHERE user_id = ? AND category_id = ? AND archived_at IS NULL"
    )
      .bind(newAvailable, userId, categoryId)
      .run();
  } else {
    // Whole profile pause/resume
    await c.env.DB.prepare(
      "UPDATE service_profiles SET available = ?, updated_at = unixepoch() WHERE user_id = ? AND archived_at IS NULL"
    )
      .bind(newAvailable, userId)
      .run();
  }

  return ok(c, {
    success: true,
    status: pause ? "PAUSED" : "ACTIVE",
    categoryId: categoryId || "all",
  });
});
