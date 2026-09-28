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

// Explicit projection: never spread database rows containing private values into a response.
export async function readServices(c: Context<AppEnv>, options: { ownerId: string } | { id: string } | { providerId: string }) {
  const viewer = "ownerId" in options ? { id: options.ownerId } : await identify(c.env.DB, c.req.header("Authorization"));
  const result = await c.env.DB.prepare(`SELECT s.*, c.name AS category_name, c.icon AS category_icon,
    u.name AS provider_name, u.photo_url AS provider_photo, u.phone AS provider_phone,
    u.phone_verified AS provider_verified, u.created_at AS member_since, u.suspended
    FROM service_profiles s JOIN users u ON u.id=s.user_id JOIN categories c ON c.id=s.category_id
    WHERE ${"id" in options ? "s.id=?" : "s.user_id=?"} AND s.archived_at IS NULL ORDER BY s.id DESC`)
    .bind("ownerId" in options ? options.ownerId : "providerId" in options ? options.providerId : options.id).all<any>();
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
  const marks = ids.map(() => "?").join(",");
  // A customer's dedicated service rating supersedes their older interaction review.
  const reviewRows = await c.env.DB.prepare(`SELECT sr.id,sr.service_id,sr.stars,sr.feedback AS body,sr.created_at,u.name AS author_name,u.photo_url AS author_photo
    FROM service_ratings sr JOIN users u ON u.id=sr.customer_id WHERE sr.service_id IN (${marks})
    UNION ALL SELECT r.id,i.service_id,r.stars,r.body,r.created_at,u.name,u.photo_url
    FROM reviews r JOIN interactions i ON i.id=r.interaction_id JOIN users u ON u.id=r.author_id
    WHERE i.service_id IN (${marks}) AND r.author_id=i.worker_id
    AND NOT EXISTS(SELECT 1 FROM service_ratings sr WHERE sr.service_id=i.service_id AND sr.customer_id=r.author_id)
    ORDER BY created_at DESC`).bind(...ids, ...ids).all<any>();
  const counts = await c.env.DB.prepare(`SELECT service_id,COUNT(*) AS total FROM interactions
    WHERE service_id IN (${marks}) AND status='COMPLETED' GROUP BY service_id`).bind(...ids).all<any>();
  return rows.map(row => {
    const owner = viewer?.id === row.user_id;
    const shopPhotos = object(row.wizard_state).shopPhotos;
    const shopPhotoUrl = Array.isArray(shopPhotos)
      ? shopPhotos.find((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url)) ?? null
      : null;
    const reviews = reviewRows.results.filter(r => r.service_id === row.id);
    const totalReviews = reviews.length;
    const rating = totalReviews ? Math.round(reviews.reduce((sum, r) => sum + r.stars, 0) / totalReviews * 10) / 10 : null;
    return {
      id: row.id, providerId: row.user_id, categoryId: row.category_id, createdAt: row.created_at, updatedAt: row.updated_at,
      categoryName: row.category_name, categoryIcon: row.category_icon,
      title: row.title, description: row.description, offeredServices: array(row.offered_services),
      area: row.area, latitude: row.latitude, longitude: row.longitude, radiusKm: row.radius_km,
      experienceYears: row.experience, available: row.available === 1, phoneVisible: row.phone_visible === 1,
      serviceMode: row.service_mode || null, pricingModel: row.pricing_model || null,
      basePricePaise: row.base_price_paise, operatingHours: row.operating_hours,
      portfolioUrls: array(row.portfolio_urls), shopPhotoUrl, socialLinks: Object.fromEntries(Object.entries(object(row.social_links)).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      ...(owner ? { wizardState: object(row.wizard_state) } : {}),
      rating, totalReviews, isNew: totalReviews === 0,
      completedBookings: counts.results.find(x => x.service_id === row.id)?.total ?? 0,
      ratingBreakdown: Object.fromEntries([1,2,3,4,5].map(stars => [`stars${stars}`, reviews.filter(r => r.stars === stars).length])),
      provider: { id: row.user_id, name: row.provider_name, photoUrl: row.provider_photo,
        phone: owner || row.phone_visible === 1 ? row.provider_phone : null,
        verified: row.provider_verified === 1, memberSince: row.member_since },
      reviews: reviews.slice(0,50).map(r => ({ id: r.id, stars: r.stars, body: r.body, createdAt: r.created_at,
        authorName: r.author_name, authorPhoto: r.author_photo })),
    };
  });
}
