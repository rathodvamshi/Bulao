import { Image, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import {
  Screen,
  Card,
  Copy,
  Button,
  Loading,
  Failure,
  s,
} from "../../src/components/ui";
import { t } from "../../src/i18n/en";
export default function PublicProfile() {
  const { id, serviceId, category } = useLocalSearchParams<{
    id: string;
    serviceId?: string;
    category?: string;
  }>();
  const profile = useQuery({
    queryKey: ["profile", id],
    queryFn: () =>
      api<{
        name: string;
        area: string;
        photoUrl: string | null;
        rating: number | null;
        completed: number;
        reviews: { stars: number; body: string; author: string }[];
      }>(`/profiles/${id}`),
  });
  return (
    <Screen title={t("profile")} back>
      {profile.isPending ? (
        <Loading />
      ) : profile.isError ? (
        <Failure error={profile.error} retry={() => void profile.refetch()} />
      ) : (
        <>
          <Card>
            {profile.data.photoUrl && (
              <Image
                accessibilityLabel={profile.data.name}
                source={{ uri: profile.data.photoUrl }}
                style={{ width: 96, height: 96, borderRadius: 48 }}
              />
            )}
            <Text style={s.heading}>{profile.data.name || t("new")}</Text>
            <Copy>{category ?? profile.data.area}</Copy>
            <Copy>{t("verified")}</Copy>
            <Copy>
              {profile.data.rating ? `★ ${profile.data.rating}` : t("new")} ·{" "}
              {profile.data.completed} {t("completed").toLowerCase()}
            </Copy>
          </Card>
          {serviceId && (
            <Button
              label={t("request")}
              onPress={() =>
                router.push({
                  pathname: "/services/request",
                  params: { id: serviceId, name: profile.data.name, category },
                })
              }
            />
          )}{" "}
          {profile.data.reviews.map((review, index) => (
            <Card key={index}>
              <Copy>
                ★ {review.stars} · {review.author || t("new")}
              </Copy>
              <Copy>{review.body}</Copy>
            </Card>
          ))}
          <Button
            label={t("report")}
            secondary
            onPress={() =>
              router.push({ pathname: "/safety", params: { targetId: id } })
            }
          />
        </>
      )}
    </Screen>
  );
}
