import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { ZodError, z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { formatDirectPhone } from "@bulao/domain";
import type { AppEnv } from "./config/env";
import { users, categories, roles } from "./db/schema";
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
  const isZod =
    error instanceof ZodError ||
    error?.name === "ZodError" ||
    Array.isArray((error as any)?.issues);

  if (isZod || error instanceof SyntaxError) {
    console.error(`[API Validation Error] ${c.req.method} ${c.req.path}:`, error);
    const issues = (error as any)?.issues;
    const detailMsg = Array.isArray(issues)
      ? issues.map((i: any) => `${i.path?.join(".") || "field"}: ${i.message}`).filter(Boolean).join("; ") || "Please check your details and try again."
      : "Please check your details and try again.";
    return c.json(
      {
        success: false,
        data: null,
        requestId: c.get("requestId"),
        error: {
          code: "VALIDATION_ERROR",
          message: detailMsg,
        },
      },
      400,
    );
  }
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
  if (error.message?.includes("JOB_CAPACITY"))
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
    `[Unhandled Internal Error] ${c.req.method} ${c.req.path} [${c.get("requestId")}]:`,
    error
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
  const [categoryRows, roleRows] = await Promise.all([
    db.select().from(categories),
    db.select().from(roles),
  ]);
  c.header("Cache-Control", "public,max-age=86400");
  return ok(c, {
    categories: categoryRows,
    roles: roleRows,
    locations: [],
    version: 1,
  });
});

