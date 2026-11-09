import type { Env } from "../../config/env";
import { createNotification } from "../notifications/service";
import { dispatchPendingPushes } from "../notifications/push";

export interface JobForMatching {
  id: string;
  ownerId: string;
  categoryId: string;
  roleId: string;
  title: string;
  area: string;
  latitude: number;
  longitude: number;
  payPaise: number;
  payUnit: string;
}

/**
 * Great-circle distance between two coordinates in kilometers (Haversine formula).
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface CandidateRow {
  userId: string;
  hasCategoryProfile: number;
  hasPastCategoryHistory: number;
  userArea: string | null;
  savedLat: number | null;
  savedLng: number | null;
}

/**
 * Matches relevant candidates (workers/specialists) for a freshly posted job
 * based on role/category affinity, past application history, and geo-proximity.
 * Runs asynchronously via ctx.waitUntil so job creation remains sub-25ms.
 */
export async function matchAndNotifyNearbyWorkers(job: JobForMatching, env: Env): Promise<number> {
  const nowSec = Math.floor(Date.now() / 1000);
  const twelveHoursAgo = nowSec - 12 * 3600;

  try {
    // 1. Query candidate pool from D1 with safety, trust, and spam gates:
    // Rules:
    // - User must have an ACTIVE push device (meaning permission was explicitly granted)
    // - User is NOT the job poster
    // - User has NOT blocked or been blocked by the job poster
    // - User has NOT already been notified about this specific job (dedupe)
    // - User has NOT received a new-job alert in the last 12 hours (anti-spam frequency cap)
    // - User account is active (not suspended)
    const candidatesQuery = await env.DB.prepare(`
      SELECT 
        pd.user_id as userId,
        MAX(CASE WHEN sp.id IS NOT NULL THEN 1 ELSE 0 END) as hasCategoryProfile,
        MAX(CASE WHEN prev_int.id IS NOT NULL THEN 1 ELSE 0 END) as hasPastCategoryHistory,
        u.area as userArea,
        COALESCE(ul.latitude, sp_loc.latitude) as savedLat,
        COALESCE(ul.longitude, sp_loc.longitude) as savedLng
      FROM push_devices pd
      JOIN users u ON u.id = pd.user_id
      LEFT JOIN service_profiles sp ON sp.user_id = pd.user_id 
        AND sp.status = 'ACTIVE' 
        AND (sp.category_id = ? OR sp.role_id = ?)
      LEFT JOIN interactions prev_int ON prev_int.worker_id = pd.user_id 
        AND prev_int.kind = 'job'
        AND prev_int.job_id IN (SELECT id FROM jobs WHERE category_id = ? OR role_id = ?)
      LEFT JOIN user_locations ul ON ul.user_id = pd.user_id AND ul.is_default = 1
      LEFT JOIN saved_places sp_loc ON sp_loc.user_id = pd.user_id
      WHERE pd.active = 1
        AND pd.user_id <> ?
        AND u.suspended = 0
        -- Trust gate: neither user has blocked the other
        AND pd.user_id NOT IN (
          SELECT target_id FROM blocks WHERE user_id = ?
          UNION
          SELECT user_id FROM blocks WHERE target_id = ?
        )
        -- Deduplication gate: never notify the same worker twice for this exact job
        AND pd.user_id NOT IN (
          SELECT user_id 
          FROM notifications 
          WHERE type = 'NEW_JOB_NEARBY' 
            AND json_extract(data, '$.jobId') = ?
        )
        -- Anti-spam gate: max 1 job alert per worker per 12 hours
        AND pd.user_id NOT IN (
          SELECT user_id 
          FROM notifications 
          WHERE type = 'NEW_JOB_NEARBY' 
            AND created_at > ?
        )
      GROUP BY pd.user_id
      LIMIT 100;
    `).bind(
      job.categoryId,
      job.roleId,
      job.categoryId,
      job.roleId,
      job.ownerId,
      job.ownerId,
      job.ownerId,
      job.id,
      twelveHoursAgo
    ).all<CandidateRow>();

    const candidateRows = candidatesQuery.results || [];
    if (candidateRows.length === 0) {
      return 0;
    }

    // 2. Score and rank candidates based on multi-signal matching
    const scoredCandidates: Array<{ userId: string; score: number; distanceKm: number | null }> = [];
    const hasJobCoords =
      typeof job.latitude === "number" &&
      typeof job.longitude === "number" &&
      !isNaN(job.latitude) &&
      !isNaN(job.longitude) &&
      (job.latitude !== 0 || job.longitude !== 0);

    for (const c of candidateRows) {
      let score = 0;
      let distanceKm: number | null = null;

      // Signal A: Role / Category profile match (+50 pts)
      if (c.hasCategoryProfile) {
        score += 50;
      }

      // Signal B: Past application or work history in this category (+30 pts)
      if (c.hasPastCategoryHistory) {
        score += 30;
      }

      // Signal C: Area text match (+15 pts)
      if (c.userArea && job.area && c.userArea.toLowerCase().includes(job.area.toLowerCase())) {
        score += 15;
      }

      // Signal D: Geo-distance from coordinates
      if (
        hasJobCoords &&
        c.savedLat != null &&
        c.savedLng != null &&
        !isNaN(c.savedLat) &&
        !isNaN(c.savedLng) &&
        (c.savedLat !== 0 || c.savedLng !== 0)
      ) {
        distanceKm = haversineKm(job.latitude, job.longitude, c.savedLat, c.savedLng);

        if (distanceKm <= 3) {
          score += 40;
        } else if (distanceKm <= 7) {
          score += 25;
        } else if (distanceKm <= 15) {
          score += 10;
        } else if (distanceKm > 25) {
          // If too far (> 25 km) and no direct category match, skip
          if (!c.hasCategoryProfile && !c.hasPastCategoryHistory) {
            continue;
          }
          score -= 15;
        }
      } else {
        // If candidate doesn't have exact GPS coordinates yet, but has category match: give baseline
        if (!c.hasCategoryProfile && !c.hasPastCategoryHistory) {
          continue;
        }
      }

      if (score > 0) {
        scoredCandidates.push({ userId: c.userId, score, distanceKm });
      }
    }

    // Sort by score descending and take the top 25 candidates
    scoredCandidates.sort((a, b) => b.score - a.score);
    const topCandidates = scoredCandidates.slice(0, 25);

    if (topCandidates.length === 0) {
      return 0;
    }

    // 3. Format clean, high-conversion localized copy
    const payFormatted =
      job.payPaise > 0
        ? `₹${Math.round(job.payPaise / 100).toLocaleString("en-IN")}${job.payUnit ? `/${job.payUnit}` : ""}`
        : "Good Pay";

    const jobTitle = job.title?.trim() || "Work Opportunity";
    const notificationTitle = `New Work: ${jobTitle}`;
    const notificationMessage = `${payFormatted} in ${job.area || "your area"}. Tap to review and apply.`;

    // 4. Create notification records for each candidate
    // Note: Do not pass env inside the loop so dispatch runs once as an atomic batch below
    for (const candidate of topCandidates) {
      await createNotification(
        env.DB,
        {
          userId: candidate.userId,
          recipientRole: "provider",
          type: "NEW_JOB_NEARBY",
          title: notificationTitle,
          message: notificationMessage,
          data: {
            jobId: job.id,
            role: "provider",
            context: "work",
          },
        }
      );
    }

    // 5. Instantly trigger push dispatch in one unified batch
    if (env.PUSH_DELIVERIES) {
      await dispatchPendingPushes(env).catch((err) => {
        console.error("Match push batch dispatch error:", err);
      });
    }

    console.log(
      JSON.stringify({
        event: "NEARBY_JOB_NOTIFICATIONS_SENT",
        jobId: job.id,
        matchedCount: topCandidates.length,
      })
    );

    return topCandidates.length;
  } catch (error) {
    console.error("Failed to match and notify nearby workers:", error);
    return 0;
  }
}
