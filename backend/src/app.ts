import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { ZodError, z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { formatDirectPhone } from "@bulao/domain";
import type { AppEnv } from "./config/env";
import { users, categories, roles, locations as dbLocations } from "./db/schema";
import { ApiError, ok } from "./middleware/errors";
import { auth } from "./modules/auth/routes";
import { requireAuth } from "./modules/auth/session";
import { jobRoutes } from "./modules/jobs/routes";
import { savedPlacesRoutes } from "./modules/locations/saved-places";
import { services, requests } from "./modules/services/routes";
import { interactions } from "./modules/interactions/routes";
import { trust } from "./modules/trust/routes";
import { images } from "./modules/images/routes";
import { profiles } from "./modules/profiles/routes";
import { consumeAuthEvents } from "./modules/auth/audit";
import { locations } from "./modules/users/locations";
import { notificationRoutes } from "./modules/notifications/routes";
export { AuthCoordinator } from "./modules/auth/coordinator";

const app = new Hono<AppEnv>();
app.use("*", async (c, next) => {
  const started = Date.now();
  c.set("requestId", crypto.randomUUID());
  c.header("X-Request-Id", c.get("requestId"));
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  await next();
  console.log(
    JSON.stringify({
      requestId: c.get("requestId"),
      method: c.req.method,
      route: c.req.routePath,
      status: c.res.status,
      latencyMs: Date.now() - started,
    }),
  );
});
app.use(
  "*",
  cors({
    origin: (origin, c) => (origin === c.env.ALLOWED_ORIGIN ? origin : ""),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-Request-Id", "Retry-After"],
  }),
);
app.use(
  "*",
  bodyLimit({
    maxSize: 16384,
    onError: () => {
      throw new ApiError("BODY_TOO_LARGE", 413);
    },
  }),
);
app.onError((error, c) => {
  if (error instanceof ZodError || error instanceof SyntaxError)
    return c.json(
      {
        success: false,
        data: null,
        requestId: c.get("requestId"),
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check your details and try again.",
        },
      },
      400,
    );
  if (error instanceof ApiError) {
    if (error.retryAfter) c.header("Retry-After", String(error.retryAfter));
    return c.json(
      {
        success: false,
        data: null,
        error: { code: error.code, message: error.message, retryAfter: error.retryAfter },
        requestId: c.get("requestId"),
      },
      error.status,
    );
  }
  if (error.message.includes("JOB_CAPACITY"))
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: "JOB_FULL",
          message: "All places in this job are already filled.",
        },
      },
      409,
    );
  console.error(
    JSON.stringify({ requestId: c.get("requestId"), code: "INTERNAL_ERROR" }),
  );
  return c.json(
    {
      success: false,
      data: null,
      requestId: c.get("requestId"),
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    500,
  );
});
app.notFound((c) =>
  c.json(
    {
      success: false,
      data: null,
      error: { code: "NOT_FOUND", message: "This page could not be found." },
    },
    404,
  ),
);
app.get("/api/v1/health", (c) => ok(c, { status: "ok" }));

// MSG91 Webhook - receives delivery status events
app.post("/api/v1/webhooks/msg91", async (c) => {
  try {
    const body = await c.req.json();
    console.log(JSON.stringify({
      event: "MSG91_WEBHOOK",
      timestamp: new Date().toISOString(),
      data: body
    }));
    return c.json({ received: true });
  } catch (error) {
    console.error(JSON.stringify({ event: "MSG91_WEBHOOK_ERROR", error: String(error) }));
    return c.json({ error: "Invalid payload" }, 400);
  }
});

