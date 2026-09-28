import { useCallback, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../src/api/client";
import { useAuth } from "../src/auth";
import {
  ServiceIdentityCardSkeleton,
  ServiceCollectionSkeleton,
} from "../src/components/SkeletonLoader";
import { CommonIdentityCard } from "../src/features/profile/components/CommonIdentityCard";
import { MyServiceCollection } from "../src/features/profile/components/MyServiceCollection";
import { ServiceGrowthSheet } from "../src/features/profile/components/ServiceGrowthSheet";
import {
  ServiceText as Text,
  serviceTheme as theme,
} from "../src/features/profile/components/serviceProfileTheme";
import { ServiceBottomNav } from "../src/components/service/ServiceBottomNav";
import type {
  CommonProfileData,
  ServiceItem,
} from "../src/features/profile/types";

export default function ServiceProfileScreen() {
  const { session } = useAuth();
  const token = session?.token;
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const insets = useSafeAreaInsets();
  const me = useQuery({
    queryKey: ["me", token],
    enabled: !!token,
    queryFn: () => api<CommonProfileData>("/users/me"),
  });
  const services = useQuery({
    queryKey: ["my-services", token],
    enabled: !!token,
    queryFn: () => api<ServiceItem[]>("/services/mine"),
  });
  const { refetch } = services;
  useFocusEffect(
    useCallback(() => {
      if (token) void refetch();
    }, [token, refetch]),
  );
  const hasServices = (services.data?.length ?? 0) > 0;
  const [growthOpen, setGrowthOpen] = useState(false);
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>My profile</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile settings"
          style={s.settings}
          onPress={() => router.push("/settings")}
        >
          <Ionicons name="settings-outline" size={22} color={theme.ink} />
        </Pressable>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.content,
          { paddingBottom: 116 + insets.bottom },
        ]}
        refreshControl={
          token ? (
            <RefreshControl
              refreshing={me.isRefetching || services.isRefetching}
              onRefresh={() => {
                void me.refetch();
                void services.refetch();
              }}
              tintColor={theme.green}
            />
          ) : undefined
        }
      >
        {!token ? (
          <View style={s.notice}>
            <Ionicons
              name="person-circle-outline"
              size={44}
              color={theme.green}
            />
            <Text style={s.noticeTitle}>Your services, in one place</Text>
            <Text style={s.muted}>
              Sign in to find local help and share your skills.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={() => router.push("/auth")}
            >
              <Text style={s.buttonText}>Sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.identity}>
              {me.data ? (
                <CommonIdentityCard profile={me.data} />
              ) : me.isError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void me.refetch()}
                  style={s.notice}
                >
                  <Text style={s.noticeTitle}>Couldn't load your profile</Text>
                  <Text style={s.link}>Tap to retry</Text>
                </Pressable>
              ) : (
                <ServiceIdentityCardSkeleton />
              )}
            </View>
            {services.isPending ? (
              <ServiceCollectionSkeleton />
            ) : (
              <>
                {services.isError && (
                  <View style={s.error}>
                    <Text style={[s.muted, { flex: 1 }]}>
                      Couldn't refresh your services.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void services.refetch()}
                    >
                      <Text style={s.link}>Retry</Text>
                    </Pressable>
                  </View>
                )}
                {services.data && (
                  <MyServiceCollection
                    services={services.data}
                    initialServiceId={serviceId}
                  />
                )}
              </>
            )}
            {growthOpen && (
              <ServiceGrowthSheet
                services={services.data || []}
                onClose={() => setGrowthOpen(false)}
              />
            )}
          </>
        )}
      </ScrollView>
      <ServiceBottomNav active="profile" />
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  title: {
    color: theme.green,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  settings: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    paddingHorizontal: 14,
    gap: 18,
  },
  identity: {
    gap: 12,
  },
  roles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    paddingHorizontal: 14,
  },
  role: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    backgroundColor: theme.green,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  roleText: { fontSize: 10, fontWeight: "600", color: "white" },
  notice: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
    gap: 12,
  },
  noticeTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  muted: { fontSize: 12, lineHeight: 18, color: theme.muted },
  button: {
    backgroundColor: theme.green,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 11,
  },
  buttonText: { fontSize: 13, fontWeight: "700", color: "white" },
  link: { fontSize: 12, fontWeight: "700", color: theme.green, padding: 8 },
  loading: { padding: 26 },
  error: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFF5E9",
    borderRadius: 12,
  },
  browse: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.green,
    padding: 15,
    borderRadius: 16,
  },
  browseTitle: { color: "white", fontSize: 13, fontWeight: "700" },
});
