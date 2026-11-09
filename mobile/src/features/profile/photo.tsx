import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { uploadImage } from "../../api/uploadImage";
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
      await uploadImage(photo, 'profile');
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