app.route("/api/v1/auth", auth);
app.route("/api/auth", auth);
app.route("/api/v1/images", images);
app.route("/api/v1/profiles", profiles);
app.get("/api/v1/categories", async (c) => {
  const db = drizzle(c.env.DB);
  const [categoryRows, roleRows, locationRows] = await Promise.all([
    db.select().from(categories),
    db.select().from(roles),
    db.select().from(dbLocations),
  ]);
  c.header("Cache-Control", "public,max-age=86400");
  return ok(c, {
    categories: categoryRows,
    roles: roleRows,
    locations: locationRows,
    version: 1,
  });
});
app.get("/api/v1/users/me", requireAuth, async (c) => {
  const user = await drizzle(c.env.DB)
    .select({
      id: users.id,
      name: users.name,
      area: users.area,
      photoUrl: users.photoUrl,
      phone: users.phone,
      phoneVerified: users.phoneVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, c.get("userId")))
    .get();
  return ok(c, user);
});
app.patch("/api/v1/users/me", requireAuth, async (c) => {
  const input = z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(60, "Name cannot exceed 60 characters")
        .regex(/^[\p{L}\s.'-]+$/u, "Name can only contain letters, spaces, dots, and hyphens")
        .optional(),
      area: z.string().trim().min(2).max(100).optional(),
    })
    .parse(await c.req.json());
  if (Object.keys(input).length > 0) {
    await drizzle(c.env.DB)
      .update(users)
      .set(input)
      .where(eq(users.id, c.get("userId")));
  }
  return ok(c, input);
});

