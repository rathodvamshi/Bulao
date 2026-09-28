import { useCallback } from "react";
import { useAuth } from "../../src/auth";
import { Linking } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
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
  const { session } = useAuth();
  const details = useQuery({
    queryKey: ["connection", id, session?.token],
    enabled: !!id && !!session?.token,
    queryFn: () =>
      api<{
        title: string;
        otherName: string;
        area: string;
        scheduledAt: number | null;
        details: string;
        phone: string | null;
      }>(`/applications/${id}`),
  });
  useFocusEffect(useCallback(() => { if (session?.token) void details.refetch(); }, [session?.token, details.refetch]));
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
            {details.data.scheduledAt ? new Date(details.data.scheduledAt * 1000).toLocaleString() : "Time not scheduled"}
          </Copy>
          <Copy>{details.data.details}</Copy>
          {details.data.phone ? (
            <Button
              label={t("call")}
              onPress={() => void Linking.openURL(`tel:${details.data.phone}`)}
            />
          ) : (
            <Copy>Contact details are unavailable or restricted by the provider.</Copy>
          )}
        </Card>
      )}
    </Screen>
  );
}
