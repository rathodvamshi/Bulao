import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useAuth } from "../../auth";
import type { ServiceMode } from "./ServicePhotosContactStep";

// ── Design Tokens ──
const GREEN = "#15803D";
const GREEN_DARK = "#14532D";
const GREEN_SOFT = "#DCFCE7";
const GREEN_BG = "#F0FDF4";
const GREEN_BORDER = "#BBF7D0";
const TEXT_PRIMARY = "#0F172A";
const TEXT_SECONDARY = "#64748B";
const BORDER = "#E2E8F0";
const WHITE = "#FFFFFF";

// Icon color palettes for tasks
const TASK_ICON_PALETTES: Record<string, { color: string; bg: string }> = {
  general_service:       { color: "#16A34A", bg: "#F0FDF4" },
  brake_repair:          { color: "#059669", bg: "#D1FAE5" },
  oil_change:            { color: "#EA580C", bg: "#FFF7ED" },
  battery_service:       { color: "#2563EB", bg: "#EFF6FF" },
  tyre_repair:           { color: "#0F172A", bg: "#F1F5F9" },
  chain_maintenance:     { color: "#2563EB", bg: "#EFF6FF" },
  engine_repair:         { color: "#7C3AED", bg: "#EDE9FE" },
  clutch_repair:         { color: "#0F172A", bg: "#F1F5F9" },
  dent_painting:         { color: "#9333EA", bg: "#F5F3FF" },
  diagnostics:           { color: "#0284C7", bg: "#F0F9FF" },
  pipe_leakage_fix:      { color: "#0891B2", bg: "#ECFEFF" },
  tap_repair_replace:    { color: "#2563EB", bg: "#EFF6FF" },
  drain_cleaning:        { color: "#EA580C", bg: "#FFF7ED" },
  wiring_repair:         { color: "#CA8A04", bg: "#FEF9C3" },
  switch_socket_fix:     { color: "#DC2626", bg: "#FEE2E2" },
  fan_installation:      { color: "#0891B2", bg: "#ECFEFF" },
  light_installation:    { color: "#D97706", bg: "#FEF3C7" },
  full_home_deep_clean:  { color: "#16A34A", bg: "#F0FDF4" },
  classic_haircut:       { color: "#C026D3", bg: "#FDF2F8" },
  hair_styling:          { color: "#DB2777", bg: "#FCE7F3" },
  ac_service:            { color: "#0891B2", bg: "#ECFEFF" },
  gas_refilling:         { color: "#2563EB", bg: "#EFF6FF" },
  default:               { color: "#15803D", bg: "#F0FDF4" },
};

const DEFAULT_TASK_PALETTE: { color: string; bg: string } = {
  color: "#15803D",
  bg: "#F0FDF4",
};

function getTaskIconStyle(optionId: string): { color: string; bg: string } {
  const key = optionId.toLowerCase().replace(/-/g, "_");
  const found = TASK_ICON_PALETTES[key];
  if (found) return found;
  return DEFAULT_TASK_PALETTE;
}

function mapOptionIcon(id?: string): keyof typeof Ionicons.glyphMap {
  if (!id) return "construct-outline";
  const key = id.toLowerCase();
  if (key.includes("general") || key.includes("periodic") || key.includes("service")) return "settings-outline";
  if (key.includes("brake") || key.includes("disc")) return "disc-outline";
  if (key.includes("oil") || key.includes("filter")) return "color-fill-outline";
  if (key.includes("battery")) return "battery-charging-outline";
  if (key.includes("tyre") || key.includes("wheel") || key.includes("tire")) return "ellipse-outline";
  if (key.includes("chain") || key.includes("link")) return "link-outline";
  if (key.includes("engine") || key.includes("motor")) return "hardware-chip-outline";
  if (key.includes("clutch") || key.includes("gear")) return "aperture-outline";
  if (key.includes("paint") || key.includes("dent")) return "color-palette-outline";
  if (key.includes("diagnostic") || key.includes("scan")) return "pulse-outline";
  if (key.includes("wash") || key.includes("clean")) return "sparkles-outline";
  if (key.includes("pipe") || key.includes("leak") || key.includes("tap") || key.includes("plumb")) return "water-outline";
  if (key.includes("wire") || key.includes("light") || key.includes("power") || key.includes("electr")) return "flash-outline";
  if (key.includes("hair") || key.includes("cut") || key.includes("salon")) return "cut-outline";
  if (key.includes("ac") || key.includes("cool")) return "snow-outline";
  return "construct-outline";
}

export interface ServiceReviewStepProps {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  serviceId: string;
  serviceName?: string;
  title: string;
  businessName?: string;
  description?: string;
  offeredServices: string[];
  customServices: string[];
  serviceMode: ServiceMode;
  radiusKm: number;
  location: {
    area: string;
    latitude: number;
    longitude: number;
  } | null;
  operatingHours?: string;
  servicePhotos: string[];
  shopPhotos: string[];
  phoneVisible: boolean;
  userPhone?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  onEditStep: (stepIndex: number) => void;
  onPublish: () => void;
  onBack: () => void;
  isPublishing: boolean;
  isEditing?: boolean;
  publishError?: string | null;
}

