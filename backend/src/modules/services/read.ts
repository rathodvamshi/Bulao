import type { Context } from "hono";
import type { AppEnv } from "../../config/env";
import { ApiError } from "../../middleware/errors";
import { identify } from "../auth/session";
import { assertUnblocked } from "../trust/permissions";

function array(value: string | null): string[] {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.filter(x => typeof x === "string") : []; }
  catch { return []; }
}
function object(value: string | null): Record<string, unknown> {
  try { const parsed = JSON.parse(value || "{}"); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}
function batches<T>(items: T[], size = 40): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
function missingServiceRatingSchema(error: unknown) {
  const message = String((error as Error)?.message ?? error);
  return /no such table:\s*(?:main\.)?service_ratings/i.test(message)
    || /no such column:\s*(?:(?:main\.)?service_ratings|sr)\.(?:id|service_id|stars|feedback|created_at|customer_id)/i.test(message);
}
function missingServiceInteractionSchema(error: unknown) {
  const message = String((error as Error)?.message ?? error);
  return /no such table:\s*(?:main\.)?interactions/i.test(message)
    || /no such column:\s*(?:(?:main\.)?interactions|i)\.service_id/i.test(message)
    || /no such column:\s*service_id/i.test(message);
}

// Explicit projection: never spread database rows containing private values into a response.
export async function readServices(c: Context<AppEnv>, options: { ownerId: string } | { id: string } | { providerId: string }) {
  const viewer = "ownerId" in options ? { id: options.ownerId } : await identify(c.env.DB, c.req.header("Authorization"));
  const lookup = "id" in options ? "s.id=?" : "s.user_id=?";
  const lookupId = "ownerId" in options ? options.ownerId : "providerId" in options ? options.providerId : options.id;
  const queryListings = (filterArchived: boolean) => c.env.DB.prepare(`SELECT s.*, c.name AS category_name, c.icon AS category_icon,
    u.name AS provider_name, u.photo_url AS provider_photo, u.phone AS provider_phone,
    u.phone_verified AS provider_verified, u.created_at AS member_since, u.suspended
    FROM service_profiles s JOIN users u ON u.id=s.user_id JOIN categories c ON c.id=s.category_id
    WHERE ${lookup}${filterArchived ? " AND s.archived_at IS NULL" : ""} ORDER BY s.id DESC`)
    .bind(lookupId).all<any>();
  let result;
  try {
    result = await queryListings(true);
  } catch (error) {
    // Older deployed databases may predate migration 0016, which introduced
    // archived_at. In that schema no rows can be archived, so omit only that
    // predicate and continue serving otherwise valid service profiles.
    if (!/no such column:\s*(?:s\.)?archived_at/i.test(String((error as Error)?.message ?? error))) throw error;
    console.warn(`[Service read compatibility] [${c.get("requestId")}] archived_at is not present; reading unarchived schema`);
    result = await queryListings(false);
  }
  if ("id" in options && !result.results.length) throw new ApiError("NOT_FOUND", 404, "Service unavailable.");
  if ("providerId" in options && viewer && viewer.id !== options.providerId) await assertUnblocked(c.env.DB, viewer.id, options.providerId);
  const rows = "providerId" in options ? result.results.filter(row => row.available === 1 && !row.suspended) : result.results;
  if ("id" in options && rows[0]) {
    const row = rows[0];
    if (row.user_id !== viewer?.id && (!row.available || row.suspended)) throw new ApiError("NOT_FOUND", 404, "Service unavailable.");
    if (viewer && row.user_id !== viewer.id) await assertUnblocked(c.env.DB, viewer.id, row.user_id);
  }
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const reviewRows: any[] = [];
  let warnedAboutLegacyRatings = false;
  let warnedAboutInteractionSchema = false;
  let warnedAboutReviewReadFailure = false;

  // Keep each IN query well below SQLite/D1's bind-variable ceiling, even for
  // providers who have accumulated a large number of service listings.
  for (const group of batches(ids)) {
    const marks = group.map(() => "?").join(",");
    try {
      const result = await c.env.DB.prepare(`
        SELECT sr.id, sr.service_id, sr.stars, sr.feedback AS body, sr.created_at, u.name AS author_name, u.photo_url AS author_photo
        FROM service_ratings sr JOIN users u ON u.id = sr.customer_id
        WHERE sr.service_id IN (${marks})
        ORDER BY sr.created_at DESC
      `).bind(...group).all<any>();
      reviewRows.push(...(result.results || []));
    } catch (error) {
      if (missingServiceRatingSchema(error)) {
        if (!warnedAboutLegacyRatings) {
          console.warn(`[Service read compatibility] [${c.get("requestId")}] service_ratings schema is unavailable; using interaction reviews`);
          warnedAboutLegacyRatings = true;
        }
        try {
          const result = await c.env.DB.prepare(`SELECT r.id,i.service_id,r.stars,r.body,r.created_at,
            u.name AS author_name,u.photo_url AS author_photo
            FROM reviews r JOIN interactions i ON i.id=r.interaction_id JOIN users u ON u.id=r.author_id
            WHERE i.service_id IN (${marks}) AND r.author_id=i.worker_id ORDER BY r.created_at DESC`)
            .bind(...group).all<any>();
          reviewRows.push(...(result.results || []));
        } catch (legacyError) {
          if (missingServiceInteractionSchema(legacyError)) {
            if (!warnedAboutInteractionSchema) {
              console.warn(`[Service read compatibility] [${c.get("requestId")}] interaction service history is unavailable; omitting legacy reviews and counts`);
              warnedAboutInteractionSchema = true;
            }
          } else if (!warnedAboutReviewReadFailure) {
            console.error(`[Service read degradation] [${c.get("requestId")}] Could not load legacy service ratings; returning listings without ratings`, legacyError);
            warnedAboutReviewReadFailure = true;
          }
        }
      } else if (missingServiceInteractionSchema(error)) {
        // Preserve current service_ratings when an older database lacks the
        // interaction service columns used only for migrated legacy reviews.
        try {
          const result = await c.env.DB.prepare(`SELECT sr.id,sr.service_id,sr.stars,sr.feedback AS body,sr.created_at,
            u.name AS author_name,u.photo_url AS author_photo
            FROM service_ratings sr JOIN users u ON u.id=sr.customer_id
            WHERE sr.service_id IN (${marks}) ORDER BY sr.created_at DESC`).bind(...group).all<any>();
          reviewRows.push(...(result.results || []));
        } catch (ratingError) {
          if (!missingServiceRatingSchema(ratingError) && !warnedAboutReviewReadFailure) {
            console.error(`[Service read degradation] [${c.get("requestId")}] Could not load dedicated service ratings; returning listings without ratings`, ratingError);
            warnedAboutReviewReadFailure = true;
          }
        }
        if (!warnedAboutInteractionSchema) {
          console.warn(`[Service read compatibility] [${c.get("requestId")}] interaction service history is unavailable; using dedicated ratings only`);
          warnedAboutInteractionSchema = true;
        }
      } else {
        // Reviews enrich a service listing but must not make the provider's
        // entire profile unavailable when a secondary read is unhealthy.
        if (!warnedAboutReviewReadFailure) {
          console.error(`[Service read degradation] [${c.get("requestId")}] Could not load service ratings; returning listings without ratings`, error);
          warnedAboutReviewReadFailure = true;
        }
      }
    }
  }
  reviewRows.sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));

  const reviewIds = reviewRows.map(r => r.id);
  const reviewImagesMap: Record<string, string[]> = {};
  if (reviewIds.length > 0) {
    for (const group of batches(reviewIds)) {
      const marks = group.map(() => "?").join(",");
      try {
        const imgResult = await c.env.DB.prepare(`
          SELECT review_id, image_url
          FROM service_review_images
          WHERE review_id IN (${marks})
          ORDER BY sort_order ASC
        `).bind(...group).all<any>();
        for (const row of imgResult.results || []) {
          if (!reviewImagesMap[row.review_id]) reviewImagesMap[row.review_id] = [];
          reviewImagesMap[row.review_id]?.push(row.image_url);
        }
      } catch {
        // Graceful fallback if service_review_images table is not yet migrated
      }
    }
  }

  const counts: any[] = [];
  if (!warnedAboutInteractionSchema) {
    for (const group of batches(ids)) {
      const marks = group.map(() => "?").join(",");
      try {
        const result = await c.env.DB.prepare(`SELECT service_id,COUNT(*) AS total FROM interactions
          WHERE service_id IN (${marks}) AND status='COMPLETED' GROUP BY service_id`).bind(...group).all<any>();
        counts.push(...(result.results || []));
      } catch (error) {
        if (missingServiceInteractionSchema(error)) {
          if (!warnedAboutInteractionSchema) console.warn(`[Service read compatibility] [${c.get("requestId")}] interaction service history is unavailable; completed counts default to zero`);
          warnedAboutInteractionSchema = true;
        } else {
          console.error(`[Service read degradation] [${c.get("requestId")}] Could not load completed service counts; defaulting to zero`, error);
        }
        break;
      }
    }
  }

  const offeringsRows: any[] = [];
  for (const group of batches(ids)) {
    const marks = group.map(() => "?").join(",");
    try {
      const result = await c.env.DB.prepare(`SELECT id, service_id, category_id, name, description,
        pricing_model, price_paise, min_price_paise, max_price_paise, pricing_unit, included_work, additional_charges, sort_order, created_at
        FROM service_offerings WHERE service_id IN (${marks}) AND is_active = 1 ORDER BY sort_order ASC, created_at ASC`)
        .bind(...group).all<any>();
      offeringsRows.push(...(result.results || []));
    } catch (error) {
      // Offerings are an optional newer feature; keep core service profiles
      // readable on databases that have not applied its migration yet.
      console.error(`[Service read degradation] [${c.get("requestId")}] Could not load optional service offerings`, error);
      break;
    }
  }
  return rows.map(row => {
    try {
      const owner = viewer?.id === row.user_id;
    const wizard = object(row.wizard_state);
    const shopPhotos = wizard.shopPhotos;
    const shopPhotoUrl = Array.isArray(shopPhotos)
      ? shopPhotos.find((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url)) ?? null
      : null;
    const reviews = reviewRows.filter(r => r.service_id === row.id);
    const totalReviews = reviews.length;
    const rating = totalReviews ? Math.round(reviews.reduce((sum, r) => sum + r.stars, 0) / totalReviews * 10) / 10 : null;
    const serviceOfferings = offeringsRows.filter(o => o.service_id === row.id).map(o => ({
      id: o.id,
      serviceId: o.service_id,
      categoryId: o.category_id,
      name: o.name,
      description: o.description,
      pricingModel: o.pricing_model,
      pricePaise: o.price_paise,
      minPricePaise: o.min_price_paise,
      maxPricePaise: o.max_price_paise,
      pricingUnit: o.pricing_unit,
      includedWork: o.included_work,
      additionalCharges: o.additional_charges,
      sortOrder: o.sort_order,
    }));
    return {
      id: row.id, providerId: row.user_id, categoryId: row.category_id, createdAt: row.created_at, updatedAt: row.updated_at,
      categoryName: row.category_name, categoryIcon: row.category_icon,
      title: row.title, description: row.description, offeredServices: array(row.offered_services),
      offerings: serviceOfferings.length > 0 ? serviceOfferings : (Array.isArray(wizard.offerings) ? wizard.offerings : []),
      dynamicAnswers: wizard.dynamicAnswers || {},
      area: row.area, latitude: row.latitude, longitude: row.longitude, radiusKm: row.radius_km,
      experienceYears: row.experience, available: row.available === 1, phoneVisible: row.phone_visible === 1,
      serviceMode: row.service_mode || null, pricingModel: row.pricing_model || null,
      basePricePaise: row.base_price_paise, operatingHours: row.operating_hours,
      portfolioUrls: array(row.portfolio_urls), shopPhotoUrl, socialLinks: Object.fromEntries(Object.entries(object(row.social_links)).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      ...(owner ? { wizardState: object(row.wizard_state) } : {}),
      rating, totalReviews, isNew: totalReviews === 0,
      completedBookings: counts.find(x => x.service_id === row.id)?.total ?? 0,
      ratingBreakdown: Object.fromEntries([1,2,3,4,5].map(stars => [`stars${stars}`, reviews.filter(r => r.stars === stars).length])),
      provider: { id: row.user_id, name: row.provider_name, photoUrl: row.provider_photo,
        phone: owner || row.phone_visible === 1 ? row.provider_phone : null,
        verified: row.provider_verified === 1, memberSince: row.member_since },
      reviews: reviews.slice(0,50).map(r => ({ id: r.id, stars: r.stars, body: r.body, feedback: r.body, createdAt: r.created_at,
        authorName: r.author_name, authorPhoto: r.author_photo, images: reviewImagesMap[r.id] || [] })),
    };
    } catch (rowError) {
      console.error(`[Service map error] [${c.get("requestId")}] Failed to map row ${row?.id}:`, rowError);
      return null;
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null);
}
