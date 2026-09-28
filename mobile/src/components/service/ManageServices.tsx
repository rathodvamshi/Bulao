import { useAuth } from "../../auth";
import { invalidateServiceQueries } from "../../api/serviceApi";
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { dash, radii } from "./palette";

export type MyServiceItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  area: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  experience?: number;
  available: boolean;
  title?: string;
  serviceMode?: "doorstep" | "at_center" | "both";
  pricingModel?: "fixed" | "hourly" | "visit_quote";
  basePricePaise?: number;
  operatingHours?: string;
  portfolioUrls?: string[];
};

export function ManageServices() {
  const client = useQueryClient();
  const { session } = useAuth();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["myServices", session?.token],
    enabled: !!session?.token,
    queryFn: () => api<MyServiceItem[]>("/services/mine"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      setTogglingId(id);
      return api(`/services/${id}`, { available }, "PATCH");
    },
    onSettled: () => setTogglingId(null),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["myServices"] });
      void invalidateServiceQueries(client);
      client.invalidateQueries({ queryKey: ["nearby"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api(`/services/${id}`, {}, "DELETE");
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["myServices"] });
      void invalidateServiceQueries(client);
      client.invalidateQueries({ queryKey: ["nearby"] });
    },
  });

  const confirmDelete = (item: MyServiceItem) => {
    Alert.alert(
      "Delete Service",
      `Are you sure you want to remove "${item.title || item.categoryName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(item.id),
        },
      ]
    );
  };

  const rawServices = servicesQuery.data;
  const servicesList: MyServiceItem[] = Array.isArray(rawServices)
    ? rawServices
    : (rawServices as any)?.items || [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>My Offered Services</Text>
          <Text style={styles.sectionSub}>
            Manage your service availability, rates, and coverage area.
          </Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/services/offer")}
        >
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Add New</Text>
        </Pressable>
      </View>

      {servicesQuery.isLoading ? (
        <ActivityIndicator color={dash.primary} style={{ marginVertical: 30 }} />
      ) : servicesQuery.isError ? (
        <Pressable onPress={() => void servicesQuery.refetch()}><Text>Could not load services. Tap to retry.</Text></Pressable>
      ) : servicesList.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="briefcase" size={32} color="#D97706" />
          </View>
          <Text style={styles.emptyTitle}>No Services Created Yet</Text>
          <Text style={styles.emptySub}>
            Create your first service profile to start receiving customer requests.
          </Text>
          <Pressable
            style={styles.createNowBtn}
            onPress={() => router.push("/services/offer")}
          >
            <Text style={styles.createNowBtnText}>Create a Service</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {servicesList.map((item) => {
            const isToggling = togglingId === item.id;
            const priceRs = Math.round((item.basePricePaise || 0) / 100);
            const hasPhotos = item.portfolioUrls && item.portfolioUrls.length > 0;

            return (
              <View
                key={item.id}
                style={[
                  styles.serviceCard,
                  !item.available && styles.serviceCardPaused,
                ]}
              >
                <View
                  style={[
                    styles.cardAccentBar,
                    { backgroundColor: item.available ? "#10B981" : "#CBD5E1" },
                  ]}
                />

                <View style={styles.cardInner}>
                  <View style={styles.cardMain}>
                    <View style={styles.photoBox}>
                      {hasPhotos ? (
                        <Image source={{ uri: item.portfolioUrls![0] }} style={styles.photoImg} />
                      ) : (
                        <View style={styles.iconCircle}>
                          <Text style={styles.iconText}>{item.categoryIcon || "🛠️"}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.cardInfo}>
                      <Text style={styles.title} numberOfLines={1}>
                        {item.title || item.categoryName}
                      </Text>
                      <Text style={styles.metaText} numberOfLines={1}>
                        {item.area} · {item.radiusKm || 10} km radius
                      </Text>
                      <View style={styles.badgesRow}>
                        <View style={styles.badge}>
                          <Ionicons
                            name={item.serviceMode === "at_center" ? "storefront-outline" : "home-outline"}
                            size={11}
                            color={dash.primary}
                          />
                          <Text style={styles.badgeText}>
                            {item.serviceMode === "at_center"
                              ? "At Shop"
                              : item.serviceMode === "both"
                              ? "Home & Shop"
                              : "Doorstep"}
                          </Text>
                        </View>
                        {priceRs > 0 && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>₹{priceRs}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.cardActions}>
                      {isToggling ? (
                        <ActivityIndicator size="small" color={dash.primary} />
                      ) : (
                        <Switch
                          value={item.available}
                          onValueChange={(val) =>
                            toggleMutation.mutate({ id: item.id, available: val })
                          }
                          trackColor={{ false: "#E2E8F0", true: "#86EFAC" }}
                          thumbColor={item.available ? dash.primary : "#94A3B8"}
                        />
                      )}
                    </View>
                  </View>

                  {/* Footer Controls */}
                  <View style={styles.cardFooter}>
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: item.available ? "#10B981" : "#9CA3AF" },
                        ]}
                      />
                      <Text style={[styles.statusText, item.available ? styles.statusOnline : styles.statusOffline]}>
                        {item.available ? "Accepting Requests" : "Currently Offline"}
                      </Text>
                    </View>
                    <Pressable onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={16} color={dash.error} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: dash.text,
  },
  sectionSub: {
    fontSize: 12,
    color: dash.subtext,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: dash.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    gap: 4,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 26,
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.06)",
  },
  emptyIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: dash.text,
  },
  emptySub: {
    fontSize: 13,
    color: dash.subtext,
    textAlign: "center",
  },
  createNowBtn: {
    marginTop: 6,
    backgroundColor: dash.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  createNowBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  list: {
    gap: 14,
  },
  serviceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5ECE7",
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  serviceCardPaused: {
    backgroundColor: "#FAFAFA",
    borderColor: "#E2E8F0",
  },
  cardAccentBar: {
    height: 4,
    width: "100%",
  },
  cardInner: {
    padding: 16,
    gap: 12,
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
  },
  photoImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  iconCircle: {
    width: "100%",
    height: "100%",
    backgroundColor: dash.softGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 24,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: dash.text,
    letterSpacing: -0.2,
  },
  metaText: {
    fontSize: 12,
    color: dash.subtext,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.04)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: dash.text,
  },
  cardActions: {
    justifyContent: "center",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusOnline: {
    color: "#059669",
  },
  statusOffline: {
    color: dash.subtext,
  },
  deleteBtn: {
    padding: 6,
  },
});
