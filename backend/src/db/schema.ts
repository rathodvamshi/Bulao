import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const appAssets = sqliteTable('app_assets', {
  id:text('id').primaryKey(), groupName:text('group_name').notNull(),
  publicId:text('public_id').notNull(), url:text('url').notNull(),
  width:integer('width').notNull(),height:integer('height').notNull(),bytes:integer('bytes').notNull(),
  revision:text('revision').notNull(),updatedAt:integer('updated_at').notNull(),
});
export const uploadedImageAssets = sqliteTable('uploaded_image_assets', {
  id:text('id').primaryKey(), userId:text('user_id').notNull().references(()=>users.id),
  purpose:text('purpose',{enum:['profile','service']}).notNull(),
  thumbnailUrl:text('thumbnail_url').notNull(),mediumUrl:text('medium_url').notNull(),fullUrl:text('full_url').notNull(),
  createdAt:integer('created_at').notNull(),
},t=>[index('uploaded_image_assets_owner').on(t.userId,t.createdAt)]);
export const storyCollections = sqliteTable('story_collections', {
  id: text('id').primaryKey(),
  activeRevision: text('active_revision').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const storyImages = sqliteTable('story_images', {
  collectionId: text('collection_id').notNull(),
  revision: text('revision').notNull(),
  id: text('id').notNull(),
  sortOrder: integer('sort_order').notNull(),
  label: text('label').notNull(),
  publicId: text('public_id').notNull(),
  url: text('url').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes').notNull(),
  fit: text('fit', {enum:['contain','cover']}).notNull(),
  scale: real('scale').notNull().default(1),
  offset: real('offset').notNull().default(0.18),
}, t => [primaryKey({columns:[t.collectionId,t.revision,t.id]}),uniqueIndex('story_images_order').on(t.collectionId,t.revision,t.sortOrder)]);
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
  icon: text("icon").notNull().default("👤"),
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
    archivedAt: integer("archived_at"),
    deletedAt: integer("deleted_at"),
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
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    offeredServices: text("offered_services", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    phoneVisible: integer("phone_visible", { mode: "boolean" })
      .notNull()
      .default(false),
    socialLinks: text("social_links", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    serviceMode: text("service_mode", { enum: ["doorstep", "at_center", "both"] }),
    pricingModel: text("pricing_model", {
      enum: ["fixed", "hourly", "visit_quote"],
    }),
    basePricePaise: integer("base_price_paise"),
    operatingHours: text("operating_hours"),
    portfolioUrls: text("portfolio_urls", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    archivedAt: integer("archived_at"),
    createdAt: integer("created_at"),
    updatedAt: integer("updated_at"),
    wizardState: text("wizard_state", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (t) => [
    index("service_user_category").on(t.userId, t.categoryId),
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
    completionRejectedAt: integer("completion_rejected_at"),
    completionRejectedBy: text("completion_rejected_by").references(() => users.id),
    completionRejectionReason: text("completion_rejection_reason"),
    area: text("area"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    scheduledAt: integer("scheduled_at"),
    details: text("details").notNull().default(""),
    cancelledBy: text("cancelled_by").references(() => users.id),
    cancellationReason: text("cancellation_reason"),
    cancelledAt: integer("cancelled_at"),
    acceptedAt: integer("accepted_at"),
    rejectedAt: integer("rejected_at"),
    jobTitleSnapshot: text("job_title_snapshot"),
    roleNameSnapshot: text("role_name_snapshot"),
    payPaiseSnapshot: integer("pay_paise_snapshot"),
    payUnitSnapshot: text("pay_unit_snapshot"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("application_unique").on(t.jobId, t.workerId).where(sql`${t.kind}='job' AND ${t.status} IN ('PENDING','ACCEPTED','IN_PROGRESS','COMPLETED')`),
    index("interaction_owner").on(t.ownerId, t.status),
    index("interaction_worker").on(t.workerId, t.status),
    index("interaction_service_status").on(t.serviceId, t.status),
    uniqueIndex("active_service_request").on(t.serviceId, t.workerId).where(sql`${t.kind}='service' AND ${t.status} IN ('PENDING','ACCEPTED','IN_PROGRESS')`),
  ],
);
export const serviceOfflinePayments = sqliteTable("service_offline_payments", {
  interactionId: text("interaction_id").primaryKey().references(() => interactions.id),
  providerConfirmedAt: integer("provider_confirmed_at"),
  customerConfirmedAt: integer("customer_confirmed_at"),
  updatedAt: integer("updated_at").notNull(),
});
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    data: text("data"),
    read: integer("read").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.read, t.createdAt)],
);
export const pushDevices = sqliteTable(
  "push_devices",
  {
    installationId: text("installation_id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expoPushToken: text("expo_push_token").notNull().unique(),
    platform: text("platform", { enum: ["android"] }).notNull(),
    active: integer("active").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
  },
  (t) => [index("push_devices_user_active_idx").on(t.userId, t.active)],
);
export const notificationPushOutbox = sqliteTable(
  "notification_push_outbox",
  {
    notificationId: text("notification_id").primaryKey().references(() => notifications.id, { onDelete: "cascade" }),
    state: text("state", { enum: ["pending", "expanded"] }).notNull().default("pending"),
    createdAt: integer("created_at").notNull(),
    expandedAt: integer("expanded_at"),
  },
  (t) => [index("notification_push_outbox_pending_idx").on(t.state, t.createdAt)],
);
export const pushDeliveries = sqliteTable(
  "push_deliveries",
  {
    id: text("id").primaryKey(),
    notificationId: text("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
    installationId: text("installation_id").notNull().references(() => pushDevices.installationId, { onDelete: "cascade" }),
    state: text("state", { enum: ["pending", "queued", "sending", "receipt_pending", "accepted", "failed", "disabled"] }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at").notNull(),
    leaseUntil: integer("lease_until"),
    expoTicketId: text("expo_ticket_id"),
    receiptCheckedAt: integer("receipt_checked_at"),
    lastErrorCode: text("last_error_code"),
    lastError: text("last_error"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("push_delivery_notification_device_idx").on(t.notificationId, t.installationId),
    index("push_deliveries_dispatch_idx").on(t.state, t.nextAttemptAt, t.createdAt),
    index("push_deliveries_receipt_idx").on(t.state, t.receiptCheckedAt),
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
export const serviceRatings = sqliteTable("service_ratings", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull().references(() => serviceProfiles.id),
  providerId: text("provider_id").notNull().references(() => users.id),
  customerId: text("customer_id").notNull().references(() => users.id),
  stars: integer("stars").notNull(),
  feedback: text("feedback").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at"),
}, t => [uniqueIndex("unique_customer_service_rating").on(t.customerId,t.serviceId), index("service_ratings_service_id").on(t.serviceId), index("service_ratings_provider_id").on(t.providerId)]);
export const serviceReviewImages = sqliteTable("service_review_images", {
  id: text("id").primaryKey(),
  reviewId: text("review_id").notNull().references(() => serviceRatings.id),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
}, t => [index("service_review_images_review_id").on(t.reviewId)]);
export const serviceReviewReports = sqliteTable("service_review_reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull().references(() => users.id),
  reviewId: text("review_id").notNull(), // May reference either supported review table.
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

export const providerCommonProfiles = sqliteTable("provider_common_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id),
  providerType: text("provider_type", { enum: ["individual", "business", "team"] }).notNull().default("individual"),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  introduction: text("introduction").notNull().default(""),
  overallExperience: integer("overall_experience").notNull().default(0),
  languages: text("languages", { mode: "json" }).$type<string[]>().notNull().default(["English"]),
  alternatePhone: text("alternate_phone"),
  businessName: text("business_name"),
  teamSize: integer("team_size"),
  businessDescription: text("business_description"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const serviceOfferings = sqliteTable("service_offerings", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull().references(() => serviceProfiles.id),
  categoryId: text("category_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  pricingModel: text("pricing_model", { enum: ["fixed", "hourly", "per_day", "per_session", "per_month", "per_task", "price_range", "quote", "inspection"] }).notNull(),
  pricePaise: integer("price_paise"),
  minPricePaise: integer("min_price_paise"),
  maxPricePaise: integer("max_price_paise"),
  pricingUnit: text("pricing_unit").notNull().default("per task"),
  includedWork: text("included_work").notNull().default(""),
  additionalCharges: text("additional_charges").notNull().default(""),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  index("service_offerings_service").on(t.serviceId, t.isActive, t.sortOrder),
  index("service_offerings_category").on(t.categoryId, t.isActive),
]);

export const serviceCategorySchemas = sqliteTable("service_category_schemas", {
  categoryId: text("category_id").primaryKey().references(() => categories.id),
  schemaVersion: integer("schema_version").notNull().default(1),
  schemaJson: text("schema_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