export function ServiceReviewStep({
  categoryId,
  categoryName,
  categoryIcon,
  serviceId,
  serviceName,
  title,
  businessName,
  description,
  offeredServices,
  customServices,
  serviceMode,
  radiusKm,
  location,
  operatingHours,
  servicePhotos,
  shopPhotos,
  phoneVisible,
  userPhone,
  website,
  instagram,
  facebook,
  onEditStep,
  onPublish,
  onBack,
  isPublishing,
  isEditing = false,
  publishError,
}: ServiceReviewStepProps) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const { user } = useAuth();

  // Full-screen image preview
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  // Gallery Modal state
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<"all" | "service" | "shop">("all");

  // Tasks expand state
  const [isTasksExpanded, setIsTasksExpanded] = useState(false);

  // Combine all uploaded photos
  const allPhotos = [...servicePhotos, ...shopPhotos];
  const maxThumbnails = 4;
  const displayedPhotos = allPhotos.slice(0, maxThumbnails);
  const remainingPhotoCount = allPhotos.length - maxThumbnails;

  // Filtered photos for gallery modal
  const filteredGalleryPhotos =
    galleryFilter === "service"
      ? servicePhotos
      : galleryFilter === "shop"
      ? shopPhotos
      : allPhotos;

  // Combine all task tags
  const allTasks = [...offeredServices, ...customServices];
  const maxTasks = 6;
  const displayedTasks = allTasks.slice(0, maxTasks);
  const remainingTaskCount = allTasks.length - maxTasks;

  // Phone number
  const rawPhone = userPhone || user?.phone || "";
  const displayPhone = formatPhoneNumber(rawPhone);

  const displayService =
    serviceName ||
    (serviceId
      ? serviceId
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ")
      : "Service not selected");

  const displayCategory = categoryName || "Category not selected";
  const displayTitle = businessName || title || displayService;

  // Coordinates fallback
  const latitude = location?.latitude ?? 0;
  const longitude = location?.longitude ?? 0;


  return (
    <View style={styles.container}>
      <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutLarge]}>
        {/* Left Column (Independent Summary Cards) */}
        <View style={[styles.formColumn, isLargeScreen && styles.formColumnLarge]}>
          {/* Hero Header Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.tagText}>REVIEW & PUBLISH</Text>
              <Text style={styles.heroTitle}>
                You're all set! <Text style={styles.partyPopperEmoji}>🎉</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                Review your details below and make sure everything is correct. You can edit any section before publishing.
              </Text>
            </View>

            {/* Stamp / Community Badge */}
            <View style={styles.stampBlobContainer}>
              <View style={styles.stampBlobHeart}>
                <Ionicons name="heart-outline" size={24} color={GREEN} />
              </View>
              <View style={styles.stampBlobTextGroup}>
                <Text style={[styles.stampBlobWord, styles.stampBlobWord1]}>Local</Text>
                <Text style={[styles.stampBlobWord, styles.stampBlobWord2]}>People</Text>
                <Text style={[styles.stampBlobWord, styles.stampBlobWord3]}>Stronger</Text>
                <Text style={[styles.stampBlobWord, styles.stampBlobWord4]}>Communities</Text>
                <View style={styles.stampBlobUnderline} />
              </View>
            </View>
          </View>

          {/* CARD 1: Category & Service */}
          <View style={styles.summaryCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBox, { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" }]}>
                <Ionicons
                  name={getCategoryIcon(categoryId, serviceId)}
                  size={24}
                  color={GREEN}
                />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardSectionLabel}>Category & Service</Text>
                <Text style={styles.cardBreadcrumbText}>
                  {displayCategory} <Text style={styles.breadcrumbSep}>›</Text> {displayService}
                </Text>
                <Text style={styles.cardSubServiceText}>{displayService}</Text>
              </View>
              <Pressable
                style={styles.editBtn}
                onPress={() => onEditStep(1)}
                accessibilityRole="button"
                accessibilityLabel="Edit category and service"
              >
                <Ionicons name="pencil" size={12} color={GREEN} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>
          </View>

          {/* CARD 2: Service Details */}
          <View style={styles.summaryCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBox, { backgroundColor: "#EDE9FE", borderColor: "#DDD6FE" }]}>
                <Ionicons name="document-text" size={24} color="#7C3AED" />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardSectionLabel}>Service Details</Text>
                <Text style={styles.cardHighlightText}>{displayTitle}</Text>
              </View>
              <Pressable
                style={styles.editBtn}
                onPress={() => onEditStep(2)}
                accessibilityRole="button"
                accessibilityLabel="Edit service details"
              >
                <Ionicons name="pencil" size={12} color={GREEN} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>

            {Boolean(description?.trim()) && (
              <View style={styles.descBox}>
                <Text style={styles.descText} numberOfLines={3}>
                  {description}
                </Text>
              </View>
            )}

            {/* Offered Tasks with Individual Icons & Color Themes */}
            {allTasks.length > 0 && (
              <View style={styles.tasksSectionWrapper}>
                <View style={styles.tasksSectionHeader}>
                  <Text style={styles.tasksSubtitle}>Services & Tasks Offered</Text>
                  <View style={styles.tasksCountPill}>
                    <Text style={styles.tasksCountText}>{allTasks.length} selected</Text>
                  </View>
                </View>

                <View style={styles.taskChipsWrap}>
                  {(isTasksExpanded ? allTasks : displayedTasks).map((task, idx) => {
                    const iconStyle = getTaskIconStyle(task);
                    const iconName = mapOptionIcon(task);
                    return (
                      <View key={`task-${idx}`} style={styles.taskCardItem}>
                        <View
                          style={[
                            styles.taskCardIconCircle,
                            { backgroundColor: iconStyle.bg },
                          ]}
                        >
                          <Ionicons
                            name={iconName}
                            size={13}
                            color={iconStyle.color}
                          />
                        </View>
                        <Text style={styles.taskCardItemText}>
                          {formatTaskName(task)}
                        </Text>
                      </View>
                    );
                  })}
                  {!isTasksExpanded && remainingTaskCount > 0 && (
                    <Pressable
                      style={styles.taskMoreChip}
                      onPress={() => setIsTasksExpanded(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`View all ${allTasks.length} offered tasks`}
                    >
                      <Ionicons name="add-circle" size={14} color={GREEN_DARK} />
                      <Text style={styles.taskMoreChipText}>
                        +{remainingTaskCount} more (Tap to view all)
                      </Text>
                    </Pressable>
                  )}
                </View>

                {isTasksExpanded && allTasks.length > maxTasks && (
                  <Pressable
                    style={styles.taskShowLessBtn}
                    onPress={() => setIsTasksExpanded(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Show fewer tasks"
                  >
                    <Text style={styles.taskShowLessText}>Show less</Text>
                    <Ionicons name="chevron-up" size={14} color={GREEN} />
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* CARD 3: Service Location */}
          <View style={styles.summaryCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBox, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
                <Ionicons name="location" size={24} color={GREEN} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardSectionLabel}>Service Location</Text>
              </View>
              <Pressable
                style={styles.editBtn}
                onPress={() => onEditStep(3)}
                accessibilityRole="button"
                accessibilityLabel="Edit service location"
              >
                <Ionicons name="pencil" size={12} color={GREEN} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.locationBody}>
              <View style={styles.locationLeftInfo}>
                {/* Delivery Mode Badge */}
                <View style={styles.modeBadge}>
                  <Ionicons
                    name={
                      serviceMode === "doorstep"
                        ? "home"
                        : serviceMode === "at_center"
                        ? "storefront"
                        : "swap-horizontal"
                    }
                    size={13}
                    color={GREEN_DARK}
                  />
                  <Text style={styles.modeBadgeText}>
                    {serviceMode === "doorstep"
                      ? "I come to customer"
                      : serviceMode === "at_center"
                      ? "Customer comes to me"
                      : "Both (Shop + Home service)"}
                  </Text>
                </View>

                {/* Location Address */}
                <View style={styles.locationAddressRow}>
                  <Ionicons name="location-sharp" size={16} color="#DC2626" />
                  <Text style={styles.locationAddressText}>
                    {location?.area || "Location not selected"}
                  </Text>
                </View>

                {serviceMode !== "at_center" && (
                  <Text style={styles.radiusSubText}>
                    Service radius: Within {radiusKm} km
                  </Text>
                )}
              </View>

              {/* Embedded Google Map Preview */}
              <Pressable
                style={styles.embeddedMapBox}
                onPress={() => onEditStep(3)}
                accessibilityRole="button"
                accessibilityLabel="View location on Google Map"
              >
                {Platform.OS !== "web" && location ? (
                  <MapView
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={{
                      latitude,
                      longitude,
                      latitudeDelta: 0.03,
                      longitudeDelta: 0.03,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                    pointerEvents="none"
                  >
                    <Marker coordinate={{ latitude, longitude }}>
                      <View style={styles.miniMapPin}>
                        <Ionicons name="location" size={18} color="#DC2626" />
                      </View>
                    </Marker>
                  </MapView>
                ) : (
                  <View style={styles.webMapFallback}>
                    <Ionicons name="map" size={24} color={GREEN} />
                  </View>
                )}

                {/* Floating "View on Map" Pill */}
                <View style={styles.mapThumbOverlayPill}>
                  <Text style={styles.mapThumbOverlayText}>View on Map</Text>
                  <Ionicons name="chevron-forward" size={11} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>
          </View>

          {/* CARD 4: Availability */}
          <View style={styles.summaryCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBox, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                <Ionicons name="time" size={24} color="#D97706" />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardSectionLabel}>Availability</Text>
                <Text style={styles.cardHighlightText}>
                  {operatingHours || "Mon - Sat: 09:00 AM - 07:00 PM"}
                </Text>
              </View>
              <Pressable
                style={styles.editBtn}
                onPress={() => onEditStep(4)}
                accessibilityRole="button"
                accessibilityLabel="Edit availability"
              >
                <Ionicons name="pencil" size={12} color={GREEN} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>
          </View>

          {/* CARD 5: Photos (Contained, No Overflow) */}
          <View style={styles.summaryCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBox, { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}>
                <Ionicons name="images" size={24} color="#6D28D9" />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardSectionLabel}>Photos</Text>
                <Text style={styles.cardSubText}>
                  {allPhotos.length > 0
                    ? `${allPhotos.length} photo${allPhotos.length > 1 ? "s" : ""} added`
                    : "No service photos added (Optional)"}
                </Text>
              </View>
              <View style={styles.cardHeaderActions}>
                {allPhotos.length > 0 && (
                  <Pressable
                    style={styles.viewAllPhotosHeaderBtn}
                    onPress={() => setIsGalleryOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="View all photos"
                  >
                    <Ionicons name="images-outline" size={13} color={GREEN} />
                    <Text style={styles.viewAllPhotosHeaderBtnText}>View all</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.editBtn}
                  onPress={() => onEditStep(5)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit photos"
                >
                  <Ionicons name="pencil" size={12} color={GREEN} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
            </View>

            {allPhotos.length > 0 ? (
              <View style={styles.photosGridContainer}>
                {displayedPhotos.map((uri, idx) => {
                  const isLastWithMore = idx === maxThumbnails - 1 && remainingPhotoCount > 0;
                  return (
                    <Pressable
                      key={`review-photo-${idx}`}
                      style={styles.photoThumbItem}
                      onPress={() => {
                        if (isLastWithMore) {
                          setIsGalleryOpen(true);
                        } else {
                          setSelectedPhotoPreview(uri);
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isLastWithMore
                          ? `View all ${allPhotos.length} photos`
                          : `Preview photo ${idx + 1}`
                      }
                    >
                      <Image source={{ uri }} style={styles.photoThumbImg} />
                      {isLastWithMore && (
                        <View style={styles.photoThumbMoreOverlay}>
                          <Ionicons name="grid-outline" size={16} color="#FFFFFF" />
                          <Text style={styles.photoThumbMoreText}>+{remainingPhotoCount}</Text>
                          <Text style={styles.photoThumbMoreSub}>View all</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyPhotosBox}>
                <Ionicons name="camera-outline" size={20} color="#94A3B8" />
                <Text style={styles.emptyPhotosText}>No photos uploaded (Optional)</Text>
              </View>
            )}
          </View>

          {/* CARD 6: Contact */}
          <View style={styles.summaryCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBox, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                <Ionicons name="call" size={24} color="#2563EB" />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardSectionLabel}>Contact</Text>
                <View style={styles.contactRow}>
                  <Text style={styles.contactPhone}>{displayPhone}</Text>
                  <View
                    style={[
                      styles.privacyPill,
                      phoneVisible ? styles.privacyPillVisible : styles.privacyPillHidden,
                    ]}
                  >
                    <Ionicons
                      name={phoneVisible ? "call" : "lock-closed"}
                      size={11}
                      color={phoneVisible ? GREEN_DARK : "#475569"}
                    />
                    <Text
                      style={[
                        styles.privacyPillText,
                        phoneVisible && styles.privacyPillTextVisible,
                      ]}
                    >
                      {phoneVisible ? "Visible to customers" : "Hidden from customers"}
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable
                style={styles.editBtn}
                onPress={() => onEditStep(5)}
                accessibilityRole="button"
                accessibilityLabel="Edit contact details"
              >
                <Ionicons name="pencil" size={12} color={GREEN} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.contactHelperCard}>
              <Ionicons
                name={phoneVisible ? "checkmark-circle" : "shield-checkmark"}
                size={16}
                color={phoneVisible ? GREEN : "#2563EB"}
              />
              <Text style={styles.contactHelperText}>
                {phoneVisible
                  ? "Customers can call you directly on your phone."
                  : "Customers will send you a service request through Bulao."}
              </Text>
            </View>
          </View>

          {/* CARD 7: Online Presence */}
          <View style={styles.summaryCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBox, { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" }]}>
                <Ionicons name="link" size={24} color="#0284C7" />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardSectionLabel}>Online Presence</Text>
                {!website && !instagram && !facebook && (
                  <Text style={styles.cardSubText}>No online links added (Optional)</Text>
                )}
              </View>
              <Pressable
                style={styles.editBtn}
                onPress={() => onEditStep(5)}
                accessibilityRole="button"
                accessibilityLabel="Edit online presence"
              >
                <Ionicons name="pencil" size={12} color={GREEN} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>

            {(Boolean(website) || Boolean(instagram) || Boolean(facebook)) && (
              <View style={styles.onlineLinksList}>
                {Boolean(instagram) && (
                  <View style={styles.onlineLinkRow}>
                    <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                    <Text style={styles.onlineLinkText} numberOfLines={1}>
                      {cleanUrl(instagram!)}
                    </Text>
                    <Ionicons name="open-outline" size={14} color="#64748B" />
                  </View>
                )}
                {Boolean(website) && (
                  <View style={styles.onlineLinkRow}>
                    <Ionicons name="globe-outline" size={18} color="#2563EB" />
                    <Text style={styles.onlineLinkText} numberOfLines={1}>
                      {cleanUrl(website!)}
                    </Text>
                    <Ionicons name="open-outline" size={14} color="#64748B" />
                  </View>
                )}
                {Boolean(facebook) && (
                  <View style={styles.onlineLinkRow}>
                    <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                    <Text style={styles.onlineLinkText} numberOfLines={1}>
                      {cleanUrl(facebook!)}
                    </Text>
                    <Ionicons name="open-outline" size={14} color="#64748B" />
                  </View>
                )}
              </View>
            )}
          </View>

          {/* CARD 7: Trust / Guideline Card */}
          <View style={styles.trustGuidelineCard}>
            <View style={styles.trustGuidelineHeader}>
              <View style={styles.trustShieldIcon}>
                <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.trustGuidelineTextGroup}>
                <Text style={styles.trustGuidelineTitle}>Looks good!</Text>
                <Text style={styles.trustGuidelineDesc}>
                  By publishing, you agree to Bulao's community guidelines and terms of service.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={GREEN} />
            </View>
          </View>

          {/* Publish Error Notification if any */}
          {Boolean(publishError) && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorText}>{publishError}</Text>
            </View>
          )}

          {/* Primary Publish Actions */}
          <View style={styles.actionsGroup}>
            <Pressable
              style={[styles.publishBtn, isPublishing && styles.publishBtnDisabled]}
              onPress={onPublish}
              disabled={isPublishing}
              accessibilityRole="button"
              accessibilityLabel={isEditing ? "Save service changes" : "Publish service"}
            >
              <View style={styles.publishBtnContent}>
                <Ionicons name="rocket" size={22} color="#FFFFFF" />
                <Text style={styles.publishBtnText}>{isEditing ? "Save Changes" : "Publish Service"}</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </View>
            </Pressable>

            <Pressable
              style={styles.backEditBtn}
              onPress={onBack}
              disabled={isPublishing}
              accessibilityRole="button"
              accessibilityLabel="Back and edit"
            >
              <Ionicons name="arrow-back" size={18} color="#475569" />
              <Text style={styles.backEditBtnText}>Back and Edit</Text>
            </Pressable>
          </View>
        </View>

        {/* Right Column (Tablet / Large Screen Branding Banner) */}
        {isLargeScreen && (
          <View style={styles.sidebarColumn}>
            {/* Main Feature Highlight */}
            <View style={styles.brandHeroCard}>
              <Text style={styles.brandHeroTitle}>
                Turn your skills{"\n"}into opportunities
              </Text>
              <Text style={styles.brandHeroSubtitle}>
                Get discovered by people nearby and grow your service.
              </Text>

              {/* 3 Pillars */}
              <View style={styles.pillarsRow}>
                <View style={styles.pillarItem}>
                  <View style={[styles.pillarIcon, { backgroundColor: "#DCFCE7" }]}>
                    <Ionicons name="people" size={20} color={GREEN} />
                  </View>
                  <Text style={styles.pillarHeading}>Reach</Text>
                  <Text style={styles.pillarSub}>local customers</Text>
                </View>

                <View style={styles.pillarItem}>
                  <View style={[styles.pillarIcon, { backgroundColor: "#FEF3C7" }]}>
                    <Ionicons name="bar-chart" size={20} color="#D97706" />
                  </View>
                  <Text style={styles.pillarHeading}>Build</Text>
                  <Text style={styles.pillarSub}>your reputation</Text>
                </View>

                <View style={styles.pillarItem}>
                  <View style={[styles.pillarIcon, { backgroundColor: "#EDE9FE" }]}>
                    <Ionicons name="trending-up" size={20} color="#7C3AED" />
                  </View>
                  <Text style={styles.pillarHeading}>More work</Text>
                  <Text style={styles.pillarSub}>more growth</Text>
                </View>
              </View>
            </View>

            {/* Provider Spotlight / Slogan Card */}
            <View style={styles.providerSpotlightCard}>
              <View style={styles.quoteBubble}>
                <Text style={styles.quoteText}>
                  “ Same People{"\n"}  New Opportunities ”
                </Text>
              </View>

              <View style={styles.sloganWatermark}>
                <Text style={styles.sloganHandwriting}>Local Services</Text>
                <Text style={[styles.sloganHandwriting, { color: GREEN }]}>
                  Stronger Communities 💚
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Complete Photos Gallery Modal */}
      <Modal
        visible={isGalleryOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsGalleryOpen(false)}
      >
        <View style={styles.galleryModalOverlay}>
          <View style={styles.galleryModalCard}>
            {/* Gallery Header */}
            <View style={styles.galleryHeader}>
              <View style={styles.galleryHeaderTitleRow}>
                <View style={styles.galleryIconPill}>
                  <Ionicons name="images" size={18} color={GREEN} />
                </View>
                <View>
                  <Text style={styles.galleryTitle}>All Photos</Text>
                  <Text style={styles.gallerySubTitle}>
                    {allPhotos.length} photo{allPhotos.length > 1 ? "s" : ""} uploaded
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.galleryCloseBtn}
                onPress={() => setIsGalleryOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close photos gallery"
              >
                <Ionicons name="close" size={20} color="#475569" />
              </Pressable>
            </View>

            {/* Gallery Filter Tabs (if both categories exist) */}
            {servicePhotos.length > 0 && shopPhotos.length > 0 && (
              <View style={styles.galleryTabsRow}>
                <Pressable
                  style={[
                    styles.galleryTabItem,
                    galleryFilter === "all" && styles.galleryTabItemActive,
                  ]}
                  onPress={() => setGalleryFilter("all")}
                >
                  <Text
                    style={[
                      styles.galleryTabText,
                      galleryFilter === "all" && styles.galleryTabTextActive,
                    ]}
                  >
                    All ({allPhotos.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.galleryTabItem,
                    galleryFilter === "service" && styles.galleryTabItemActive,
                  ]}
                  onPress={() => setGalleryFilter("service")}
                >
                  <Text
                    style={[
                      styles.galleryTabText,
                      galleryFilter === "service" && styles.galleryTabTextActive,
                    ]}
                  >
                    Service ({servicePhotos.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.galleryTabItem,
                    galleryFilter === "shop" && styles.galleryTabItemActive,
                  ]}
                  onPress={() => setGalleryFilter("shop")}
                >
                  <Text
                    style={[
                      styles.galleryTabText,
                      galleryFilter === "shop" && styles.galleryTabTextActive,
                    ]}
                  >
                    Shop/Location ({shopPhotos.length})
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Gallery Scrollable Grid */}
            <ScrollView
              contentContainerStyle={styles.galleryScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.galleryGrid}>
                {filteredGalleryPhotos.map((uri, idx) => {
                  const isShopPhoto = shopPhotos.includes(uri);
                  return (
                    <Pressable
                      key={`gallery-item-${idx}`}
                      style={styles.galleryGridItem}
                      onPress={() => setSelectedPhotoPreview(uri)}
                      accessibilityRole="button"
                      accessibilityLabel={`View full photo ${idx + 1}`}
                    >
                      <Image source={{ uri }} style={styles.galleryGridImg} />
                      <View style={styles.galleryBadge}>
                        <Text style={styles.galleryBadgeText}>
                          {isShopPhoto ? "Shop" : "Work"}
                        </Text>
                      </View>
                      <View style={styles.galleryZoomIconBox}>
                        <Ionicons name="expand" size={14} color="#FFFFFF" />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Gallery Footer */}
            <View style={styles.galleryFooter}>
              <Pressable
                style={styles.galleryEditPhotosBtn}
                onPress={() => {
                  setIsGalleryOpen(false);
                  onEditStep(4);
                }}
              >
                <Ionicons name="pencil" size={14} color={GREEN} />
                <Text style={styles.galleryEditPhotosBtnText}>Manage & Edit Photos</Text>
              </Pressable>
              <Pressable
                style={styles.galleryDoneBtn}
                onPress={() => setIsGalleryOpen(false)}
              >
                <Text style={styles.galleryDoneBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Photo Preview Modal */}
      <Modal
        visible={selectedPhotoPreview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoPreview(null)}
      >
        <View style={styles.photoPreviewOverlay}>
          <Pressable
            style={styles.photoPreviewCloseBtn}
            onPress={() => setSelectedPhotoPreview(null)}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          {selectedPhotoPreview && (
            <Image
              source={{ uri: selectedPhotoPreview }}
              style={styles.photoPreviewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Publishing Progress Overlay */}
      <Modal visible={isPublishing} transparent animationType="fade">
        <View style={styles.publishingModalOverlay}>
          <View style={styles.publishingModalBox}>
            <ActivityIndicator size="large" color={GREEN} style={{ marginBottom: 14 }} />
            <Text style={styles.publishingModalTitle}>Creating your service...</Text>
            <Text style={styles.publishingModalSub}>
              {isEditing ? "Saving your service changes" : "Please wait while we set up your public profile"}
            </Text>

            <Text style={styles.checkItemText}>Waiting for the server to save your service.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Helpers ──
function cleanUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function formatTaskName(id: string): string {
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatPhoneNumber(phone: string): string {
  if (!phone) return "Not provided";
  const cleaned = phone.replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("+91") && cleaned.length >= 13) {
    const num = cleaned.slice(3);
    return `+91 ${num.slice(0, 5)} ${num.slice(5)}`;
  }
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

function getCategoryIcon(catId: string, srvId: string): keyof typeof Ionicons.glyphMap {
  const query = `${catId} ${srvId}`.toLowerCase();
  if (query.includes("bike") || query.includes("motorcycle") || query.includes("two-wheeler")) {
    return "bicycle";
  }
  if (query.includes("car") || query.includes("auto") || query.includes("vehicle")) {
    return "car-sport";
  }
  if (query.includes("plumb") || query.includes("pipe") || query.includes("leak")) {
    return "water";
  }
  if (query.includes("electr") || query.includes("wire") || query.includes("light")) {
    return "flash";
  }
  if (query.includes("clean") || query.includes("wash") || query.includes("maid")) {
    return "sparkles";
  }
  if (query.includes("ac") || query.includes("cool") || query.includes("appliance")) {
    return "snow";
  }
  if (query.includes("hair") || query.includes("salon") || query.includes("barber")) {
    return "cut";
  }
  return "construct";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainLayout: {
    flexDirection: "column",
    gap: 20,
  },
  mainLayoutLarge: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  formColumn: {
    flex: 1,
    gap: 16,
  },
  formColumnLarge: {
    flex: 1.15,
  },
  sidebarColumn: {
    flex: 0.85,
    gap: 18,
  },

  // Hero Section
  heroSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
    position: "relative",
  },
  heroTextWrap: {
    flex: 1,
    paddingRight: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.9,
    color: "#15803D",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  partyPopperEmoji: {
    fontSize: 26,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: "#475569",
    lineHeight: 20,
    marginTop: 6,
  },
  stampBlobContainer: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopLeftRadius: 48,
    borderBottomLeftRadius: 44,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 124,
    position: "relative",
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  stampBlobHeart: {
    alignSelf: "flex-end",
    transform: [{ rotate: "14deg" }],
    marginBottom: -6,
    marginRight: 2,
  },
  stampBlobTextGroup: {
    alignItems: "flex-start",
    width: "100%",
    paddingLeft: 2,
  },
  stampBlobWord: {
    fontSize: 15,
    fontWeight: "800",
    color: "#15803D",
    fontStyle: "italic",
    lineHeight: 19,
    letterSpacing: -0.3,
  },
  stampBlobWord1: {
    transform: [{ rotate: "-6deg" }],
    marginLeft: 0,
  },
  stampBlobWord2: {
    transform: [{ rotate: "-3deg" }],
    marginLeft: 6,
  },
  stampBlobWord3: {
    transform: [{ rotate: "-1deg" }],
    marginLeft: 10,
  },
  stampBlobWord4: {
    fontWeight: "900",
    marginLeft: 12,
  },
  stampBlobUnderline: {
    width: 76,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "#15803D",
    alignSelf: "flex-end",
    marginTop: 2,
    marginRight: -2,
    transform: [{ rotate: "-4deg" }],
  },

  // Summary Card - Distinct White Card Design
  summaryCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: GREEN_BG,
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT_SECONDARY,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardBreadcrumbText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  breadcrumbSep: {
    color: GREEN,
    fontWeight: "900",
  },
  cardSubServiceText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 1,
  },
  cardHighlightText: {
    fontSize: 15.5,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    marginTop: 1,
  },
  cardSubText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 1,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: GREEN_BG,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 5,
  },
  editBtnText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: GREEN,
  },
  descBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#7C3AED",
  },
  descText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
  },

  // Task Chips with Individual Icons & Colors
  tasksSectionWrapper: {
    gap: 8,
    marginTop: 2,
  },
  tasksSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tasksSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_SECONDARY,
  },
  tasksCountPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tasksCountText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#475569",
  },
  taskChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  taskCardItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  taskCardIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  taskCardItemText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  taskMoreChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_SOFT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 5,
  },
  taskMoreChipText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: GREEN_DARK,
  },
  taskShowLessBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  taskShowLessText: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN,
  },
  cardHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewAllPhotosHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: GREEN_BG,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 4,
  },
  viewAllPhotosHeaderBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: GREEN,
  },

  // Location Body with Embedded Google Map
  locationBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    backgroundColor: "#F8FAF6",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  locationLeftInfo: {
    flex: 1,
    gap: 6,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    gap: 6,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: GREEN_DARK,
  },
  locationAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  locationAddressText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  radiusSubText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginLeft: 20,
  },
  embeddedMapBox: {
    width: 104,
    height: 84,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  miniMapPin: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  webMapFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  mapThumbOverlayPill: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  mapThumbOverlayText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Photos Grid (Contained, No Overflow)
  photosGridContainer: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 10,
    width: "100%",
    marginTop: 2,
  },
  photoThumbItem: {
    position: "relative",
    flex: 1,
    maxWidth: 72,
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  photoThumbImg: {
    width: "100%",
    height: "100%",
  },
  photoThumbMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoThumbMoreText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  photoThumbMoreSub: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: -2,
  },
  emptyPhotosBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  emptyPhotosText: {
    fontSize: 12.5,
    color: TEXT_SECONDARY,
  },

  // Contact Details
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  contactPhone: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  privacyPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 10,
    gap: 4,
  },
  privacyPillHidden: {
    backgroundColor: "#F1F5F9",
  },
  privacyPillVisible: {
    backgroundColor: GREEN_SOFT,
  },
  privacyPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  privacyPillTextVisible: {
    color: GREEN_DARK,
  },
  contactHelperCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  contactHelperText: {
    flex: 1,
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 16,
  },

  // Online Presence
  onlineLinksList: {
    gap: 8,
    marginTop: 2,
  },
  onlineLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  onlineLinkText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },

  // Trust Guideline Card
  trustGuidelineCard: {
    backgroundColor: GREEN_BG,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  trustGuidelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trustShieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  trustGuidelineTextGroup: {
    flex: 1,
  },
  trustGuidelineTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: GREEN_DARK,
  },
  trustGuidelineDesc: {
    fontSize: 12,
    color: "#166534",
    lineHeight: 17,
    marginTop: 2,
  },

  // Error Box
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "600",
  },

  // Action Buttons
  actionsGroup: {
    gap: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  publishBtn: {
    backgroundColor: GREEN,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  publishBtnDisabled: {
    opacity: 0.6,
  },
  publishBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  publishBtnText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  backEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 16,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  backEditBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  // Gallery Modal Styles
  galleryModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "flex-end",
  },
  galleryModalCard: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    minHeight: 460,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  galleryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  galleryHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  galleryIconPill: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: GREEN_BG,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  gallerySubTitle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 1,
  },
  galleryCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryTabsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  galleryTabItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  galleryTabItemActive: {
    backgroundColor: GREEN_BG,
    borderColor: GREEN_BORDER,
  },
  galleryTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_SECONDARY,
  },
  galleryTabTextActive: {
    color: GREEN_DARK,
    fontWeight: "800",
  },
  galleryScrollContent: {
    padding: 20,
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  galleryGridItem: {
    width: "30.5%",
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    position: "relative",
  },
  galleryGridImg: {
    width: "100%",
    height: "100%",
  },
  galleryBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  galleryBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  galleryZoomIconBox: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 12,
  },
  galleryEditPhotosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: GREEN_BG,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
  },
  galleryEditPhotosBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: GREEN,
  },
  galleryDoneBtn: {
    backgroundColor: GREEN,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryDoneBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Photo Preview Modal
  photoPreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPreviewCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  photoPreviewImage: {
    width: "90%",
    height: "75%",
    borderRadius: 16,
  },

  // Large Screen Sidebar
  brandHeroCard: {
    backgroundColor: WHITE,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  brandHeroTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: TEXT_PRIMARY,
    lineHeight: 30,
  },
  brandHeroSubtitle: {
    fontSize: 13.5,
    color: TEXT_SECONDARY,
    lineHeight: 19,
  },
  pillarsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  pillarItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F8FAF6",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pillarIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  pillarHeading: {
    fontSize: 12.5,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  pillarSub: {
    fontSize: 10.5,
    color: TEXT_SECONDARY,
    textAlign: "center",
    marginTop: 2,
  },

  // Spotlight Card
  providerSpotlightCard: {
    backgroundColor: GREEN_BG,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    gap: 16,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  quoteBubble: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  quoteText: {
    fontSize: 16,
    fontWeight: "800",
    color: GREEN_DARK,
    fontStyle: "italic",
    lineHeight: 24,
  },
  statCountersRow: {
    gap: 10,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statNumber: {
    fontSize: 15,
    fontWeight: "900",
    color: TEXT_PRIMARY,
  },
  statLabel: {
    fontSize: 11.5,
    color: TEXT_SECONDARY,
  },
  sloganWatermark: {
    alignItems: "center",
    paddingTop: 6,
  },
  sloganHandwriting: {
    fontSize: 15,
    fontWeight: "900",
    color: "#334155",
    fontStyle: "italic",
  },

  // Publishing Modal
  publishingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  publishingModalBox: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: WHITE,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  publishingModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: TEXT_PRIMARY,
    textAlign: "center",
  },
  publishingModalSub: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  checklistContainer: {
    width: "100%",
    gap: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_SECONDARY,
  },
  checkItemDone: {
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
});
