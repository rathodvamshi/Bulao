import type { StorageProvider, ImageAsset } from "./provider";
import { ApiError } from "../../middleware/errors";
export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  secret: string;
  preset: string;
};
export async function cloudinarySignature(
  fields: Record<string, string>,
  secret: string,
) {
  const value =
    Object.keys(fields)
      .sort()
      .map((key) => `${key}=${fields[key]}`)
      .join("&") + secret;
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export class CloudinaryStorage implements StorageProvider {
  constructor(
    private config: CloudinaryConfig,
    private transport: typeof fetch = fetch,
  ) {}
  async authorizeUpload(ownerId: string, mimeType: string, bytes: number) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(mimeType) ||
      bytes <= 0 ||
      bytes > 5 * 1024 * 1024
    )
      throw new ApiError(
        "INVALID_IMAGE",
        400,
        "Choose a JPG, PNG or WebP image smaller than 5 MB.",
      );
    const fields = {
      public_id: `bulao/${ownerId}/${crypto.randomUUID()}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
      overwrite: "false",
      upload_preset: this.config.preset,
    };
    return {
      url: `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`,
      fields: {
        ...fields,
        api_key: this.config.apiKey,
        signature: await cloudinarySignature(fields, this.config.secret),
      },
    };
  }
  async verifyAsset(ownerId: string, assetId: string): Promise<ImageAsset> {
    if (
      !assetId.startsWith(`bulao/${ownerId}/`) ||
      !/^bulao\/[a-f0-9-]+\/[a-f0-9-]+$/.test(assetId)
    )
      throw new ApiError("INVALID_IMAGE", 403);
    let response: Response;
    try {
      response = await this.transport(
        `https://api.cloudinary.com/v1_1/${this.config.cloudName}/resources/image/upload/${encodeURIComponent(assetId)}`,
        {
          headers: {
            Authorization: `Basic ${btoa(`${this.config.apiKey}:${this.config.secret}`)}`,
          },
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        },
      );
    } catch {
      throw new ApiError("PROVIDER_UNAVAILABLE", 503);
    }
    if (!response.ok)
      throw new ApiError(
        "PROVIDER_UNAVAILABLE",
        503,
        "We couldn’t check your photo. Please try again.",
      );
    const asset = (await response.json()) as {
      public_id: string;
      resource_type: string;
      format: string;
      bytes: number;
      version: number;
    };
    if (
      asset.public_id !== assetId ||
      asset.resource_type !== "image" ||
      !["jpg", "jpeg", "png", "webp"].includes(asset.format) ||
      asset.bytes > 5 * 1024 * 1024 ||
      !Number.isInteger(asset.version)
    )
      throw new ApiError("INVALID_IMAGE");
    const base = `https://res.cloudinary.com/${this.config.cloudName}/image/upload`;
    const path = `v${asset.version}/${assetId}.${asset.format}`;
    return {
      id: assetId,
      ownerId,
      thumbnailUrl: `${base}/c_fill,w_160,h_160,q_auto,f_auto/${path}`,
      mediumUrl: `${base}/c_limit,w_640,h_640,q_auto,f_auto/${path}`,
      fullUrl: `${base}/c_limit,w_1440,h_1440,q_auto,f_auto/${path}`,
    };
  }
  async deleteAsset(ownerId: string, assetId: string) {
    if (!assetId.startsWith(`bulao/${ownerId}/`))
      throw new ApiError("UNAUTHORIZED", 403);
    const fields = {
      public_id: assetId,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const response = await this.transport(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/destroy`,
      {
        method: "POST",
        body: new URLSearchParams({
          ...fields,
          api_key: this.config.apiKey,
          signature: await cloudinarySignature(fields, this.config.secret),
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new ApiError("PROVIDER_UNAVAILABLE", 503);
  }
}