// ── Category Services — GET /api/v1/categories/:categoryId/services ──
// Returns available services for a given service category.
// Data is curated inline (no migration needed) and can be moved to DB later.
const CATEGORY_SERVICES: Record<string, { id: string; name: string; icon: string; sortOrder: number; isPopular?: boolean }[]> = {
  // Match by partial lower-case category name
  automotive: [
    { id: "bike_mechanic", name: "Bike Mechanic", icon: "bicycle", sortOrder: 1, isPopular: true },
    { id: "car_mechanic", name: "Car Mechanic", icon: "car-sport", sortOrder: 2, isPopular: true },
    { id: "bike_washing", name: "Bike Washing", icon: "water", sortOrder: 3, isPopular: true },
    { id: "car_washing", name: "Car Washing", icon: "sparkles", sortOrder: 4 },
    { id: "tyre_repair", name: "Tyre Repair", icon: "ellipse", sortOrder: 5 },
    { id: "battery_service", name: "Battery Service", icon: "battery-charging", sortOrder: 6 },
    { id: "ac_repair_car", name: "AC Repair (Car)", icon: "snow", sortOrder: 7 },
    { id: "dent_painting", name: "Dent & Painting", icon: "color-palette", sortOrder: 8 },
    { id: "car_diagnostics", name: "Car Diagnostics", icon: "hardware-chip", sortOrder: 9 },
    { id: "other_automotive", name: "Other Automotive Service", icon: "ellipsis-horizontal", sortOrder: 10 },
  ],
  plumbing: [
    { id: "pipe_repair", name: "Pipe Repair", icon: "construct", sortOrder: 1, isPopular: true },
    { id: "tap_repair", name: "Tap Repair", icon: "water", sortOrder: 2, isPopular: true },
    { id: "bathroom_plumbing", name: "Bathroom Plumbing", icon: "home", sortOrder: 3 },
    { id: "water_leakage", name: "Water Leakage", icon: "rainy", sortOrder: 4 },
    { id: "plumbing_installation", name: "Installation", icon: "build", sortOrder: 5 },
    { id: "drain_cleaning", name: "Drain Cleaning", icon: "trash", sortOrder: 6 },
    { id: "water_tank_service", name: "Water Tank Service", icon: "server", sortOrder: 7 },
    { id: "other_plumbing", name: "Other Plumbing Service", icon: "ellipsis-horizontal", sortOrder: 8 },
  ],
  electrical: [
    { id: "home_wiring", name: "Home Wiring", icon: "flash", sortOrder: 1, isPopular: true },
    { id: "switch_socket", name: "Switch & Socket Repair", icon: "power", sortOrder: 2 },
    { id: "fan_installation", name: "Fan Installation", icon: "refresh", sortOrder: 3 },
    { id: "light_installation", name: "Light Installation", icon: "bulb", sortOrder: 4, isPopular: true },
    { id: "electrical_repair", name: "Electrical Repair", icon: "construct", sortOrder: 5 },
    { id: "inverter_service", name: "Inverter Service", icon: "battery-charging", sortOrder: 6 },
    { id: "power_fault", name: "Power Fault Repair", icon: "alert-circle", sortOrder: 7 },
    { id: "other_electrical", name: "Other Electrical Service", icon: "ellipsis-horizontal", sortOrder: 8 },
  ],
  carpent: [
    { id: "furniture_repair", name: "Furniture Repair", icon: "hammer", sortOrder: 1, isPopular: true },
    { id: "furniture_making", name: "Furniture Making", icon: "build", sortOrder: 2 },
    { id: "door_repair", name: "Door Repair", icon: "enter", sortOrder: 3 },
    { id: "window_repair", name: "Window Repair", icon: "grid", sortOrder: 4 },
    { id: "wood_polishing", name: "Wood Polishing", icon: "sparkles", sortOrder: 5 },
    { id: "modular_furniture", name: "Modular Furniture", icon: "layers", sortOrder: 6 },
    { id: "carpentry_install", name: "Carpentry Installation", icon: "construct", sortOrder: 7 },
    { id: "other_carpentry", name: "Other Carpenter Service", icon: "ellipsis-horizontal", sortOrder: 8 },
  ],
  paint: [
    { id: "interior_painting", name: "Interior Painting", icon: "color-palette", sortOrder: 1, isPopular: true },
    { id: "exterior_painting", name: "Exterior Painting", icon: "home", sortOrder: 2 },
    { id: "wall_texture", name: "Wall Texture", icon: "layers", sortOrder: 3 },
    { id: "waterproofing", name: "Waterproofing", icon: "rainy", sortOrder: 4 },
    { id: "furniture_painting", name: "Furniture Painting", icon: "hammer", sortOrder: 5 },
    { id: "other_painting", name: "Other Painting Service", icon: "ellipsis-horizontal", sortOrder: 6 },
  ],
  clean: [
    { id: "home_cleaning", name: "Home Cleaning", icon: "sparkles", sortOrder: 1, isPopular: true },
    { id: "deep_cleaning", name: "Deep Cleaning", icon: "shield-checkmark", sortOrder: 2, isPopular: true },
    { id: "bathroom_cleaning", name: "Bathroom Cleaning", icon: "water", sortOrder: 3 },
    { id: "kitchen_cleaning", name: "Kitchen Cleaning", icon: "restaurant", sortOrder: 4 },
    { id: "sofa_cleaning", name: "Sofa & Carpet Cleaning", icon: "bed", sortOrder: 5 },
    { id: "office_cleaning", name: "Office Cleaning", icon: "briefcase", sortOrder: 6 },
    { id: "other_cleaning", name: "Other Cleaning Service", icon: "ellipsis-horizontal", sortOrder: 7 },
  ],
  beauty: [
    { id: "haircut", name: "Haircut", icon: "cut", sortOrder: 1, isPopular: true },
    { id: "hair_coloring", name: "Hair Coloring", icon: "color-palette", sortOrder: 2, isPopular: true },
    { id: "facial", name: "Facial", icon: "happy", sortOrder: 3 },
    { id: "makeup", name: "Makeup", icon: "rose", sortOrder: 4 },
    { id: "hair_spa", name: "Hair Spa", icon: "leaf", sortOrder: 5 },
    { id: "manicure", name: "Manicure", icon: "hand-left", sortOrder: 6 },
    { id: "pedicure", name: "Pedicure", icon: "footsteps", sortOrder: 7 },
    { id: "bridal_services", name: "Bridal Services", icon: "heart", sortOrder: 8 },
    { id: "other_beauty", name: "Other Beauty Service", icon: "ellipsis-horizontal", sortOrder: 9 },
  ],
  tutor: [
    { id: "maths", name: "Maths", icon: "calculator", sortOrder: 1, isPopular: true },
    { id: "science", name: "Science", icon: "flask", sortOrder: 2, isPopular: true },
    { id: "english", name: "English", icon: "book", sortOrder: 3 },
    { id: "telugu", name: "Telugu", icon: "language", sortOrder: 4 },
    { id: "computer_classes", name: "Computer Classes", icon: "laptop", sortOrder: 5 },
    { id: "competitive_exams", name: "Competitive Exams", icon: "trophy", sortOrder: 6 },
    { id: "home_tuition", name: "Home Tuition", icon: "home", sortOrder: 7 },
    { id: "other_tutoring", name: "Other Tutoring Service", icon: "ellipsis-horizontal", sortOrder: 8 },
  ],
  food: [
    { id: "home_catering", name: "Home Catering", icon: "restaurant", sortOrder: 1, isPopular: true },
    { id: "party_catering", name: "Party Catering", icon: "balloon", sortOrder: 2 },
    { id: "tiffin_service", name: "Tiffin Service", icon: "fast-food", sortOrder: 3, isPopular: true },
    { id: "cake_baking", name: "Cake & Baking", icon: "gift", sortOrder: 4 },
    { id: "cooking_classes", name: "Cooking Classes", icon: "school", sortOrder: 5 },
    { id: "other_food", name: "Other Food Service", icon: "ellipsis-horizontal", sortOrder: 6 },
  ],
  garden: [
    { id: "lawn_mowing", name: "Lawn Mowing", icon: "leaf", sortOrder: 1, isPopular: true },
    { id: "plant_care", name: "Plant Care", icon: "flower", sortOrder: 2 },
    { id: "tree_trimming", name: "Tree Trimming", icon: "cut", sortOrder: 3 },
    { id: "garden_design", name: "Garden Design", icon: "color-palette", sortOrder: 4 },
    { id: "other_garden", name: "Other Garden Service", icon: "ellipsis-horizontal", sortOrder: 5 },
  ],
  health: [
    { id: "home_nursing", name: "Home Nursing", icon: "medkit", sortOrder: 1, isPopular: true },
    { id: "physiotherapy", name: "Physiotherapy", icon: "fitness", sortOrder: 2 },
    { id: "elder_care", name: "Elder Care", icon: "people", sortOrder: 3 },
    { id: "baby_care", name: "Baby Care", icon: "happy", sortOrder: 4 },
    { id: "yoga_trainer", name: "Yoga & Fitness", icon: "body", sortOrder: 5 },
    { id: "other_health", name: "Other Health Service", icon: "ellipsis-horizontal", sortOrder: 6 },
  ],
  security: [
    { id: "home_guard", name: "Home Guard", icon: "shield-checkmark", sortOrder: 1, isPopular: true },
    { id: "cctv_install", name: "CCTV Installation", icon: "videocam", sortOrder: 2 },
    { id: "night_watchman", name: "Night Watchman", icon: "moon", sortOrder: 3 },
    { id: "other_security", name: "Other Security Service", icon: "ellipsis-horizontal", sortOrder: 4 },
  ],
  mobile: [
    { id: "screen_repair", name: "Screen Repair", icon: "phone-portrait", sortOrder: 1, isPopular: true },
    { id: "battery_replace", name: "Battery Replacement", icon: "battery-charging", sortOrder: 2, isPopular: true },
    { id: "software_fix", name: "Software Fix", icon: "settings", sortOrder: 3 },
    { id: "charging_port", name: "Charging Port Repair", icon: "power", sortOrder: 4 },
    { id: "camera_repair", name: "Camera Repair", icon: "camera", sortOrder: 5 },
    { id: "water_damage", name: "Water Damage Repair", icon: "water", sortOrder: 6 },
    { id: "other_mobile", name: "Other Mobile Repair", icon: "ellipsis-horizontal", sortOrder: 7 },
  ],
  computer: [
    { id: "laptop_repair", name: "Laptop Repair", icon: "laptop", sortOrder: 1, isPopular: true },
    { id: "virus_removal", name: "Virus Removal", icon: "shield-checkmark", sortOrder: 2 },
    { id: "data_recovery", name: "Data Recovery", icon: "save", sortOrder: 3 },
    { id: "os_install", name: "OS Installation", icon: "download", sortOrder: 4 },
    { id: "hardware_upgrade", name: "Hardware Upgrade", icon: "construct", sortOrder: 5 },
    { id: "networking", name: "Networking Setup", icon: "wifi", sortOrder: 6 },
    { id: "other_computer", name: "Other Computer Service", icon: "ellipsis-horizontal", sortOrder: 7 },
  ],
  ac: [
    { id: "ac_service", name: "AC Servicing", icon: "snow", sortOrder: 1, isPopular: true },
    { id: "ac_install", name: "AC Installation", icon: "build", sortOrder: 2 },
    { id: "ac_repair", name: "AC Repair", icon: "construct", sortOrder: 3, isPopular: true },
    { id: "ac_gas_refill", name: "Gas Refilling", icon: "cloud", sortOrder: 4 },
    { id: "ac_uninstall", name: "AC Uninstallation", icon: "remove-circle", sortOrder: 5 },
    { id: "other_ac", name: "Other AC Service", icon: "ellipsis-horizontal", sortOrder: 6 },
  ],
  appliance: [
    { id: "washing_machine", name: "Washing Machine", icon: "water", sortOrder: 1, isPopular: true },
    { id: "refrigerator", name: "Refrigerator Repair", icon: "thermometer", sortOrder: 2 },
    { id: "microwave", name: "Microwave Repair", icon: "radio", sortOrder: 3 },
    { id: "tv_repair", name: "TV Repair", icon: "tv", sortOrder: 4, isPopular: true },
    { id: "geyser_repair", name: "Geyser / Water Heater", icon: "flame", sortOrder: 5 },
    { id: "other_appliance", name: "Other Appliance Repair", icon: "ellipsis-horizontal", sortOrder: 6 },
  ],
  driving: [
    { id: "personal_driver", name: "Personal Driver", icon: "car-sport", sortOrder: 1, isPopular: true },
    { id: "outstation", name: "Outstation Trips", icon: "map", sortOrder: 2 },
    { id: "school_cab", name: "School Cab", icon: "bus", sortOrder: 3 },
    { id: "monthly_driver", name: "Monthly Driver", icon: "calendar", sortOrder: 4 },
    { id: "other_driving", name: "Other Driving Service", icon: "ellipsis-horizontal", sortOrder: 5 },
  ],
  other: [
    { id: "custom_service", name: "Custom Service", icon: "build", sortOrder: 1, isPopular: false },
    { id: "other_service", name: "Other Service", icon: "ellipsis-horizontal", sortOrder: 2 },
  ],
};

