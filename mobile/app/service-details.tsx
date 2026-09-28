import { useCallback } from "react";
import { serviceApi } from "../src/api/serviceApi";
import { View, ActivityIndicator, Pressable } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../src/auth";
import { api } from "../src/api/client";
import type { ServiceItem } from "../src/features/profile/types";
import { ServiceListingDetail } from "../src/features/profile/components/ServiceListingDetail";
import {
  ServiceText as Text,
  serviceTheme,
} from "../src/features/profile/components/serviceProfileTheme";
export default function ServiceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, user } = useAuth();
  const query = useQuery({
    queryKey: ["service-detail", id, session?.token],
    enabled: !!id,
    queryFn: () => serviceApi.detail(id),
  });
  useFocusEffect(useCallback(() => { if (id) void query.refetch(); }, [id, query.refetch]));
  const service = query.isError ? undefined : query.data;
  if (service)
    return (
      <ServiceListingDetail key={service.id} service={service} isClientView={service.provider?.id !== user?.id} onClose={() => router.back()} />
    );
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: serviceTheme.background,
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 24,
      }}
    >
      {query.isPending ? (
        <ActivityIndicator color={serviceTheme.green} />
      ) : (
        <>
          <Text>
            {query.isError
              ? "Couldn't load this service."
              : "This service is unavailable."}
          </Text>
          {query.isError && (
            <Pressable onPress={() => void query.refetch()}>
              <Text>Try again</Text>
            </Pressable>
          )}
        </>
      )}
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={{ color: serviceTheme.green, fontWeight: "700" }}>
          Go back
        </Text>
      </Pressable>
    </View>
  );
}
