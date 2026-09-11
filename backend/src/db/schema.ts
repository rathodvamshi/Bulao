import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull().default(""),
  area: text("area").notNull().default(""),
  suspended: integer("suspended").notNull().default(0),
  photoUrl: text("photo_url"),
  createdAt: integer("created_at").notNull(),
  phoneVerified: integer("phone_verified").notNull().default(0),
  updatedAt: integer("updated_at"),
  lastLoginAt: integer("last_login_at"),
});
export const sessions = sqliteTable("sessions", {
  hash: text("hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at"),
  revokedAt: integer("revoked_at"),
}, (t) => [index("sessions_user_id").on(t.userId), index("sessions_expires_at").on(t.expiresAt)]);
export const authEvents = sqliteTable("auth_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  userId: text("user_id").references(() => users.id),
  phoneHash: text("phone_hash"),
  ipHash: text("ip_hash"),
  eventType: text("event_type").notNull(),
  createdAt: integer("created_at").notNull(),
  success: integer("success").notNull(),
  code: text("code"),
}, (t) => [index("auth_events_user_id").on(t.userId), index("auth_events_created_at").on(t.createdAt), index("auth_events_request_id").on(t.requestId)]);
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["job", "service"] }).notNull(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
});
export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  name: text("name").notNull(),
});
export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  area: text("area").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
});
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    area: text("area").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    startsAt: integer("starts_at").notNull(),
    workers: integer("workers").notNull(),
    payPaise: integer("pay_paise").notNull(),
    payUnit: text("pay_unit").notNull(),
    submissionKey: text("submission_key"),
    title: text("title").notNull().default(""),
    experience: text("experience").notNull().default("any"),
    address: text("address").notNull().default(""),
    duration: text("duration").notNull().default("one"),
    endsAt: integer("ends_at"),
    hours: text("hours").notNull().default("full"),
    startTime: text("start_time").notNull().default("09:00"),
    endTime: text("end_time").notNull().default("17:00"),
    paidWhen: text("paid_when").notNull().default("after"),
    extras: text("extras", { mode: "json" }).$type<string[]>().notNull().default([]),
    details: text("details").notNull(),
    status: text("status").notNull().default("PUBLISHED"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("jobs_discovery").on(t.status, t.categoryId, t.latitude)],
);
export const serviceProfiles = sqliteTable(
  "service_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    area: text("area").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    radiusKm: real("radius_km").notNull(),
    experience: integer("experience").notNull(),
    available: integer("available", { mode: "boolean" }).notNull(),
  },
  (t) => [
    uniqueIndex("service_user_category").on(t.userId, t.categoryId),
    index("service_discovery").on(t.categoryId, t.available, t.latitude),
  ],
);
export const interactions = sqliteTable(
  "interactions",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["job", "service"] }).notNull(),
    jobId: text("job_id").references(() => jobs.id),
    serviceId: text("service_id").references(() => serviceProfiles.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    workerId: text("worker_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("PENDING"),
    ownerConfirmedAt: integer("owner_confirmed_at"),
    workerConfirmedAt: integer("worker_confirmed_at"),
    area: text("area"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    scheduledAt: integer("scheduled_at"),
    details: text("details").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("application_unique").on(t.jobId, t.workerId),
    index("interaction_owner").on(t.ownerId, t.status),
    index("interaction_worker").on(t.workerId, t.status),
  ],
);
export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    interactionId: text("interaction_id")
      .notNull()
      .references(() => interactions.id),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    targetId: text("target_id")
      .notNull()
      .references(() => users.id),
    stars: integer("stars").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("review_once").on(t.interactionId, t.authorId),
    index("review_target").on(t.targetId),
  ],
);
export const blocks = sqliteTable(
  "blocks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    targetId: text("target_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [uniqueIndex("block_once").on(t.userId, t.targetId)],
);
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id),
  targetId: text("target_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const otpChallenges = sqliteTable(
  "otp_challenges",
  {
    id: text("id").primaryKey(),
    phone: text("phone").notNull(),
    expiresAt: integer("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    used: integer("used").notNull().default(0),
    provider: text("provider").notNull().default("development"),
  },
  (t) => [index("otp_expiry").on(t.expiresAt)],
);
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    bucket: integer("bucket").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.bucket] })],
);
export const providerUsage = sqliteTable(
  "provider_usage",
  {
    provider: text("provider").notNull(),
    service: text("service").notNull(),
    period: text("period").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.provider, t.service, t.period] })],
);
export const imageIntents = sqliteTable(
  "image_intents",
  {
    assetId: text("asset_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("image_intent_expiry").on(t.expiresAt)],
);
export const otpCooldowns = sqliteTable("otp_cooldowns", {
  phoneHash: text("phone_hash").primaryKey(),
  sentAt: integer("sent_at").notNull(),
});

export const savedPlaces = sqliteTable("saved_places", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  label: text("label").notNull(), // Home, Shop, Site, or custom name
  icon: text("icon").notNull().default("📍"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  locality: text("locality").notNull(),
  address: text("address").notNull().default(""),
  lastUsedAt: integer("last_used_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => [
  index("saved_places_user").on(t.userId, t.lastUsedAt),
]);

export const userLocations = sqliteTable(
  "user_locations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    label: text("label", { enum: ["Home", "Work", "Other"] }).notNull(),
    area: text("area").notNull(),
    address: text("address").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at"),
  },
  (t) => [index("user_locations_user_id").on(t.userId)],
);