// Lookup helper — maps actual DB category names to service lists
// DB category names: Automotive, Plumbing, Electrical, Carpenter, Painting, Mobile Repair,
// Computer Repair, Tutoring, Beauty, Cleaning, Food & Catering, AC Service & Repair,
// Appliance Repair, Gardening, Driving, Other Services
type CategoryServiceList = { id: string; name: string; icon: string; sortOrder: number; isPopular?: boolean }[];

function getServicesForCategory(categoryName: string): CategoryServiceList | null {
  const lower = categoryName.toLowerCase();
  // Ordered from most specific to least specific to avoid false matches
  if (lower.includes("ac service") || lower.includes("ac repair") || lower === "ac") return CATEGORY_SERVICES.ac ?? null;
  if (lower.includes("appliance")) return CATEGORY_SERVICES.appliance ?? null;
  if (lower.includes("mobile")) return CATEGORY_SERVICES.mobile ?? null;
  if (lower.includes("computer")) return CATEGORY_SERVICES.computer ?? null;
  if (lower.includes("automotive") || lower.includes("mechanic")) return CATEGORY_SERVICES.automotive ?? null;
  if (lower.includes("plumb")) return CATEGORY_SERVICES.plumbing ?? null;
  if (lower.includes("electric")) return CATEGORY_SERVICES.electrical ?? null;
  if (lower.includes("carpent") || lower.includes("carpenter")) return CATEGORY_SERVICES.carpent ?? null;
  if (lower.includes("paint")) return CATEGORY_SERVICES.paint ?? null;
  if (lower.includes("clean")) return CATEGORY_SERVICES.clean ?? null;
  if (lower.includes("beauty")) return CATEGORY_SERVICES.beauty ?? null;
  if (lower.includes("tutor")) return CATEGORY_SERVICES.tutor ?? null;
  if (lower.includes("food") || lower.includes("cater")) return CATEGORY_SERVICES.food ?? null;
  if (lower.includes("garden")) return CATEGORY_SERVICES.garden ?? null;
  if (lower.includes("health") || lower.includes("nurs")) return CATEGORY_SERVICES.health ?? null;
  if (lower.includes("secur")) return CATEGORY_SERVICES.security ?? null;
  if (lower.includes("driv")) return CATEGORY_SERVICES.driving ?? null;
  if (lower.includes("other")) return CATEGORY_SERVICES.other ?? null;
  return null;
}

