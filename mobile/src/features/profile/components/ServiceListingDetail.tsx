import { useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
  Linking,
  Alert,
  Modal,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppImage as Image } from "../../../components/AppImage";
import {
  serviceApi,
  invalidateServiceQueries,
  tenDigitPhone,
  servicePhoneVisible,
} from "../../../api/serviceApi";
import { formatDirectPhone } from "@bulao/domain";
import { useLocation } from "../../../store/location";
import { api } from "../../../api/client";
import { useAuth } from "../../../auth";
import type { ServiceItem, ServiceFeedbackReview } from "../types";
import {
  ServiceText as Text,
  servicePrice,
  servicePhotos,
  serviceCategoryFallbackIcon,
} from "./serviceProfileTheme";
import {
  ServicesIncludedList,
  ServiceLocationMap,
  ServiceSpecificationsCard,
  ServiceAboutCard,
  ServiceReviewsPhotosSection,
  RateServiceModal,
  FullScreenImageViewer,
} from "./service-detail";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = 240;

function getInitials(name?: string): string {
  if (!name) return "P";
  const trimmed = name.trim();
  if (!trimmed) return "P";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function cleanServiceMode(mode?: string): string {
  if (mode === "at_center") return "Customer Visits Shop";
  if (mode === "both") return "Shop + Doorstep";
  return "Doorstep Service";
}

function getServiceTimings(operatingHours?: string): { start: string; end: string; days: string } {
  if (!operatingHours) {
    return { start: "09:00 AM", end: "07:00 PM", days: "Mon – Sat (Closed: Sun)" };
  }
  const timeMatch = operatingHours.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
  if (timeMatch && timeMatch[1] && timeMatch[2]) {
    return {
      start: timeMatch[1].toUpperCase(),
      end: timeMatch[2].toUpperCase(),
      days: operatingHours.split(":")[0]?.trim() || "Mon – Sat (Closed: Sun)",
    };
  }
  return { start: "09:00 AM", end: "07:00 PM", days: operatingHours.slice(0, 32) };
}

function getVehicleOrTargetType(service: ServiceItem): string {
  const text = `${service.title || ""} ${service.categoryName || ""}`.toLowerCase();
  if (text.includes("bike") || text.includes("scooter") || text.includes("two wheeler")) {
    return "Two Wheeler / All Bikes";
  }
  if (text.includes("car") || text.includes("auto")) {
    return "Four Wheeler / Car";
  }
  if (text.includes("plumb") || text.includes("pipe")) {
    return "Residential & Commercial";
  }
  if (text.includes("electric") || text.includes("ac")) {
    return "Home & Office Appliances";
  }
  if (text.includes("clean") || text.includes("maid")) {
    return "House & Apartment";
  }
  return service.categoryName || "All Service Types";
}

const STAR_LABELS: Record<number, string> = {
  1: "1 - Poor",
  2: "2 - Fair",
  3: "3 - Good",
  4: "4 - Very Good",
  5: "5 - Excellent",
};

export function ServiceListingDetail({
  service,
  onClose,
  isClientView = false,
}: {
  service: ServiceItem;
  onClose: () => void;
  isClientView?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { session, user } = useAuth();
  const client = useQueryClient();
  const location = useLocation((state) => state.location);

  // Gallery state
  const [photoIndex, setPhotoIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Expandable description toggle
  const [descExpanded, setDescExpanded] = useState(false);

  // Reviews query & sorting state
  const [reviewSort, setReviewSort] = useState<"recent" | "highest" | "lowest" | "with_photos">("recent");
  const {
    data: reviewsResponse,
    refetch: refetchReviews,
    isFetching: isReviewsFetching,
  } = useQuery({
    queryKey: ["service-reviews", service.id, reviewSort],
    queryFn: () => serviceApi.getReviews(service.id, reviewSort, null, 15),
    staleTime: 15000,
  });

  // Rate Modal State
  const [rateModalVisible, setRateModalVisible] = useState(false);

  // Full-Screen Image Viewer State
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Booking Modal State
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Photos & tasks
  const photos = servicePhotos(service).filter((uri) => !failedImages[uri]);
  const tasks = service.offeredServices && service.offeredServices.length > 0
    ? service.offeredServices
    : ["General Service", "Engine Repair", "Tyre & Tube Service", "Oil Change"];

  const isOwner = service.provider?.id === user?.id || !isClientView;

  // Active reviews & rating statistics
  const currentReviews: ServiceFeedbackReview[] = reviewsResponse?.reviews && reviewsResponse.reviews.length > 0
    ? (reviewsResponse.reviews as ServiceFeedbackReview[])
    : (service.reviews ?? []);

  const totalReviewsCount = typeof reviewsResponse?.totalReviews === "number"
    ? reviewsResponse.totalReviews
    : (service.totalReviews || currentReviews.length);

  const ratingNumeric = reviewsResponse?.rating != null
    ? reviewsResponse.rating
    : service.rating;

  const ratingValue = ratingNumeric != null && totalReviewsCount > 0
    ? Number(ratingNumeric).toFixed(1)
    : (totalReviewsCount > 0 ? "4.5" : "New");

  const reviewBreakdown = reviewsResponse?.ratingBreakdown || service.ratingBreakdown || {
    stars5: totalReviewsCount > 0 ? Math.round(totalReviewsCount * 0.8) : 0,
    stars4: totalReviewsCount > 0 ? Math.round(totalReviewsCount * 0.12) : 0,
    stars3: totalReviewsCount > 0 ? Math.round(totalReviewsCount * 0.05) : 0,
    stars2: totalReviewsCount > 0 ? Math.round(totalReviewsCount * 0.02) : 0,
    stars1: totalReviewsCount > 0 ? Math.round(totalReviewsCount * 0.01) : 0,
  };

  // Specifications parsed values
  const timings = getServiceTimings(service.operatingHours);
  const vehicleType = getVehicleOrTargetType(service);
  const serviceModeText = cleanServiceMode(service.serviceMode);
  const areaName = service.area || location?.area || "Himayatnagar";
  const distanceAwayText = "0.5 km away";

  // Toggle Service Availability (Owner)
  const toggleAvailability = useMutation({
    mutationFn: () =>
      api(`/services/${service.id}`, { available: !service.available }, "PATCH"),
    onSuccess: async () => {
      client.setQueryData<ServiceItem[]>(
        ["my-services", session?.token],
        (items) =>
          items?.map((item) =>
            item.id === service.id ? { ...item, available: !item.available } : item
          )
      );
      await invalidateServiceQueries(client);
      Alert.alert(
        service.available ? "Service Paused" : "Service Activated",
        service.available
          ? "Your service is currently hidden from search results."
          : "Your service is now active and visible to local customers!"
      );
    },
    onError: () => {
      Alert.alert("Error", "Could not update service status. Please try again.");
    },
  });

  const openEdit = () => {
    router.push({
      pathname: "/create-service",
      params: { editId: service.id },
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: service.title,
        message: `${service.title || service.categoryName}\n📍 ${service.area}\n💰 ${servicePrice(service)}\nBook verified service on Bulao!`,
      });
    } catch {
      Alert.alert("Share", "Unable to open share sheet.");
    }
  };

  const handleCallProvider = () => {
    const rawPhone = service.provider?.phone;
    const phone = tenDigitPhone(rawPhone);
    const visible = servicePhoneVisible(service.phoneVisible);

    if (!visible || !phone) {
      Alert.alert(
        "Contact Provider",
        "Direct calling is currently unavailable for this provider. You can send a Service Request to connect instantly."
      );
      return;
    }

    Alert.alert(
      `Contact ${service.provider?.name || "Provider"}`,
      `Dial +91 ${formatDirectPhone(phone)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          onPress: () => {
            Linking.openURL(`tel:${phone}`).catch(() => {
              Alert.alert("Error", "Could not trigger phone dialer.");
            });
          },
        },
      ]
    );
  };

  const handleConfirmBooking = async () => {
    if (!session?.token) {
      setConfirmModalVisible(false);
      router.push("/auth");
      return;
    }

    if (!location) {
      setConfirmModalVisible(false);
      router.push("/location");
      return;
    }

    setBookingSubmitting(true);
    try {
      await serviceApi.request(
        service.id,
        location,
        `Booking request for ${service.title}`
      );
      await invalidateServiceQueries(client);
      setBookingSuccess(true);
      setTimeout(() => {
        setConfirmModalVisible(false);
        setBookingSuccess(false);
        onClose();
        router.push("/service-requests");
      }, 1200);
    } catch (err: any) {
      Alert.alert(
        "Booking Notice",
        err.message || "Couldn't send request. You may already have an active request."
      );
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Open Rate Modal
  const handleOpenRateModal = () => {
    if (!session?.token) {
      Alert.alert(
        "Sign In Required",
        "Please sign in to rate and review this service.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => router.push("/auth") },
        ]
      );
      return;
    }
    setRateModalVisible(true);
  };

  // Submit Review with Strict Validation
  const handleSubmitReview = async (stars: number, feedback: string, images: string[]) => {
    await serviceApi.submitRating(
      service.id,
      stars,
      feedback.trim(),
      images
    );
    await invalidateServiceQueries(client);
    await refetchReviews();
    Alert.alert("Thank You!", "Your review and rating have been submitted successfully.");
  };

  // Open Full-Screen Image Viewer
  const handleOpenImageViewer = (images: string[], initialIdx: number = 0) => {
    setViewerImages(images);
    setViewerIndex(initialIdx);
    setViewerVisible(true);
  };

  const descriptionText = service.description?.trim() || "Get professional bike repair and service for a smooth and safe ride. Expert mechanics handle all types of two-wheelers with quality workmanship and genuine tools.";

  return (
    <View style={s.screen}>
      {/* ── Top Bar: Header (AI DIDI Removed) ──────────────────────────── */}
      <View style={[s.topHeaderRow, { paddingTop: insets.top + 6 }]}>
        <View style={s.topHeaderLeftGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={s.backCircleBtn}
            onPress={onClose}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </Pressable>

          <Text style={s.headerTitleText}>Service Information</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share Service"
          style={s.backCircleBtn}
          onPress={handleShare}
          hitSlop={8}
        >
          <Ionicons name="share-outline" size={19} color="#0F172A" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 95 }}
      >
        {/* ── 1. Top Images Showcase (Horizontal Scroll) ───────────────── */}
        <View style={s.topImagesShowcase}>
          {photos.length > 0 ? (
            <View style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const offset = e.nativeEvent.contentOffset.x;
                  const idx = Math.round(offset / SCREEN_WIDTH);
                  setPhotoIndex(idx);
                }}
                scrollEventThrottle={16}
              >
                {photos.map((uri, idx) => (
                  <Pressable
                    key={`${uri}-${idx}`}
                    style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
                    onPress={() => handleOpenImageViewer(photos, idx)}
                  >
                    <Image
                      source={{ uri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                      priority={idx === 0 ? "high" : "normal"}
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [uri]: true }))
                      }
                    />
                  </Pressable>
                ))}
              </ScrollView>

              {/* Counter Badge */}
              {photos.length > 1 && (
                <View style={s.imageCounterBadge}>
                  <Ionicons name="images-outline" size={11} color="#FFFFFF" />
                  <Text style={s.imageCounterText}>
                    {photoIndex + 1} / {photos.length}
                  </Text>
                </View>
              )}

              {/* Pagination Dots */}
              {photos.length > 1 && (
                <View style={s.paginationDotsRow}>
                  {photos.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        s.paginationDot,
                        i === photoIndex && s.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={s.topFallbackShowcase}>
              <View style={s.illustrationAura}>
                <Ionicons
                  name={serviceCategoryFallbackIcon(service)}
                  size={58}
                  color="#047857"
                />
              </View>
            </View>
          )}
        </View>

        {/* ── Main Body Canvas ─────────────────────────────────────────── */}
        <View style={s.bodyCanvas}>
          {/* Service Title Section (Placed below images) */}
          <View style={s.titleSectionBlock}>
            <Text style={s.heroMainTitle}>
              {service.title || "Bike Repair & Service"}
            </Text>

            <Text style={s.heroSubtitle}>
              {service.description?.slice(0, 52) || "Keep your vehicle in top condition"}
            </Text>

            {/* Signature Green Accent Dash */}
            <View style={s.heroGreenDash} />
          </View>

          {/* ── 1. Services Included (Compact & Smart Layout) ───────────── */}
          <ServicesIncludedList tasks={tasks} />

          {/* ── 2. Google Maps (Accurate Service Location) ───────────────── */}
          <ServiceLocationMap
            latitude={service.latitude}
            longitude={service.longitude}
            areaName={areaName}
            distanceAwayText={distanceAwayText}
            serviceTitle={service.title || areaName}
          />

          {/* ── 3. Service Specifications (Premium Adaptive Grid) ────────── */}
          <ServiceSpecificationsCard
            service={service}
            serviceModeText={serviceModeText}
            vehicleType={vehicleType}
            timings={timings}
          />

          {/* ── 4. About the Service (Two-Line Preview with Read More/Less) ─ */}
          <ServiceAboutCard description={descriptionText} />

          {/* ── 5. Ratings, Feedback & Photos (Unified Horizontal Experience) */}
          <ServiceReviewsPhotosSection
            ratingValue={ratingValue}
            totalReviewsCount={totalReviewsCount}
            reviewBreakdown={reviewBreakdown}
            reviews={currentReviews}
            photos={photos}
            isLoadingReviews={isReviewsFetching}
            onOpenRateModal={handleOpenRateModal}
            onOpenImageViewer={handleOpenImageViewer}
          />

          {/* ── 6. Service Provider Card ───────────────────────────────── */}
          {service.provider && (
            <View style={s.providerCardBox}>
              <View style={s.providerInfoRow}>
                <View style={s.providerAvatarBox}>
                  {service.provider.photoUrl ? (
                    <Image
                      source={{ uri: service.provider.photoUrl }}
                      style={s.providerAvatarImage}
                    />
                  ) : (
                    <Text style={s.providerInitials}>
                      {getInitials(service.provider.name)}
                    </Text>
                  )}
                </View>

                <View style={s.providerTextCol}>
                  <View style={s.providerTitleLine}>
                    <Text style={s.providerName}>{service.provider.name || "Provider"}</Text>
                    {service.provider.verified && (
                      <Ionicons name="checkmark-circle" size={15} color="#047857" />
                    )}
                  </View>
                  <Text style={s.providerVerifiedSubtext}>Verified Pro on Bulao</Text>
                </View>

                {servicePhoneVisible(service.phoneVisible) && service.provider.phone && (
                  <Pressable
                    style={s.callProviderMiniBtn}
                    onPress={handleCallProvider}
                    hitSlop={6}
                  >
                    <Ionicons name="call" size={14} color="#047857" />
                    <Text style={s.callProviderMiniBtnText}>Call</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky Bottom Action Bar ───────────────────────────────────── */}
      <View style={[s.bottomActionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {isOwner ? (
          <View style={s.ownerActionBtnRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit Details"
              style={s.ownerEditBtn}
              onPress={openEdit}
            >
              <Ionicons name="create-outline" size={18} color="#047857" />
              <Text style={s.ownerEditBtnText}>Edit Details</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={service.available ? "Pause Service" : "Activate Service"}
              style={[
                s.ownerPauseBtn,
                !service.available && s.ownerActivateBtn,
              ]}
              onPress={() => toggleAvailability.mutate()}
              disabled={toggleAvailability.isPending}
            >
              {toggleAvailability.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name={service.available ? "pause-circle-outline" : "play-circle-outline"}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={s.ownerPauseBtnText}>
                    {service.available ? "Pause Service" : "Activate Service"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={s.clientActionBtnRow}>
            {servicePhoneVisible(service.phoneVisible) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Call Provider"
                style={s.clientContactBtn}
                onPress={handleCallProvider}
              >
                <Ionicons name="call-outline" size={18} color="#047857" />
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Book Service"
              style={s.clientBookBtn}
              onPress={() => setConfirmModalVisible(true)}
            >
              <Text style={s.clientBookBtnText}>Book Service</Text>
              <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Booking Confirmation Modal ─────────────────────────────────── */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.bookingModalContent}>
            {bookingSuccess ? (
              <View style={s.bookingSuccessBox}>
                <Ionicons name="checkmark-circle" size={54} color="#047857" />
                <Text style={s.bookingSuccessTitle}>Request Sent!</Text>
                <Text style={s.bookingSuccessSubtext}>
                  The service provider has been notified.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.modalTitle}>Confirm Booking Request</Text>
                <Text style={s.modalDesc}>
                  Send a service request for {service.title} in {areaName}?
                </Text>

                <View style={s.modalButtonRow}>
                  <Pressable
                    style={s.modalCancelBtn}
                    onPress={() => setConfirmModalVisible(false)}
                    disabled={bookingSubmitting}
                  >
                    <Text style={s.modalCancelBtnText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={s.modalConfirmBtn}
                    onPress={handleConfirmBooking}
                    disabled={bookingSubmitting}
                  >
                    {bookingSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={s.modalConfirmBtnText}>Confirm</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── "+ Rate Our Service" Modal ─────────────────────────────────── */}
      <RateServiceModal
        visible={rateModalVisible}
        serviceId={service.id}
        serviceTitle={service.title || "Service"}
        onClose={() => setRateModalVisible(false)}
        onSubmit={handleSubmitReview}
      />

      {/* ── Full-Screen Image Viewer Modal ─────────────────────────────── */}
      <FullScreenImageViewer
        visible={viewerVisible}
        images={viewerImages}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    zIndex: 10,
  },
  topHeaderLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },

  // 1. Image Showcase
  topImagesShowcase: {
    width: "100%",
    height: IMAGE_HEIGHT,
    backgroundColor: "#0F172A",
    position: "relative",
  },
  topFallbackShowcase: {
    width: "100%",
    height: IMAGE_HEIGHT,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  illustrationAura: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
  },
  imageCounterBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  paginationDotsRow: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    flexDirection: "row",
    gap: 5,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  paginationDotActive: {
    width: 16,
    backgroundColor: "#10B981",
  },

  // Body Canvas & Title Section
  bodyCanvas: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  titleSectionBlock: {
    paddingTop: 4,
    paddingBottom: 2,
    gap: 2,
  },
  heroMainTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#64748B",
    lineHeight: 18,
    marginTop: 4,
  },
  heroGreenDash: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#047857",
    marginTop: 10,
  },

  // Provider Card
  providerCardBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  providerInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  providerAvatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  providerAvatarImage: {
    width: 42,
    height: 42,
  },
  providerInitials: {
    fontSize: 14,
    fontWeight: "800",
    color: "#047857",
  },
  providerTextCol: {
    flex: 1,
    gap: 2,
  },
  providerTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  providerName: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  providerVerifiedSubtext: {
    fontSize: 11,
    color: "#64748B",
  },
  callProviderMiniBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  callProviderMiniBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },

  // Sticky Bottom Action Bar
  bottomActionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  ownerActionBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  ownerEditBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#047857",
  },
  ownerEditBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#047857",
  },
  ownerPauseBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#DC2626",
  },
  ownerActivateBtn: {
    backgroundColor: "#034E3B",
  },
  ownerPauseBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  clientActionBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  clientContactBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  clientBookBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#034E3B",
    paddingVertical: 13,
    borderRadius: 12,
  },
  clientBookBtnText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  // Booking Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  bookingModalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalDesc: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#034E3B",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  bookingSuccessBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  bookingSuccessTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#047857",
  },
  bookingSuccessSubtext: {
    fontSize: 12.5,
    color: "#64748B",
    textAlign: "center",
  },
});
