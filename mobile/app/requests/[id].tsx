import { Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import {
  Screen,
  Card,
  Copy,
  Button,
  Loading,
  Failure,
} from "../../src/components/ui";
import { t } from "../../src/i18n/en";
export default function ConnectionDetail() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  const details = useQuery({
    queryKey: ["connection", id],
    queryFn: () =>
      api<{
        title: string;
        otherName: string;
        area: string;
        scheduledAt: number;
        details: string;
        phone: string | null;
      }>(`/${kind === "job" ? "applications" : "service-requests"}/${id}`),
  });
  return (
    <Screen title={details.data?.title ?? t("activity")} back>
      {details.isPending ? (
        <Loading />
      ) : details.isError ? (
        <Failure error={details.error} retry={() => void details.refetch()} />
      ) : (
        <Card>
          <Copy>{details.data.otherName || t("new")}</Copy>
          <Copy>{details.data.area}</Copy>
          <Copy>
            {new Date(details.data.scheduledAt * 1000).toLocaleString()}
          </Copy>
          <Copy>{details.data.details}</Copy>
          {details.data.phone ? (
            <Button
              label={t("call")}
              onPress={() => void Linking.openURL(`tel:${details.data.phone}`)}
            />
          ) : (
            <Copy>{t("contactAfterAccept")}</Copy>
          )}
        </Card>
      )}
    </Screen>
  );
}
