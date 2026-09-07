import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { api } from "../../api/client";
import { Button, Copy, Failure } from "../../components/ui";
import { t } from "../../i18n/en";
export function PhotoUpload() {
  const client = useQueryClient();
  const upload = useMutation({
    mutationFn: async () => {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (picked.canceled) return false;
      const photo = picked.assets[0];
      if (!photo) throw new Error(t("photoError"));
      const bytes = photo.fileSize;
      if (!bytes || bytes > 5 * 1024 * 1024) throw new Error(t("photoSize"));
      const mimeType = photo.mimeType ?? "image/jpeg";
      const signed = await api<{ url: string; fields: Record<string, string> }>(
        "/images/authorize",
        { mimeType, bytes },
      );
      const body = new FormData();
      for (const [key, value] of Object.entries(signed.fields))
        body.append(key, value);
      if (Platform.OS === "web") {
        const blob = await fetch(photo.uri).then((r) => r.blob());
        body.append("file", blob, photo.fileName ?? "photo.jpg");
      } else
        body.append("file", {
          uri: photo.uri,
          name: photo.fileName ?? "photo.jpg",
          type: mimeType,
        } as unknown as Blob);
      const result = await fetch(signed.url, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(60000),
      });
      if (!result.ok) throw new Error(t("photoError"));
      await api("/images/confirm", { assetId: signed.fields.public_id });
      return true;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["me"] }),
  });
  return (
    <>
      <Button
        label={t("addPhoto")}
        secondary
        disabled={upload.isPending}
        onPress={() => upload.mutate()}
      />
      {upload.isPending && <Copy>{t("busy")}</Copy>}
      {upload.error && <Failure error={upload.error} />}
    </>
  );
}