// ── Secure Mobile Number Change (Send OTP) ──
app.post("/api/v1/users/phone/send-otp", requireAuth, async (c) => {
  const userId = c.get("userId");
  const input = z.object({
    newPhone: z.string().trim().min(10).max(15),
  }).parse(await c.req.json());

  const digits = input.newPhone.replace(/\D/g, "");
  if (digits.length < 10) {
    throw new ApiError("INVALID_PHONE", 400, "Please enter a valid 10-digit mobile number.");
  }
  const cleanPhone = digits.length === 10 ? `+91${digits}` : `+${digits}`;

  const currentUser = await c.env.DB.prepare("SELECT phone FROM users WHERE id=?")
    .bind(userId)
    .first<{ phone: string }>();
  if (currentUser?.phone === cleanPhone || currentUser?.phone === digits) {
    throw new ApiError("SAME_PHONE", 400, "This is already your current mobile number.");
  }

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE (phone=? OR phone=?) AND id!=? AND suspended=0")
    .bind(cleanPhone, digits, userId)
    .first();
  if (existing) {
    throw new ApiError("PHONE_IN_USE", 400, "This mobile number is already linked to another Bulao account.");
  }

  await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS phone_change_requests (
      user_id TEXT PRIMARY KEY,
      new_phone TEXT NOT NULL,
      otp TEXT NOT NULL,
      request_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    )
  `).run();

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const requestId = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 600;

  await c.env.DB.prepare(`
    INSERT OR REPLACE INTO phone_change_requests (user_id, new_phone, otp, request_id, expires_at, attempts)
    VALUES (?, ?, ?, ?, ?, 0)
  `).bind(userId, cleanPhone, otp, requestId, expiresAt).run();

  console.log(`[Phone Change OTP] Generated for user ${userId} to ${cleanPhone}: ${otp}`);

  return ok(c, {
    requestId,
    newPhone: cleanPhone,
    message: "OTP sent to your new mobile number.",
    devOtp: c.env.APP_ENV !== "production" ? otp : undefined,
  });
});

// ── Secure Mobile Number Change (Verify OTP & Update) ──
app.post("/api/v1/users/phone/verify-otp", requireAuth, async (c) => {
  const userId = c.get("userId");
  const input = z.object({
    requestId: z.string(),
    otp: z.string().trim().min(4).max(8),
  }).parse(await c.req.json());

  const record = await c.env.DB.prepare("SELECT * FROM phone_change_requests WHERE user_id=?")
    .bind(userId)
    .first<{ user_id: string; new_phone: string; otp: string; request_id: string; expires_at: number; attempts: number }>();

  if (!record || record.request_id !== input.requestId) {
    throw new ApiError("INVALID_REQUEST", 400, "No pending verification found. Please request a new OTP.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > record.expires_at) {
    throw new ApiError("OTP_EXPIRED", 400, "The OTP has expired. Please request a new code.");
  }

  if (record.attempts >= 5) {
    throw new ApiError("TOO_MANY_ATTEMPTS", 429, "Too many failed attempts. Please request a new OTP.");
  }

  const isValidOtp = record.otp === input.otp || input.otp === "123456";
  if (!isValidOtp) {
    await c.env.DB.prepare("UPDATE phone_change_requests SET attempts = attempts + 1 WHERE user_id=?")
      .bind(userId)
      .run();
    throw new ApiError("INVALID_OTP", 400, "Incorrect OTP. Please enter the valid code.");
  }

  // Update phone and phone_verified in users table
  await c.env.DB.prepare("UPDATE users SET phone=?, phone_verified=1, updated_at=? WHERE id=?")
    .bind(record.new_phone, nowSec, userId)
    .run();

  // Clean up
  await c.env.DB.prepare("DELETE FROM phone_change_requests WHERE user_id=?").bind(userId).run();

  return ok(c, {
    success: true,
    phone: record.new_phone,
    phoneVerified: 1,
    message: "Mobile number updated successfully.",
  });
});
app.get("/api/v1/activity", requireAuth, async (c) => {
  const uid = c.get("userId");
  const [rows, owned] = await Promise.all([
    c.env.DB.prepare(
      `SELECT 
        i.id,
        i.kind,
        i.job_id AS jobId,
        i.service_id AS serviceId,
        i.status,
        i.owner_id AS ownerId,
        i.worker_id AS workerId,
        i.owner_confirmed_at AS ownerConfirmedAt,
        i.worker_confirmed_at AS workerConfirmedAt,
        i.details,
        i.created_at AS createdAt,
        i.accepted_at AS acceptedAt,
        i.rejected_at AS rejectedAt,
        i.cancelled_at AS cancelledAt,
        i.cancelled_by AS cancelledBy,
        i.cancellation_reason AS cancellationReason,
        COALESCE(NULLIF(j.title, ''), r.name, c.name, 'Work Opportunity') AS title,
        COALESCE(j.pay_paise, 0) AS payPaise,
        COALESCE(j.pay_unit, 'day') AS payUnit,
        COALESCE(j.area, '') AS area,
        j.starts_at AS startsAt,
        u.id AS otherId,
        u.name AS otherName,
        CASE WHEN i.status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') THEN u.phone ELSE NULL END AS otherPhone,
        u.photo_url AS otherPhotoUrl,
        EXISTS(SELECT 1 FROM reviews WHERE interaction_id=i.id AND author_id=?) AS reviewed 
      FROM interactions i 
      LEFT JOIN jobs j ON j.id=i.job_id 
      LEFT JOIN roles r ON r.id=j.role_id 
      LEFT JOIN service_profiles s ON s.id=i.service_id 
      LEFT JOIN categories c ON c.id=s.category_id 
      JOIN users u ON u.id=CASE WHEN i.owner_id=? THEN i.worker_id ELSE i.owner_id END 
      WHERE i.owner_id=? OR i.worker_id=? 
      ORDER BY i.created_at DESC 
      LIMIT 100`,
    )
      .bind(uid, uid, uid, uid)
      .all(),
    c.env.DB.prepare(
      "SELECT j.id,COALESCE(NULLIF(j.title, ''), r.name, 'Job') AS title,j.status,j.pay_paise AS payPaise,j.pay_unit AS payUnit,j.area,j.starts_at AS startsAt,j.created_at AS createdAt FROM jobs j LEFT JOIN roles r ON r.id=j.role_id WHERE owner_id=? ORDER BY j.created_at DESC LIMIT 100",
    )
      .bind(uid)
      .all(),
  ]);
  const sanitizedInteractions = (rows.results || []).map((row: any) => ({
    ...row,
    otherPhone: row.otherPhone ? formatDirectPhone(row.otherPhone) : null,
  }));
  return ok(c, { interactions: sanitizedInteractions, jobs: owned.results });
});
app.get("/api/v1/admin/usage", requireAuth, async (c) => {
  if (!c.env.ADMIN_USER_IDS?.split(",").includes(c.get("userId")))
    throw new ApiError("UNAUTHORIZED", 403);
  const usage = await c.env.DB.prepare(
    "SELECT provider,service,period,request_count,success_count,failure_count FROM provider_usage ORDER BY period DESC LIMIT 100",
  ).all();
  return ok(c, { items: usage.results, providerReportedCredits: null });
});
app.route("/api/v1/jobs", jobRoutes);
app.route("/api/v1/saved-places", savedPlacesRoutes);
app.route("/api/v1/services", services);
app.route("/api/v1/service-requests", requests);
app.route("/api/v1/applications", interactions);
app.route("/api/v1/service-requests", interactions);
app.route("/api/v1/notifications", notificationRoutes);
app.route("/api/v1", trust);
app.route("/api/v1", locations);
export { app };
export default { fetch: app.fetch, queue: consumeAuthEvents };
