import { serviceApi, invalidateServiceQueries, tenDigitPhone, servicePhoneVisible } from "../../../api/serviceApi";
import { formatDirectPhone } from "@bulao/domain";
import { useLocation } from "../../../store/location";
import { useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Share,
  KeyboardAvoidingView,
  Platform,
  Linking,
  TextInput,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../api/client";
import { useAuth } from "../../../auth";
import type { ServiceItem } from "../types";
import {
  ServiceText as Text,
  serviceTheme as theme,
  servicePrice,
  serviceModeLabel,
  servicePhotos,
  serviceTaskLabel,
} from "./serviceProfileTheme";

type Update = Partial<
  Pick<
    ServiceItem,
    | "title"
    | "description"
    | "offeredServices"
    | "radiusKm"
    | "operatingHours"
    | "serviceMode"
    | "pricingModel"
    | "basePricePaise"
    | "available"
  >
>;
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
  const { session } = useAuth();
  const client = useQueryClient();
  const location = useLocation(state => state.location);
  const [tab, setTab] = useState<"overview" | "photos" | "reviews">("overview");
  const [expanded, setExpanded] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [shareError, setShareError] = useState("");

  // Rating & Review Interaction State
  const [myRatingStars, setMyRatingStars] = useState<number>(5);
  const [myRatingFeedback, setMyRatingFeedback] = useState<string>("");
  const [hasAlreadyRated, setHasAlreadyRated] = useState<boolean>(false);
  const [isEditingRating, setIsEditingRating] = useState<boolean>(false);
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);
  const [bookingSubmitting, setBookingSubmitting] = useState<boolean>(false);
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);

  const update = useMutation({
    mutationFn: (changes: Update) =>
      api(`/services/${service.id}`, changes, "PATCH"),
    onSuccess: async (_, changes) => {
      client.setQueryData<ServiceItem[]>(
        ["my-services", session?.token],
        (items) =>
          items?.map((item) =>
            item.id === service.id ? { ...item, ...changes } : item,
          ),
      );
      await invalidateServiceQueries(client);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["my-services"] }),
        client.invalidateQueries({ queryKey: ["myServices"] }),
        client.invalidateQueries({ queryKey: ["nearby"] }),
      ]);
    },
  });
  const photos = servicePhotos(service).filter((uri) => !failed[uri]);
  const currentPhoto =
    photos[Math.min(photoIndex, Math.max(photos.length - 1, 0))];
  const tasks = service.offeredServices ?? [];
  const openEdit = () =>
    router.push({
      pathname: "/create-service",
      params: { editId: service.id },
    });
  const share = async () => {
    setShareError("");
    try {
      await Share.share({
        title: service.title,
        message: `${service.title || service.categoryName}\n${service.area}\n${serviceModeLabel(service)}\n${servicePrice(service)}\nFind my service on Bulao.`,
      });
    } catch {
      setShareError("Couldn't open sharing. Please try again.");
    }
  };

  const callProvider = () => {
    // Phone calling option if phoneVisible is enabled or provider contact available
    const phone = tenDigitPhone(service.provider?.phone);
    if (!phone || !servicePhoneVisible(service.phoneVisible)) { Alert.alert("Phone unavailable", "This provider has disabled direct calling."); return; }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Call Unavailable", "Direct phone calling is not available on this device.");
    });
  };

  const handleBookService = async () => {
    if (!session?.token) {
      router.push("/auth");
      return;
    }
    if (!location) { router.push("/location"); return; }
    if (bookingSubmitting) return;
    setBookingSubmitting(true);
    try {
      await serviceApi.request(service.id, location, `Booking request for ${service.title}`);
      await invalidateServiceQueries(client);
      setBookingSuccess(true);
      setTimeout(() => {
        onClose();
        router.push("/activity"); // Redirect to Requests tab
      }, 1200);
    } catch (err: any) {
      Alert.alert("Booking Error", err.message || "Couldn't send request. You may already have an active request.");
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleSaveRating = async () => {
    if (!session?.token) {
      router.push("/auth");
      return;
    }
    setRatingSubmitting(true);
    try {
      await api(`/services/${service.id}/ratings`, {
        stars: myRatingStars,
        feedback: myRatingFeedback,
      });
      setHasAlreadyRated(true);
      setIsEditingRating(false);
      await client.invalidateQueries({ queryKey: ["nearby"] });
      await invalidateServiceQueries(client);
      Alert.alert("Rating Saved ⭐", "Thank you for rating this service!");
    } catch (err: any) {
      Alert.alert("Rating Failed", err.message || "Could not submit rating. Please try again.");
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleReportReview = async (reviewId: string) => {
    try {
      await api(`/services/${service.id}/ratings/${reviewId}/report`, {
        reason: "Inappropriate review content",
      });
      Alert.alert("Report Submitted", "Thank you for helping keep Bulao safe and trustworthy.");
    } catch {
      Alert.alert("Report failed", "Could not save your report. Please retry.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.hero, !currentPhoto && s.emptyHero]}>
          {currentPhoto ? (
            <Image
              source={{ uri: currentPhoto }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() =>
                setFailed((previous) => ({
                  ...previous,
                  [currentPhoto]: true,
                }))
              }
            />
          ) : (
            <View style={s.heroPlaceholder}>
              <Ionicons name="storefront-outline" size={43} color="#D6EDE3" />
              <Text style={s.placeholderText}>No service photos added</Text>
            </View>
          )}
          <View style={s.heroControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close service details"
              style={s.circle}
              onPress={onClose}
            >
              <Ionicons name="arrow-back" size={21} color={theme.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share service"
              style={s.circle}
              onPress={() => void share()}
            >
              <Ionicons
                name="share-social-outline"
                size={19}
                color={theme.green}
              />
            </Pressable>
          </View>
          {photos.length > 1 && (
            <View style={s.photoControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
                style={s.photoArrow}
                onPress={() =>
                  setPhotoIndex(
                    (photoIndex - 1 + photos.length) % photos.length,
                  )
                }
              >
                <Ionicons name="chevron-back" size={17} color="white" />
              </Pressable>
              <Text style={s.photoCounter}>
                {photoIndex + 1}/{photos.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next photo"
                style={s.photoArrow}
                onPress={() => setPhotoIndex((photoIndex + 1) % photos.length)}
              >
                <Ionicons name="chevron-forward" size={17} color="white" />
              </Pressable>
            </View>
          )}
        </View>
        <View style={s.summary}>
          {!!service.provider?.name && <Text style={s.body}>Provided by {service.provider.name}</Text>}
          {isClientView && (
            servicePhoneVisible(service.phoneVisible) && service.provider?.phone ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 4 }}>
                <Ionicons name="call" size={13} color={theme.green} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: theme.green }}>
                  Direct Mobile: +91 {formatDirectPhone(service.provider.phone)}
                </Text>
              </View>
            ) : (
              <Text style={s.body}>Direct calling is restricted. Tap "Request Service" to connect.</Text>
            )
          )}
          {Object.entries(service.socialLinks ?? {}).filter(([, url]) => /^https?:\/\//i.test(url)).map(([label, url]) => (
            <Pressable key={label} onPress={() => void Linking.openURL(url).catch(() => Alert.alert("Link unavailable"))}><Text style={s.link}>{label}</Text></Pressable>
          ))}
          <View style={s.titleRow}>
            <Text style={s.title} numberOfLines={2}>
              {service.title || service.categoryName}
            </Text>
            <View style={[s.status, !service.available && s.paused]}>
              <Ionicons
                name={service.available ? "briefcase" : "pause"}
                size={11}
                color={service.available ? "white" : theme.muted}
              />
              <Text
                style={[
                  s.statusText,
                  !service.available && { color: theme.muted },
                ]}
              >
                {service.available ? "Active" : "Paused"}
              </Text>
            </View>
          </View>

          {service.provider?.verified && <Text style={s.subtle}>Provider phone verified</Text>}

          <Text style={s.subtle}>{service.categoryName}</Text>
          <View style={s.reputation}>
            <Ionicons
              name={service.totalReviews > 0 ? "star" : "star-outline"}
              size={17}
              color={theme.gold}
            />
            <Text style={s.rating}>
              {service.totalReviews > 0 && service.rating != null
                ? service.rating.toFixed(1)
                : "New"}
            </Text>
            <Text style={s.subtle}>
              {service.totalReviews > 0
                ? `(${service.totalReviews} reviews for this service)`
                : "No reviews for this service yet"}
            </Text>
            {service.completedBookings > 0 && (
              <Text style={s.subtle}>
                {" "}
                · {service.completedBookings} completed
              </Text>
            )}
          </View>
          {!!service.description && (
            <Text numberOfLines={3} style={s.body}>
              {service.description}
            </Text>
          )}
          {!!tasks.length && (
            <View style={s.chips}>
              {tasks.slice(0, 5).map((task, i) => (
                <Text key={`${task}-${i}`} style={s.chip}>
                  {serviceTaskLabel(task)}
                </Text>
              ))}
              {tasks.length > 5 && (
                <Text style={s.chip}>+{tasks.length - 5} more</Text>
              )}
            </View>
          )}
          <View style={s.locationRow}>
            <View style={s.location}>
              <Ionicons name="location" size={17} color={theme.ink} />
              <Text style={[s.subtle, s.flex]}>
                {service.area || "Location not added"}
              </Text>
            </View>
            <View style={s.location}>
              <Ionicons name="home-outline" size={17} color={theme.ink} />
              <Text style={[s.subtle, s.flex]}>
                {serviceModeLabel(service)}
              </Text>
            </View>
          </View>
          {(Boolean(service.experienceYears && service.experienceYears > 0) || Boolean(service.radiusKm && service.radiusKm > 0)) && (
            <View style={[s.locationRow, { borderTopWidth: 0, paddingTop: 0 }]}>
              {Boolean(service.experienceYears && service.experienceYears > 0) ? (
                <View style={s.location}>
                  <Ionicons name="ribbon-outline" size={17} color={theme.ink} />
                  <Text style={[s.subtle, s.flex]}>
                    {service.experienceYears} yrs experience
                  </Text>
                </View>
              ) : null}
              {Boolean(service.radiusKm && service.radiusKm > 0) ? (
                <View style={s.location}>
                  <Ionicons name="navigate-outline" size={17} color={theme.ink} />
                  <Text style={[s.subtle, s.flex]}>
                    Serves within {service.radiusKm} km
                  </Text>
                </View>
              ) : null}
            </View>
          )}
          <View style={s.hours}>
            <Ionicons name="time-outline" size={17} color={theme.ink} />
            <Text style={[s.subtle, s.flex]}>
              {service.operatingHours || "Hours not added"}
            </Text>
            <Text style={s.price}>{servicePrice(service)}</Text>
          </View>
          <View style={s.actions}>
            {bookingSuccess ? (
              <View style={s.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#047857" />
                <Text style={s.successText}>Request sent! Opening Requests tab…</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={bookingSubmitting || !service.available}
                style={[
                  s.action,
                  s.primaryAction,
                  !service.available && { backgroundColor: "#9CA3AF" },
                ]}
                onPress={handleBookService}
              >
                {bookingSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={16} color="white" />
                    <Text style={s.primaryText}>Request Service</Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Direct Call Button (If phoneVisible enabled) */}
            {(servicePhoneVisible(service.phoneVisible) && !!service.provider?.phone) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Call Provider"
                style={s.callAction}
                onPress={callProvider}
              >
                <Ionicons name="call" size={16} color="#047857" />
                <Text style={s.callText}>Call</Text>
              </Pressable>
            )}

            {!isClientView && (
              <Pressable
                accessibilityRole="button"
                style={s.action}
                onPress={openEdit}
              >
                <Ionicons name="pencil-outline" size={15} color={theme.ink} />
                <Text style={s.actionText}>Edit</Text>
              </Pressable>
            )}
          </View>
          {(update.isError || shareError) && (
            <Text accessibilityRole="alert" style={s.error}>
              {shareError || "Couldn't update service. Please try again."}
            </Text>
          )}
        </View>
        <View style={s.tabs}>
          {(["overview", "photos", "reviews"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              onPress={() => setTab(value)}
              style={[s.tab, tab === value && s.tabActive]}
            >
              <Text style={[s.tabText, tab === value && s.tabTextActive]}>
                {value === "overview"
                  ? "Overview"
                  : value === "photos"
                    ? `Photos (${photos.length})`
                    : `Reviews (${service.totalReviews})`}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={s.sections}>
          {tab === "overview" && (
            <>
              <View style={s.panel}>
                <View style={s.panelHeading}>
                  <Ionicons
                    name="document-text-outline"
                    size={21}
                    color={theme.green}
                  />
                  <Text style={[s.label, s.panelText]}>About this service</Text>
                </View>
                <Text
                  style={[s.body, s.panelText]}
                  numberOfLines={expanded ? undefined : 4}
                >
                  {service.description ||
                    "Description not provided."}
                </Text>
                {(service.description?.length ?? 0) > 180 && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setExpanded(!expanded)}
                  >
                    <Text style={[s.link, s.panelText]}>
                      {expanded ? "Read less" : "Read more"}
                    </Text>
                  </Pressable>
                )}
              </View>
              <View style={s.panel}>
                <View style={s.panelHeading}>
                  <Ionicons
                    name="construct-outline"
                    size={21}
                    color={theme.green}
                  />
                  <Text style={[s.label, s.panelText]}>What I provide</Text>
                </View>
                {tasks.length ? (
                  <View style={s.chips}>
                    {tasks.map((task, i) => (
                      <Text key={`${task}-${i}`} style={s.chip}>
                        {serviceTaskLabel(task)}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={[s.body, s.panelText]}>
                    Add the specific services customers can request.
                  </Text>
                )}
              </View>
              <View style={s.tip}>
                <Ionicons name="sparkles-outline" size={23} color="#A07824" />
                <View style={s.flex}>
                  <Text style={s.label}>Make a great first impression</Text>
                  <Text style={s.subtle}>
                    Clear details and up-to-date availability help customers
                    book with confidence.
                  </Text>
                </View>
              </View>
            </>
          )}
          {tab === "photos" &&
            (photos.length ? (
              <View style={s.gallery}>
                {photos.map((uri) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={s.galleryPhoto}
                    onError={() =>
                      setFailed((previous) => ({
                        ...previous,
                        [uri]: true,
                      }))
                    }
                  />
                ))}
              </View>
            ) : (
              <View style={s.panel}>
                <Text style={[s.label, s.panelText]}>No photos to show yet</Text>
                <Text style={[s.body, s.panelText]}>
                  Only uploaded photos from this service appear here.
                </Text>
              </View>
            ))}
          {tab === "reviews" && (
            <View style={{ gap: 14 }}>
              {/* Interactive Single-Rating & Edit Form */}
              <View style={s.rateCard}>
                <View style={s.rateHeader}>
                  <Text style={s.rateTitle}>
                    {hasAlreadyRated && !isEditingRating
                      ? "Your Service Review"
                      : isEditingRating
                      ? "Edit Your Review"
                      : "Rate This Specific Service"}
                  </Text>
                  {hasAlreadyRated && !isEditingRating && (
                    <View style={s.ratedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#047857" />
                      <Text style={s.ratedBadgeText}>Already Rated</Text>
                    </View>
                  )}
                </View>

                {hasAlreadyRated && !isEditingRating ? (
                  <View style={{ gap: 8 }}>
                    <Text style={s.subtle}>
                      You rated this service {myRatingStars} ★. You can edit your review at any time.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      style={s.editRateBtn}
                      onPress={() => setIsEditingRating(true)}
                    >
                      <Ionicons name="create-outline" size={15} color={theme.green} />
                      <Text style={s.editRateText}>Edit Rating & Feedback</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    <Text style={s.subtle}>
                      Rate your experience specifically for {service.title || service.categoryName}:
                    </Text>

                    {/* Interactive 5-Star Row */}
                    <View style={s.starPickerRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Pressable
                          key={star}
                          accessibilityRole="button"
                          onPress={() => setMyRatingStars(star)}
                          style={{ padding: 4 }}
                        >
                          <Ionicons
                            name={star <= myRatingStars ? "star" : "star-outline"}
                            size={28}
                            color={theme.gold}
                          />
                        </Pressable>
                      ))}
                    </View>

                    <TextInput
                      value={myRatingFeedback}
                      onChangeText={setMyRatingFeedback}
                      placeholder="Write feedback for this service (optional)..."
                      placeholderTextColor={theme.muted}
                      style={s.feedbackInput}
                      multiline
                      numberOfLines={3}
                    />

                    <Pressable
                      accessibilityRole="button"
                      disabled={ratingSubmitting}
                      style={s.submitRateBtn}
                      onPress={handleSaveRating}
                    >
                      {ratingSubmitting ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={s.submitRateText}>
                          {hasAlreadyRated ? "Update Rating" : "Submit Rating"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Existing Reviews List */}
              {service.reviews?.length ? (
                <>
                  {service.reviews.map((review) => (
                    <View key={review.id} style={s.panel}>
                      <View style={s.titleRow}>
                        <Text style={[s.label, s.panelText]}>
                          {review.authorName}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={[s.rating, s.panelText]}>★ {review.stars}</Text>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => handleReportReview(review.id)}
                            hitSlop={6}
                          >
                            <Ionicons name="flag-outline" size={13} color={theme.muted} />
                          </Pressable>
                        </View>
                      </View>
                      <Text style={[s.body, s.panelText]}>
                        {review.body || "Left a rating"}
                      </Text>
                    </View>
                  ))}
                  {service.totalReviews > service.reviews.length && (
                    <Text style={s.subtle}>Showing recent reviews</Text>
                  )}
                </>
              ) : (
                <View style={s.panel}>
                  <Text style={[s.label, s.panelText]}>
                    {service.totalReviews
                      ? "Reviews aren't available right now"
                      : "No reviews for this service yet"}
                  </Text>
                  <Text style={[s.body, s.panelText]}>
                    Be the first customer to rate this specific service above!
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  panelText: { color: theme.ink },
  screen: { flex: 1, backgroundColor: theme.background },
  hero: { height: 210, backgroundColor: theme.green },
  emptyHero: { height: 145 },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 20,
  },
  placeholderText: { fontSize: 12, color: "#D6EDE3" },
  heroControls: {
    position: "absolute",
    top: 12,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  circle: {
    height: 38,
    width: 38,
    borderRadius: 19,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  photoControls: {
    position: "absolute",
    bottom: 12,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "rgba(15,32,38,.65)",
  },
  photoArrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  photoCounter: { fontSize: 11, color: "white" },
  summary: { padding: 16, gap: 9, backgroundColor: "white" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: theme.green,
  },
  paused: { backgroundColor: "#EEF1F4" },
  statusText: { fontSize: 10, fontWeight: "700", color: "white" },
  subtle: { fontSize: 11, lineHeight: 17, color: theme.muted },
  reputation: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  rating: { fontSize: 13, fontWeight: "800" },
  body: { fontSize: 12, lineHeight: 19, color: "#687E91" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    fontSize: 10,
    lineHeight: 15,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#EFF3F8",
    color: "#587086",
  },
  locationRow: {
    flexDirection: "row",
    gap: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.border,
    paddingVertical: 12,
  },
  location: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  flex: { flex: 1 },
  hours: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    paddingVertical: 2,
  },
  price: { fontSize: 11, fontWeight: "700", color: theme.green },
  actions: { flexDirection: "row", gap: 8, marginTop: 5 },
  action: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    backgroundColor: "#EFF3F8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
  },
  primaryAction: { flex: 1.35, backgroundColor: theme.green },
  primaryText: { fontSize: 11, fontWeight: "700", color: "white" },
  actionText: { fontSize: 11, fontWeight: "700" },
  tabs: {
    backgroundColor: "white",
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: theme.border,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: theme.green },
  tabText: { fontSize: 12, fontWeight: "600", color: theme.muted },
  tabTextActive: { color: theme.green },
  sections: {
    padding: 16,
    gap: 12,
    width: "100%",
    maxWidth: 650,
    alignSelf: "center",
  },
  panel: {
    backgroundColor: theme.pale,
    borderWidth: 1,
    borderColor: "#DDEEE3",
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  panelHeading: { flexDirection: "row", gap: 9, alignItems: "center" },
  label: { fontSize: 13, fontWeight: "700" },
  link: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.green,
    paddingVertical: 4,
  },
  tip: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: "#FFF7DF",
    padding: 16,
    borderRadius: 16,
  },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  galleryPhoto: { width: "48%", aspectRatio: 1, borderRadius: 12 },
  error: { fontSize: 12, lineHeight: 18, color: "#B14436" },

  // Reward Badge Styles
  rewardRow: {
    flexDirection: "row",
    marginTop: 2,
    marginBottom: 4,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  rewardText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },

  // Direct Call & Success Styles
  callAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  callText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047857",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    flex: 1,
  },
  successText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },

  // Interactive Single-Rating Form Styles
  rateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6ECE8",
    gap: 12,
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  rateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rateTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.ink,
  },
  ratedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ratedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  editRateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#F4F7F5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  editRateText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.green,
  },
  starPickerRow: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "center",
    marginVertical: 4,
  },
  feedbackInput: {
    backgroundColor: "#FAFBF9",
    borderWidth: 1,
    borderColor: "#E2E8E4",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: theme.ink,
    textAlignVertical: "top",
    minHeight: 70,
  },
  submitRateBtn: {
    backgroundColor: theme.green,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitRateText: {
    fontSize: 13,
    fontWeight: "700",
    color: "white",
  },
});