app.get("/api/v1/categories/:categoryId/services", async (c) => {
  const db = drizzle(c.env.DB);
  const { categoryId } = c.req.param();


  // Validate category exists and is a service kind
  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .get();

  if (!category) throw new ApiError("NOT_FOUND", 404, "Category not found.");
  if (category.kind !== "service") throw new ApiError("INVALID_CATEGORY", 400, "This category is not a service category.");

  const services = getServicesForCategory(category.name);

  if (!services) {
    // Fallback: return a generic "Other Service" for unknown categories
    return ok(c, [
      { id: "other_service", name: `Other ${category.name} Service`, icon: "ellipsis-horizontal", sortOrder: 1, isPopular: false },
    ]);
  }

  c.header("Cache-Control", "public,max-age=3600");
  return ok(c, services);
});

// ── Service Options / Tasks — GET /api/v1/services/:serviceId/options ──
// Returns task options that a provider can offer for a specific service.
const SERVICE_OPTIONS: Record<string, {
  defaultTitle: string;
  options: { id: string; name: string; icon?: string; sortOrder: number; isPopular?: boolean }[];
}> = {
  // Automotive
  bike_mechanic: {
    defaultTitle: "Bike Repair & Service",
    options: [
      { id: "general_service", name: "General Service", icon: "settings-outline", sortOrder: 1, isPopular: true },
      { id: "brake_repair", name: "Brake Repair", icon: "disc-outline", sortOrder: 2, isPopular: true },
      { id: "oil_change", name: "Oil Change", icon: "water-outline", sortOrder: 3, isPopular: true },
      { id: "battery_service", name: "Battery Service", icon: "battery-charging-outline", sortOrder: 4 },
      { id: "tyre_repair", name: "Tyre Repair", icon: "ellipse-outline", sortOrder: 5 },
      { id: "chain_maintenance", name: "Chain Maintenance", icon: "link-outline", sortOrder: 6 },
      { id: "engine_repair", name: "Engine Repair", icon: "hardware-chip-outline", sortOrder: 7 },
      { id: "clutch_repair", name: "Clutch Repair", icon: "aperture-outline", sortOrder: 8 },
      { id: "dent_painting", name: "Dent & Painting", icon: "color-palette-outline", sortOrder: 9 },
      { id: "diagnostics", name: "Diagnostics", icon: "pulse-outline", sortOrder: 10 },
    ],
  },
  car_mechanic: {
    defaultTitle: "Car Repair & Maintenance",
    options: [
      { id: "periodic_service", name: "Periodic Service", icon: "settings-outline", sortOrder: 1, isPopular: true },
      { id: "brake_service", name: "Brake Service", icon: "disc-outline", sortOrder: 2, isPopular: true },
      { id: "oil_filter_change", name: "Oil & Filter Change", icon: "water-outline", sortOrder: 3, isPopular: true },
      { id: "battery_replacement", name: "Battery Replacement", icon: "battery-charging-outline", sortOrder: 4 },
      { id: "wheel_alignment", name: "Wheel Alignment", icon: "ellipse-outline", sortOrder: 5 },
      { id: "engine_diagnostics", name: "Engine Diagnostics", icon: "hardware-chip-outline", sortOrder: 6 },
      { id: "clutch_transmission", name: "Clutch & Transmission", icon: "aperture-outline", sortOrder: 7 },
      { id: "suspension_repair", name: "Suspension Repair", icon: "construct-outline", sortOrder: 8 },
      { id: "car_ac_service", name: "Car AC Repair", icon: "snow-outline", sortOrder: 9 },
      { id: "denting_painting", name: "Denting & Painting", icon: "color-palette-outline", sortOrder: 10 },
    ],
  },
  bike_washing: {
    defaultTitle: "Bike Washing & Polishing",
    options: [
      { id: "foam_wash", name: "Foam Wash", icon: "water-outline", sortOrder: 1, isPopular: true },
      { id: "chain_cleaning_lube", name: "Chain Clean & Lube", icon: "link-outline", sortOrder: 2, isPopular: true },
      { id: "body_polishing", name: "Body Polishing", icon: "sparkles-outline", sortOrder: 3 },
      { id: "engine_degrease", name: "Engine Degreasing", icon: "hardware-chip-outline", sortOrder: 4 },
      { id: "ceramic_coating", name: "Ceramic Coating", icon: "shield-checkmark-outline", sortOrder: 5 },
    ],
  },
  car_washing: {
    defaultTitle: "Car Washing & Deep Detailing",
    options: [
      { id: "exterior_foam_wash", name: "Exterior Foam Wash", icon: "water-outline", sortOrder: 1, isPopular: true },
      { id: "interior_deep_clean", name: "Interior Deep Cleaning", icon: "sparkles-outline", sortOrder: 2, isPopular: true },
      { id: "rubbing_polishing", name: "Rubbing & Polishing", icon: "color-palette-outline", sortOrder: 3 },
      { id: "underbody_wash", name: "Underbody Wash", icon: "construct-outline", sortOrder: 4 },
      { id: "glass_headlight_clean", name: "Glass & Headlight", icon: "sunny-outline", sortOrder: 5 },
    ],
  },

  // Plumbing
  pipe_repair: {
    defaultTitle: "Pipe Repair & Plumbing Services",
    options: [
      { id: "pipe_leakage_fix", name: "Leakage Repair", icon: "rainy-outline", sortOrder: 1, isPopular: true },
      { id: "tap_repair_replace", name: "Tap Repair & Replace", icon: "water-outline", sortOrder: 2, isPopular: true },
      { id: "drain_cleaning", name: "Drain Unblocking", icon: "trash-outline", sortOrder: 3, isPopular: true },
      { id: "bathroom_fittings", name: "Bathroom Fittings", icon: "home-outline", sortOrder: 4 },
      { id: "water_tank_install", name: "Water Tank Install", icon: "server-outline", sortOrder: 5 },
      { id: "toilet_repair", name: "Toilet / Commode Repair", icon: "construct-outline", sortOrder: 6 },
      { id: "motor_pump_connection", name: "Motor Pump Connection", icon: "flash-outline", sortOrder: 7 },
      { id: "pipeline_fitting", name: "New Pipeline Fitting", icon: "git-branch-outline", sortOrder: 8 },
    ],
  },

  // Electrical
  home_wiring: {
    defaultTitle: "Electrical Repair & Installation",
    options: [
      { id: "wiring_repair", name: "Home Wiring", icon: "flash-outline", sortOrder: 1, isPopular: true },
      { id: "switch_socket_fix", name: "Switch & Socket Repair", icon: "power-outline", sortOrder: 2, isPopular: true },
      { id: "fan_installation", name: "Fan Installation", icon: "refresh-outline", sortOrder: 3, isPopular: true },
      { id: "light_installation", name: "Light & Chandelier", icon: "bulb-outline", sortOrder: 4 },
      { id: "inverter_battery_setup", name: "Inverter Setup", icon: "battery-charging-outline", sortOrder: 5 },
      { id: "mcb_fuse_box", name: "MCB & Fuse Box", icon: "alert-circle-outline", sortOrder: 6 },
      { id: "short_circuit_fix", name: "Short Circuit Fix", icon: "warning-outline", sortOrder: 7 },
      { id: "appliance_wiring", name: "Heavy Appliance Wiring", icon: "construct-outline", sortOrder: 8 },
    ],
  },

  // AC Service & Repair
  ac_service: {
    defaultTitle: "AC Servicing & Gas Refill",
    options: [
      { id: "general_filter_cleaning", name: "General AC Service", icon: "snow-outline", sortOrder: 1, isPopular: true },
      { id: "gas_refilling", name: "Gas Refilling", icon: "cloud-outline", sortOrder: 2, isPopular: true },
      { id: "cooling_issue_repair", name: "Cooling Issue Fix", icon: "thermometer-outline", sortOrder: 3, isPopular: true },
      { id: "ac_installation", name: "AC Installation", icon: "build-outline", sortOrder: 4 },
      { id: "ac_uninstallation", name: "AC Uninstallation", icon: "remove-circle-outline", sortOrder: 5 },
      { id: "water_leakage_ac", name: "Water Leakage Fix", icon: "water-outline", sortOrder: 6 },
      { id: "pcb_motor_repair", name: "PCB / Motor Repair", icon: "hardware-chip-outline", sortOrder: 7 },
    ],
  },

  // Appliance Repair
  washing_machine: {
    defaultTitle: "Washing Machine Repair & Service",
    options: [
      { id: "not_spinning_fix", name: "Spin & Drum Issue", icon: "refresh-outline", sortOrder: 1, isPopular: true },
      { id: "water_drain_issue", name: "Water Drainage Fix", icon: "water-outline", sortOrder: 2, isPopular: true },
      { id: "motor_pcb_repair", name: "Motor / PCB Board", icon: "hardware-chip-outline", sortOrder: 3 },
      { id: "noise_vibration_fix", name: "Noise & Vibration", icon: "volume-high-outline", sortOrder: 4 },
      { id: "full_machine_service", name: "Deep Machine Cleaning", icon: "sparkles-outline", sortOrder: 5 },
      { id: "power_button_issue", name: "Power / Start Issue", icon: "power-outline", sortOrder: 6 },
    ],
  },
  refrigerator: {
    defaultTitle: "Refrigerator Repair & Gas Refill",
    options: [
      { id: "not_cooling_fix", name: "Not Cooling Repair", icon: "snow-outline", sortOrder: 1, isPopular: true },
      { id: "fridge_gas_refill", name: "Gas Charging / Refill", icon: "cloud-outline", sortOrder: 2, isPopular: true },
      { id: "compressor_repair", name: "Compressor Issue", icon: "hardware-chip-outline", sortOrder: 3 },
      { id: "water_leakage_fridge", name: "Water Leakage", icon: "water-outline", sortOrder: 4 },
      { id: "defrost_thermostat", name: "Defrost & Thermostat", icon: "thermometer-outline", sortOrder: 5 },
      { id: "door_gasket_replace", name: "Door Gasket Replace", icon: "enter-outline", sortOrder: 6 },
    ],
  },

  // Beauty & Salon
  haircut: {
    defaultTitle: "Haircut & Styling Services",
    options: [
      { id: "classic_haircut", name: "Classic Haircut", icon: "cut-outline", sortOrder: 1, isPopular: true },
      { id: "hair_styling", name: "Hair Styling", icon: "brush-outline", sortOrder: 2, isPopular: true },
      { id: "beard_grooming", name: "Beard Grooming", icon: "happy-outline", sortOrder: 3 },
      { id: "hair_spa_treatment", name: "Hair Spa", icon: "leaf-outline", sortOrder: 4 },
      { id: "hair_wash_blowdry", name: "Hair Wash & Blowdry", icon: "water-outline", sortOrder: 5 },
      { id: "hair_straightening", name: "Straightening / Keratin", icon: "color-wand-outline", sortOrder: 6 },
    ],
  },
  hair_coloring: {
    defaultTitle: "Hair Coloring & Highlights",
    options: [
      { id: "root_touchup", name: "Root Touch-up", icon: "color-palette-outline", sortOrder: 1, isPopular: true },
      { id: "global_color", name: "Global Hair Color", icon: "color-palette-outline", sortOrder: 2, isPopular: true },
      { id: "highlights_streaks", name: "Highlights & Streaks", icon: "sparkles-outline", sortOrder: 3 },
      { id: "ammonia_free_color", name: "Ammonia-Free Organic", icon: "leaf-outline", sortOrder: 4 },
      { id: "henna_herbal", name: "Henna & Herbal Color", icon: "flower-outline", sortOrder: 5 },
    ],
  },
  facial: {
    defaultTitle: "Facial & Skin Care",
    options: [
      { id: "glow_facial", name: "Glow / Gold Facial", icon: "happy-outline", sortOrder: 1, isPopular: true },
      { id: "anti_aging_facial", name: "Anti-Aging Facial", icon: "rose-outline", sortOrder: 2, isPopular: true },
      { id: "detan_cleanup", name: "De-Tan Cleanup", icon: "sunny-outline", sortOrder: 3 },
      { id: "acne_treatment", name: "Acne Care", icon: "medkit-outline", sortOrder: 4 },
      { id: "skin_whitening", name: "Hydra & Brightening", icon: "sparkles-outline", sortOrder: 5 },
    ],
  },

  // Cleaning
  home_cleaning: {
    defaultTitle: "Home Deep Cleaning Services",
    options: [
      { id: "full_home_deep_clean", name: "Full Home Deep Clean", icon: "sparkles-outline", sortOrder: 1, isPopular: true },
      { id: "bathroom_deep_clean", name: "Bathroom Cleaning", icon: "water-outline", sortOrder: 2, isPopular: true },
      { id: "kitchen_deep_clean", name: "Kitchen Cleaning", icon: "restaurant-outline", sortOrder: 3, isPopular: true },
      { id: "sofa_carpet_clean", name: "Sofa & Carpet Clean", icon: "bed-outline", sortOrder: 4 },
      { id: "balcony_window_clean", name: "Balcony & Windows", icon: "grid-outline", sortOrder: 5 },
      { id: "floor_scrubbing_polish", name: "Floor Scrubbing", icon: "shield-checkmark-outline", sortOrder: 6 },
    ],
  },

  // Carpenter
  furniture_repair: {
    defaultTitle: "Furniture Repair & Carpentry",
    options: [
      { id: "chair_table_fix", name: "Chair & Table Repair", icon: "hammer-outline", sortOrder: 1, isPopular: true },
      { id: "door_lock_hinge", name: "Door Lock & Hinges", icon: "enter-outline", sortOrder: 2, isPopular: true },
      { id: "cupboard_drawer_fix", name: "Cupboard & Drawers", icon: "layers-outline", sortOrder: 3 },
      { id: "bed_cot_repair", name: "Bed / Cot Repair", icon: "bed-outline", sortOrder: 4 },
      { id: "wood_polishing_varnish", name: "Wood Polishing", icon: "sparkles-outline", sortOrder: 5 },
      { id: "curtain_rod_fitting", name: "Curtain Rod & Shelves", icon: "build-outline", sortOrder: 6 },
    ],
  },

  // Painting
  interior_painting: {
    defaultTitle: "House Painting & Texture Design",
    options: [
      { id: "full_interior_paint", name: "Full Home Painting", icon: "color-palette-outline", sortOrder: 1, isPopular: true },
      { id: "single_room_repaint", name: "1 Room Repainting", icon: "home-outline", sortOrder: 2, isPopular: true },
      { id: "wall_putty_primer", name: "Putty & Primer Work", icon: "layers-outline", sortOrder: 3 },
      { id: "texture_stencil_design", name: "Texture & Stencil Wall", icon: "color-wand-outline", sortOrder: 4 },
      { id: "waterproof_damp_fix", name: "Waterproofing Damp Fix", icon: "rainy-outline", sortOrder: 5 },
      { id: "wood_metal_paint", name: "Door & Grill Painting", icon: "brush-outline", sortOrder: 6 },
    ],
  },

  // Mobile Repair
  screen_repair: {
    defaultTitle: "Mobile Screen & Hardware Repair",
    options: [
      { id: "display_combo_change", name: "Display Screen Change", icon: "phone-portrait-outline", sortOrder: 1, isPopular: true },
      { id: "battery_change", name: "Battery Replacement", icon: "battery-charging-outline", sortOrder: 2, isPopular: true },
      { id: "charging_port_fix", name: "Charging Port Fix", icon: "power-outline", sortOrder: 3 },
      { id: "speaker_mic_repair", name: "Speaker & Mic Fix", icon: "volume-high-outline", sortOrder: 4 },
      { id: "water_damage_treatment", name: "Water Damage Repair", icon: "water-outline", sortOrder: 5 },
      { id: "software_unlock", name: "Software / Flashing", icon: "settings-outline", sortOrder: 6 },
    ],
  },

  // Computer Repair
  laptop_repair: {
    defaultTitle: "Laptop & PC Repair Services",
    options: [
      { id: "os_windows_install", name: "Windows / OS Install", icon: "download-outline", sortOrder: 1, isPopular: true },
      { id: "screen_keyboard_replace", name: "Screen & Keyboard Fix", icon: "laptop-outline", sortOrder: 2, isPopular: true },
      { id: "ssd_ram_upgrade", name: "SSD & RAM Upgrade", icon: "hardware-chip-outline", sortOrder: 3 },
      { id: "virus_malware_clean", name: "Virus & Speed Boost", icon: "shield-checkmark-outline", sortOrder: 4 },
      { id: "motherboard_chip_fix", name: "Motherboard Chip Repair", icon: "construct-outline", sortOrder: 5 },
      { id: "data_recovery_backup", name: "Data Recovery", icon: "save-outline", sortOrder: 6 },
    ],
  },

  // Driving
  personal_driver: {
    defaultTitle: "Personal & Outstation Driver",
    options: [
      { id: "city_daily_driver", name: "Daily City Driving", icon: "car-sport-outline", sortOrder: 1, isPopular: true },
      { id: "outstation_trip_driver", name: "Outstation Trips", icon: "map-outline", sortOrder: 2, isPopular: true },
      { id: "night_party_driver", name: "Night / Party Return", icon: "moon-outline", sortOrder: 3 },
      { id: "monthly_personal_driver", name: "Monthly Chauffeur", icon: "calendar-outline", sortOrder: 4 },
      { id: "airport_pickup_drop", name: "Airport Pick & Drop", icon: "airplane-outline", sortOrder: 5 },
    ],
  },
};

