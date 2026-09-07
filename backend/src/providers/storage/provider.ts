export interface ImageAsset {
  id: string;
  ownerId: string;
  thumbnailUrl: string;
  mediumUrl: string;
  fullUrl: string;
}
export interface StorageProvider {
  authorizeUpload(
    ownerId: string,
    mimeType: "image/jpeg" | "image/png" | "image/webp",
    bytes: number,
  ): Promise<{ url: string; fields: Record<string, string> }>;
  verifyAsset(ownerId: string, assetId: string): Promise<ImageAsset>;
  deleteAsset(ownerId: string, assetId: string): Promise<void>;
}
