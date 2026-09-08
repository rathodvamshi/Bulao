import { useEffect, useState } from "react";
import { Image } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth";
import { useLocation } from "../../src/store/location";
import {
  Screen,
  Copy,
  Card,
  Field,
  Button,
  Loading,
  Failure,
} from "../../src/components/ui";
import { t } from "../../src/i18n/en";
import { PhotoUpload } from "../../src/features/profile/photo";
export default function Profile() {
  const auth = useAuth();
  const token = auth.session?.token || null;
  const location = useLocation((x) => x.location);
  const [name, setName] = useState("");
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ["me", token],
    enabled: !!token,
    queryFn: () =>
      api<{ id: string; name: string; area: string; photoUrl: string | null }>(
        "/users/me",
      ),
  });
  useEffect(() => {
    if (me.data) setName(me.data.name);
  }, [me.data]);
  const save = useMutation({
    mutationFn: () =>
      api(
        "/users/me",
        { name, area: location?.area ?? me.data?.area },
        "PATCH",
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["me"] }),
  });
  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Use the centralized auth logout which handles server revocation
      await auth.logout();
      // Also clear react-query cache
      client.clear();
    },
  });
  return (
    <Screen title={t("profile")}>
      {!token ? (
        <>
          <Copy>{t("accountHint")}</Copy>
          <Button label={t("signIn")} onPress={() => router.push("/auth")} />
        </>
      ) : me.isPending ? (
        <Loading />
      ) : me.isError ? (
        <Failure error={me.error} retry={() => void me.refetch()} />
      ) : (
        <>
          <Card>
            {me.data.photoUrl && (
              <Image
                source={{ uri: me.data.photoUrl }}
                accessibilityLabel={me.data.name}
                style={{ width: 96, height: 96, borderRadius: 48 }}
              />
            )}
            <PhotoUpload />
            <Copy>{t("verified")}</Copy>
            <Field
              label={t("name")}
              value={name}
              onChangeText={setName}
              placeholder={t("namePlaceholder")}
            />
            <Button
              label={location?.area ?? (me.data.area || t("location"))}
              secondary
              onPress={() => router.push("/location")}
            />
            <Button
              label={t("save")}
              disabled={
                save.isPending ||
                name.trim().length < 2 ||
                !(location?.area || me.data.area)
              }
              onPress={() => save.mutate()}
            />
            {save.isSuccess && <Copy>{t("saved")}</Copy>}
            {save.error && <Failure error={save.error} />}
          </Card>
          <Button
            label={t("offer")}
            onPress={() => router.push("/services/offer")}
          />
          <Button
            label={t("signOut")}
            secondary
            disabled={logoutMutation.isPending}
            onPress={() => logoutMutation.mutate()}
          />
          {logoutMutation.error && <Failure error={logoutMutation.error} />}
        </>
      )}
    </Screen>
  );
}
