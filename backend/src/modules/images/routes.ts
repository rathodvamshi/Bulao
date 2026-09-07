import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Env } from "../../config/env";
import { CloudinaryStorage } from "../../providers/storage/cloudinary";
import { recordUsage } from "../../providers/usage";
import { now, requireAuth, rateLimit } from "../auth/session";
import { ApiError, ok } from "../../middleware/errors";
function storage(env: Env) {
  if (
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET ||
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_UPLOAD_PRESET
  )
    throw new ApiError(
      "PROVIDER_UNAVAILABLE",
      503,
      "Photo uploads are temporarily unavailable. You can continue without a photo.",
    );
  return new CloudinaryStorage({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    secret: env.CLOUDINARY_API_SECRET,
    preset: env.CLOUDINARY_UPLOAD_PRESET,
  });
}
export const images = new Hono<AppEnv>();
images.use("*", requireAuth);
images.post("/authorize", async (c) => {
  const input = z
    .object({
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      bytes: z
        .number()
        .int()
        .positive()
        .max(5 * 1024 * 1024),
    })
    .parse(await c.req.json());
  await rateLimit(c.env.DB, `image:${c.get("userId")}`, 10, 86400);
  const authorized = await storage(c.env).authorizeUpload(
    c.get("userId"),
    input.mimeType,
    input.bytes,
  );
  await c.env.DB.prepare(
    "INSERT INTO image_intents(asset_id,user_id,expires_at) VALUES(?,?,?)",
  )
    .bind(authorized.fields.public_id, c.get("userId"), now() + 3600)
    .run();
  return ok(c, authorized);
});
images.post("/confirm", async (c) => {
  const { assetId } = z
    .object({ assetId: z.string().max(200) })
    .parse(await c.req.json());
  const intent = await c.env.DB.prepare(
    "SELECT asset_id FROM image_intents WHERE asset_id=? AND user_id=? AND expires_at>?",
  )
    .bind(assetId, c.get("userId"), now())
    .first();
  if (!intent) throw new ApiError("INVALID_IMAGE", 403);
  const asset = await storage(c.env).verifyAsset(c.get("userId"), assetId);
  await c.env.DB.prepare("UPDATE users SET photo_url=? WHERE id=?")
    .bind(asset.thumbnailUrl, c.get("userId"))
    .run();
  await recordUsage(c.env.DB, "cloudinary", "verified_upload", true);
  return ok(c, asset);
});
