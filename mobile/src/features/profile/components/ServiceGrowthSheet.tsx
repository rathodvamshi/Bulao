import React from "react";
import { View, Modal, Pressable, ScrollView, StyleSheet, Share, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ServiceItem } from "../types";
import {
  ServiceText as Text,
  serviceTheme as theme,
  servicePhotos,
} from "./serviceProfileTheme";

export function ServiceGrowthSheet({
  services,
  onClose,
}: {
  services: ServiceItem[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const primaryService = services[0];

  const handleShare = async () => {
    try {
      await Share.share({
        message: primaryService
          ? `Check out my ${primaryService.title || primaryService.categoryName} service on Bulao!`
          : "Discover local services and skilled professionals on Bulao!",
      });
    } catch {
      // Ignored
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable
          accessibilityLabel="Close service growth details"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
          accessibilityViewIsModal
        >
          {/* Top Sheet Drag Handle */}
          <View style={s.dragHandleBar} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.growthHeaderIcon}>
              <Ionicons name="trending-up" size={24} color="#005C3F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Grow your business</Text>
              <Text style={s.subtitle}>
                Keep your services updated, respond to requests and get more customers.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={s.close}
            >
              <Ionicons name="close" size={20} color="#61718A" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {/* Quick Action Hub Cards */}
            <Text style={s.sectionHeader}>HELPFUL PROVIDER ACTIONS</Text>

            {/* 1. Add or improve photos */}
            <Pressable
              android_ripple={{ color: "rgba(21, 128, 61, 0.08)" }}
              style={({ pressed }) => [s.actionCard, pressed && s.cardPressed]}
              onPress={() => {
                onClose();
                if (primaryService) {
                  router.push({ pathname: "/create-service", params: { editId: primaryService.id, step: "3" } });
                } else {
                  router.push("/create-service");
                }
              }}
            >
              <View style={[s.actionIconBox, { backgroundColor: "#DCFCE7" }]}>
                <Ionicons name="camera-outline" size={20} color="#15803D" />
              </View>
              <View style={s.actionContent}>
                <Text style={s.actionTitle}>Add or improve service photos</Text>
                <Text style={s.actionSub}>Showcase real work &amp; workspace to build customer trust</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>

            {/* 2. Respond to requests */}
            <Pressable
              android_ripple={{ color: "rgba(29, 78, 216, 0.08)" }}
              style={({ pressed }) => [s.actionCard, pressed && s.cardPressed]}
              onPress={() => {
                onClose();
                router.push("/activity");
              }}
            >
              <View style={[s.actionIconBox, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="chatbubbles-outline" size={20} color="#1D4ED8" />
              </View>
              <View style={s.actionContent}>
                <Text style={s.actionTitle}>Respond to service requests</Text>
                <Text style={s.actionSub}>Reply fast to active customer inquiries nearby</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>

            {/* 3. Check customer feedback */}
            <Pressable
              android_ripple={{ color: "rgba(180, 83, 9, 0.08)" }}
              style={({ pressed }) => [s.actionCard, pressed && s.cardPressed]}
              onPress={() => {
                onClose();
                if (primaryService) {
                  router.push({ pathname: "/service-details", params: { id: primaryService.id } });
                }
              }}
            >
              <View style={[s.actionIconBox, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="star-outline" size={20} color="#B45309" />
              </View>
              <View style={s.actionContent}>
                <Text style={s.actionTitle}>Check customer feedback</Text>
                <Text style={s.actionSub}>View ratings and feedback from past customers</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>

            {/* 4. Share your service */}
            <Pressable
              android_ripple={{ color: "rgba(126, 34, 206, 0.08)" }}
              style={({ pressed }) => [s.actionCard, pressed && s.cardPressed]}
              onPress={handleShare}
            >
              <View style={[s.actionIconBox, { backgroundColor: "#F3E8FF" }]}>
                <Ionicons name="share-social-outline" size={20} color="#7E22CE" />
              </View>
              <View style={s.actionContent}>
                <Text style={s.actionTitle}>Share your service profile</Text>
                <Text style={s.actionSub}>Promote your Bulao listing to local clients</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>

            {/* Existing Services Checklist Section */}
            {services.length > 0 && (
              <>
                <Text style={s.sectionHeader}>YOUR SERVICE LISTINGS ({services.length})</Text>
                {services.map((service) => {
                  const photos = servicePhotos(service);
                  return (
                    <View key={service.id} style={s.serviceItemCard}>
                      <Text style={s.serviceName}>{service.title || service.categoryName}</Text>

                      <View style={s.checklistGroup}>
                        <View style={s.checkRow}>
                          <Ionicons
                            name={service.description?.trim() ? "checkmark-circle" : "ellipse-outline"}
                            size={16}
                            color={service.description?.trim() ? "#15803D" : "#94A3B8"}
                          />
                          <Text style={s.checkText}>Detailed description</Text>
                        </View>
                        <View style={s.checkRow}>
                          <Ionicons
                            name={photos.length > 0 ? "checkmark-circle" : "ellipse-outline"}
                            size={16}
                            color={photos.length > 0 ? "#15803D" : "#94A3B8"}
                          />
                          <Text style={s.checkText}>Photos added ({photos.length})</Text>
                        </View>
                        <View style={s.checkRow}>
                          <Ionicons
                            name={service.available ? "checkmark-circle" : "pause-circle-outline"}
                            size={16}
                            color={service.available ? "#15803D" : "#D97706"}
                          />
                          <Text style={s.checkText}>
                            Status: {service.available ? "Active" : "Paused"}
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        style={({ pressed }) => [s.editButton, pressed && s.editPressed]}
                        onPress={() => {
                          onClose();
                          router.push({ pathname: "/create-service", params: { editId: service.id } });
                        }}
                      >
                        <Ionicons name="pencil-outline" size={15} color="#0B6B55" />
                        <Text style={s.editButtonText}>Update listing details</Text>
                        <Ionicons name="arrow-forward" size={16} color="#0B6B55" />
                      </Pressable>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(16, 35, 63, 0.45)",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  dragHandleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  growthHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#D9F4E3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBEED8",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#10233F", letterSpacing: -0.4 },
  subtitle: { fontSize: 12, lineHeight: 17, color: "#61718A", marginTop: 2 },
  close: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
  },
  list: { gap: 12, paddingBottom: 10 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#61718A",
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 2,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#EEF9F1",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DDEEE3",
  },
  cardPressed: {
    opacity: Platform.OS === "ios" ? 0.9 : 1,
    backgroundColor: "#E2F5E8",
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionContent: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10233F",
  },
  actionSub: {
    fontSize: 12,
    color: "#61718A",
    lineHeight: 16,
  },
  serviceItemCard: {
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  serviceName: { fontSize: 15, fontWeight: "700", color: "#10233F" },
  checklistGroup: { gap: 6 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkText: { fontSize: 12, color: "#334155" },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    backgroundColor: "#EEF9F1",
    borderRadius: 12,
    marginTop: 4,
  },
  editPressed: {
    backgroundColor: "#DDF4E4",
  },
  editButtonText: { flex: 1, fontSize: 12, fontWeight: "700", color: "#0B6B55" },
});
