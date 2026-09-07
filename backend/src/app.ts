import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { ZodError, z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { AppEnv } from "./config/env";
import { users, categories, roles, locations } from "./db/schema";
import { ApiError, ok } from "./middleware/errors";
import { auth } from "./modules/auth/routes";
import { requireAuth } from "./modules/auth/session";
import { jobRoutes } from "./modules/jobs/routes";
import { services, requests } from "./modules/services/routes";
import { interactions } from "./modules/interactions/routes";
import { trust } from "./modules/trust/routes";
import { images } from "./modules/images/routes";
import { profiles } from "./modules/profiles/routes";
import { consumeAuthEvents } from "./modules/auth/audit";
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
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
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
app.route("/api/v1/auth", auth);
app.route("/api/auth", auth);
app.route("/api/v1/images", images);
app.route("/api/v1/profiles", profiles);
app.get("/api/v1/categories", async (c) => {
  const db = drizzle(c.env.DB);
  const [categoryRows, roleRows, locationRows] = await Promise.all([
    db.select().from(categories),
    db.select().from(roles),
    db.select().from(locations),
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
    })
    .from(users)
    .where(eq(users.id, c.get("userId")))
    .get();
  return ok(c, user);
});
app.patch("/api/v1/users/me", requireAuth, async (c) => {
  const input = z
    .object({
      name: z.string().trim().min(2).max(60),
      area: z.string().trim().min(2).max(100),
    })
    .parse(await c.req.json());
  await drizzle(c.env.DB)
    .update(users)
    .set(input)
    .where(eq(users.id, c.get("userId")));
  return ok(c, input);
});
app.get("/api/v1/activity", requireAuth, async (c) => {
  const uid = c.get("userId");
  const [rows, owned] = await Promise.all([
    c.env.DB.prepare(
      "SELECT i.id,i.kind,i.status,i.owner_id AS ownerId,i.worker_id AS workerId,i.owner_confirmed_at AS ownerConfirmedAt,i.worker_confirmed_at AS workerConfirmedAt,i.details,COALESCE(r.name,c.name) AS title,u.name AS otherName,EXISTS(SELECT 1 FROM reviews WHERE interaction_id=i.id AND author_id=?) AS reviewed FROM interactions i LEFT JOIN jobs j ON j.id=i.job_id LEFT JOIN roles r ON r.id=j.role_id LEFT JOIN service_profiles s ON s.id=i.service_id LEFT JOIN categories c ON c.id=s.category_id JOIN users u ON u.id=CASE WHEN i.owner_id=? THEN i.worker_id ELSE i.owner_id END WHERE i.owner_id=? OR i.worker_id=? ORDER BY i.created_at DESC LIMIT 100",
    )
      .bind(uid, uid, uid, uid)
      .all(),
    c.env.DB.prepare(
      "SELECT j.id,r.name AS title,j.status FROM jobs j JOIN roles r ON r.id=j.role_id WHERE owner_id=? ORDER BY j.created_at DESC LIMIT 100",
    )
      .bind(uid)
      .all(),
  ]);
  return ok(c, { interactions: rows.results, jobs: owned.results });
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
app.route("/api/v1/services", services);
app.route("/api/v1/service-requests", requests);
app.route("/api/v1/applications", interactions);
app.route("/api/v1/service-requests", interactions);
app.route("/api/v1", trust);
export { app };
export default { fetch: app.fetch, queue: consumeAuthEvents };
