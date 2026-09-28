import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import { api } from "./client";

export async function uploadServicePhoto(photo: ImagePickerAsset): Promise<string> {
  const mimeType = photo.mimeType ?? "image/jpeg";
  const blob = Platform.OS === "web" ? await fetch(photo.uri).then(r => r.blob()) : undefined;
  const bytes = photo.fileSize ?? blob?.size;
  if (!bytes || bytes > 5 * 1024 * 1024) throw new Error("Choose a photo smaller than 5 MB with a readable file size.");
  const signed = await api<{ url: string; fields: Record<string, string> }>("/images/authorize", { mimeType, bytes });
  const body = new FormData();
  for (const [key, value] of Object.entries(signed.fields)) body.append(key, value);
  if (blob) body.append("file", blob, photo.fileName ?? "service.jpg");
  else body.append("file", { uri: photo.uri, name: photo.fileName ?? "service.jpg", type: mimeType } as unknown as Blob);
  const response = await fetch(signed.url, { method: "POST", body, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error("Photo upload failed. Please retry.");
  const asset = await api<{ fullUrl: string }>("/images/confirm", { assetId: signed.fields.public_id, purpose: "service" });
  return asset.fullUrl;
}