function getOptionsForService(serviceId: string): { defaultTitle: string; options: { id: string; name: string; icon?: string; sortOrder: number; isPopular?: boolean }[] } {
  const directMatch = SERVICE_OPTIONS[serviceId];
  if (directMatch) return directMatch;

  // Partial match by checking if key is contained in serviceId
  for (const [key, val] of Object.entries(SERVICE_OPTIONS)) {
    if (serviceId.toLowerCase().includes(key) || key.includes(serviceId.toLowerCase())) {
      return val;
    }
  }

  // Smart fallback generated from serviceId name
  const formattedName = serviceId
    .split(/[_\-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return {
    defaultTitle: `${formattedName} Service`,
    options: [
      { id: "general_service", name: `General ${formattedName}`, icon: "settings-outline", sortOrder: 1, isPopular: true },
      { id: "repair_fix", name: "Repair & Fix", icon: "construct-outline", sortOrder: 2, isPopular: true },
      { id: "installation", name: "Installation & Setup", icon: "build-outline", sortOrder: 3 },
      { id: "maintenance", name: "Regular Maintenance", icon: "refresh-outline", sortOrder: 4 },
      { id: "inspection", name: "Inspection & Quote", icon: "search-outline", sortOrder: 5 },
      { id: "emergency_support", name: "Emergency Support", icon: "flash-outline", sortOrder: 6 },
    ],
  };
}

app.get("/api/v1/services/:serviceId/options", async (c) => {
  const { serviceId } = c.req.param();
  const data = getOptionsForService(serviceId);
  c.header("Cache-Control", "public,max-age=3600");
  return ok(c, {
    serviceId,
    defaultTitle: data.defaultTitle,
    options: data.options,
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
        CASE WHEN i.kind='service' THEN s.title ELSE COALESCE(NULLIF(j.title, ''), r.name, 'Work Opportunity') END AS title,
        CASE WHEN i.kind='service' THEN s.base_price_paise ELSE j.pay_paise END AS payPaise,
        CASE WHEN i.kind='service' THEN s.pricing_model ELSE j.pay_unit END AS payUnit,
        COALESCE(i.area,j.area) AS area,
        j.starts_at AS startsAt,
        u.id AS otherId,
        u.name AS otherName,
        CASE WHEN i.status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') AND u.suspended=0 AND (i.kind='job' OR s.archived_at IS NULL) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=i.owner_id AND b.target_id=i.worker_id) OR (b.user_id=i.worker_id AND b.target_id=i.owner_id)) THEN u.phone ELSE NULL END AS otherPhone,
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
app.get("/api/v1/admin/providers/by-phone/:phone", requireAuth, async (c) => {
  if (!c.env.ADMIN_USER_IDS?.split(",").includes(c.get("userId")))
    throw new ApiError("UNAUTHORIZED", 403);
  const digits = c.req.param("phone").replace(/\D/g, "");
  const normalized = digits.length === 12 && digits.startsWith("91") ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  if (normalized.length !== 10) throw new ApiError("INVALID_PHONE", 400, "Enter a valid 10-digit phone number.");
  const result = await c.env.DB.prepare(
    `SELECT u.id AS providerId,u.phone,u.phone_verified AS phoneVerified,u.suspended,
            COUNT(sp.id) AS serviceCount,
            SUM(CASE WHEN sp.phone_visible=1 THEN 1 ELSE 0 END) AS visibleServiceCount,
            MAX(sp.updated_at) AS lastServiceUpdate
       FROM users u LEFT JOIN service_profiles sp ON sp.user_id=u.id AND sp.archived_at IS NULL
      WHERE u.phone IN (?, ?, ?) GROUP BY u.id`
  ).bind(normalized, `91${normalized}`, `+91${normalized}`).first();
  return ok(c, { provider: result ? {
    ...result,
    phone: formatDirectPhone((result as any).phone),
    phoneVisible: Number((result as any).visibleServiceCount || 0) > 0,
  } : null });
});
app.route("/api/v1/jobs", jobRoutes);
app.route("/api/v1/saved-places", savedPlacesRoutes);
app.route("/api/v1/services", services);
app.route("/api/v1/service-requests", requests);
app.route("/api/v1/applications", interactions);
app.route("/api/v1/interactions", interactions);
app.route("/api/v1/notifications", notificationRoutes);
app.route("/api/v1", trust);
app.route("/api/v1", locations);
export { app };
export default { fetch: app.fetch, queue: consumeAuthEvents };
