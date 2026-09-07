import { it, expect, vi } from "vitest";
import { CloudinaryStorage } from "../src/providers/storage/cloudinary";
const config = {
  cloudName: "test-cloud",
  apiKey: "test-api-key",
  secret: "test-secret",
  preset: "restricted",
};
it("limits image authorization and never returns the signing secret", async () => {
  const provider = new CloudinaryStorage(config);
  await expect(
    provider.authorizeUpload("owner", "image/svg+xml", 100),
  ).rejects.toThrow();
  await expect(
    provider.authorizeUpload("owner", "image/jpeg", 6 * 1024 * 1024),
  ).rejects.toThrow();
  const auth = await provider.authorizeUpload("owner", "image/jpeg", 100);
  expect(JSON.stringify(auth)).not.toContain(config.secret);
  expect(auth.fields.overwrite).toBe("false");
  expect(auth.fields.public_id).toMatch(/^bulao\/owner\//);
});
it("rejects another user’s asset without contacting Cloudinary", async () => {
  const fetcher = vi.fn();
  const provider = new CloudinaryStorage(config, fetcher);
  await expect(
    provider.verifyAsset("owner-a", "bulao/owner-b/photo"),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("returns resized URLs only after checking asset metadata", async () => {
  const id = "bulao/abc-def/123-456";
  const provider = new CloudinaryStorage(config, async () =>
    Response.json({
      public_id: id,
      resource_type: "image",
      format: "jpg",
      bytes: 1000,
      version: 1,
    }),
  );
  const asset = await provider.verifyAsset("abc-def", id);
  expect(asset.thumbnailUrl).toContain("w_160");
  expect(asset.mediumUrl).toContain("w_640");
});
