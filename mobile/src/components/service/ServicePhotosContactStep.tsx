import { uploadServicePhoto } from "../../api/servicePhotos";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../auth";
import { dash, radii } from "./palette";

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

export type ServiceMode = "doorstep" | "at_center" | "both";

export interface ServicePhotosContactStepProps {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  serviceId: string;
  serviceName?: string;
  serviceIcon?: string;
  serviceMode: ServiceMode;
  userPhone?: string;
  servicePhotos: string[];
  onServicePhotosChange: (photos: string[]) => void;
  shopPhotos: string[];
  onShopPhotosChange: (photos: string[]) => void;
  phoneVisible: boolean;
  onPhoneVisibleChange: (visible: boolean) => void;
  website: string;
  onWebsiteChange: (website: string) => void;
  instagram: string;
  onInstagramChange: (instagram: string) => void;
  facebook: string;
  onFacebookChange: (facebook: string) => void;
  onChangeService: () => void;
  onChangeCategory?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
}

export function ServicePhotosContactStep({
  categoryId,
  categoryName,
  categoryIcon,
  serviceId,
  serviceName,
  serviceIcon,
  serviceMode,
  userPhone,
  servicePhotos,
  onServicePhotosChange,
  shopPhotos,
  onShopPhotosChange,
  phoneVisible,
  onPhoneVisibleChange,
  website,
  onWebsiteChange,
  instagram,
  onInstagramChange,
  facebook,
  onFacebookChange,
  onChangeService,
  onChangeCategory,
  onNext,
  onSkip,
}: ServicePhotosContactStepProps) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const { user } = useAuth();

  // Target picker state ('service' | 'shop' | null)
  const [pickerTarget, setPickerTarget] = useState<"service" | "shop" | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Full-screen image preview modal state
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"service" | "shop" | null>(null);

  // Format phone number
  const rawPhone = userPhone || user?.phone || "";
  const displayPhone = formatPhoneNumber(rawPhone);

  const showShopSection = true;

  // Pick from camera
  const handleTakePhoto = async () => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (!target) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera permissions in settings to take photos."
        );
        return;
      }

      setIsProcessingPhoto(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const firstAsset = result.assets[0];
        if (firstAsset?.uri) {
          const uri = await uploadServicePhoto(firstAsset);
          if (target === "service") {
            if (servicePhotos.length < 6) {
              onServicePhotosChange([...servicePhotos, uri]);
            }
          } else {
            if (shopPhotos.length < 6) {
              onShopPhotosChange([...shopPhotos, uri]);
            }
          }
        }
      }
    } catch (err) {
      Alert.alert("Photo failed", err instanceof Error ? err.message : "Please retry the upload.");
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Pick from gallery
  const handleChooseFromGallery = async () => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (!target) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo Library Permission Required",
          "Please enable photo library access in settings to upload photos."
        );
        return;
      }

      setIsProcessingPhoto(true);
      const currentCount = target === "service" ? servicePhotos.length : shopPhotos.length;
      const remainingSlots = Math.max(1, 6 - currentCount);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUris: string[] = [];
        for (const asset of result.assets) newUris.push(await uploadServicePhoto(asset));
        if (target === "service") {
          const combined = [...servicePhotos, ...newUris].slice(0, 6);
          onServicePhotosChange(combined);
        } else {
          const combined = [...shopPhotos, ...newUris].slice(0, 6);
          onShopPhotosChange(combined);
        }
      }
    } catch (err) {
      Alert.alert("Photo failed", err instanceof Error ? err.message : "Please retry the upload.");
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Remove photo
  const handleRemovePhoto = (type: "service" | "shop", index: number) => {
    if (type === "service") {
      const updated = [...servicePhotos];
      updated.splice(index, 1);
      onServicePhotosChange(updated);
    } else {
      const updated = [...shopPhotos];
      updated.splice(index, 1);
      onShopPhotosChange(updated);
    }
    if (previewUri) {
      setPreviewUri(null);
      setPreviewType(null);
    }
  };

  const displayName =
    serviceName ||
    (serviceId
      ? serviceId
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ")
      : "Bike Repair & Service");

  const displayCategory = categoryName || "Automotive";

  return (
    <View style={styles.container}>
      <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutLarge]}>
        {/* Left Column (Primary Form) */}
        <View style={[styles.formColumn, isLargeScreen && styles.formColumnLarge]}>
          {/* Hero Header */}
          <View style={styles.heroSection}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.tagText}>BUILD YOUR PROFILE</Text>
              <Text style={styles.heroTitle}>
                Help customers{"\n"}know{" "}
                <Text style={styles.heroTitleHighlight}>you better</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                Add photos and contact details to make your service profile more useful and trustworthy.
              </Text>
            </View>

            {/* Sticker / Stamp Badge */}
            <View style={styles.stampBadge}>
              <View style={styles.stampLine}>
                <Text style={styles.stampWord}>Real Work</Text>
              </View>
              <View style={styles.stampLine}>
                <Text style={styles.stampWord}>Real People</Text>
              </View>
              <View style={styles.stampLine}>
                <Text style={styles.stampWord}>Real Trust</Text>
              </View>
            </View>
          </View>

          {/* Service Summary Card */}
          <View style={styles.serviceSummaryCard}>
            <View style={styles.serviceSummaryIconBox}>
              <Ionicons
                name={getCategoryOrServiceIcon(categoryId, serviceId)}
                size={24}
                color={GREEN}
              />
            </View>
            <View style={styles.serviceSummaryInfo}>
              <Text style={styles.serviceSummaryTitle} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.serviceSummaryBreadcrumb} numberOfLines={1}>
                {displayCategory} › {displayName}
              </Text>
            </View>
            <Pressable
              style={styles.changeBtn}
              onPress={onChangeService || onChangeCategory}
              accessibilityRole="button"
              accessibilityLabel="Change service"
            >
              <Text style={styles.changeBtnText}>Change</Text>
              <Ionicons name="chevron-forward" size={14} color={GREEN} />
            </Pressable>
          </View>

          {/* SECTION 1: Show your work (Service Photos) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Ionicons name="camera" size={20} color={TEXT_PRIMARY} />
                <Text style={styles.sectionTitle}>Show your work</Text>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalText}>Optional</Text>
                </View>
              </View>
              <Text style={styles.photoCountText}>
                {servicePhotos.length > 0 ? `${servicePhotos.length}/6 photos` : "Up to 6 photos"}
              </Text>
            </View>
            <Text style={styles.sectionHelper}>
              Add photos that show the quality of your service.
            </Text>

            {/* Photo Grid / Scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoGridScroll}
            >
              {servicePhotos.map((uri, index) => (
                <View key={`service-photo-${index}`} style={styles.photoThumbWrapper}>
                  <Pressable
                    onPress={() => {
                      setPreviewUri(uri);
                      setPreviewType("service");
                    }}
                    style={styles.photoThumbPress}
                  >
                    <Image source={{ uri }} style={styles.photoThumbImage} />
                  </Pressable>
                  <Pressable
                    style={styles.deletePhotoBadge}
                    onPress={() => handleRemovePhoto("service", index)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete photo"
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}

              {servicePhotos.length < 6 && (
                <Pressable
                  style={styles.addPhotoCard}
                  onPress={() => setPickerTarget("service")}
                  accessibilityRole="button"
                  accessibilityLabel="Add service photo"
                >
                  <View style={styles.addPhotoIconCircle}>
                    <Ionicons name="add" size={24} color={GREEN} />
                  </View>
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>

          {/* SECTION 2: Show your shop or workspace (Conditional) */}
          {showShopSection && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <Ionicons name="storefront" size={20} color={TEXT_PRIMARY} />
                  <Text style={styles.sectionTitle}>Show your shop or workspace</Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>Optional</Text>
                  </View>
                </View>
                <Text style={styles.photoCountText}>
                  {shopPhotos.length > 0 ? `${shopPhotos.length}/6 photos` : "Up to 6 photos"}
                </Text>
              </View>
              <Text style={styles.sectionHelper}>
                Help customers recognize the place they'll visit.
              </Text>

              {/* Photo Grid / Scroll */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoGridScroll}
              >
                {shopPhotos.map((uri, index) => (
                  <View key={`shop-photo-${index}`} style={styles.photoThumbWrapper}>
                    <Pressable
                      onPress={() => {
                        setPreviewUri(uri);
                        setPreviewType("shop");
                      }}
                      style={styles.photoThumbPress}
                    >
                      <Image source={{ uri }} style={styles.photoThumbImage} />
                    </Pressable>
                    <Pressable
                      style={styles.deletePhotoBadge}
                      onPress={() => handleRemovePhoto("shop", index)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete shop photo"
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}

                {shopPhotos.length < 6 && (
                  <Pressable
                    style={styles.addPhotoCard}
                    onPress={() => setPickerTarget("shop")}
                    accessibilityRole="button"
                    accessibilityLabel="Add workspace photo"
                  >
                    <View style={styles.addPhotoIconCircle}>
                      <Ionicons name="add" size={24} color={GREEN} />
                    </View>
                    <Text style={styles.addPhotoText}>Add Photo</Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
          )}

          {/* SECTION 3: Contact customers */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Ionicons name="call" size={20} color={TEXT_PRIMARY} />
                <Text style={styles.sectionTitle}>Contact customers</Text>
              </View>
            </View>
            <Text style={styles.sectionHelper}>
              Your phone number from your account.
            </Text>

            {/* Phone display badge */}
            <View style={styles.phoneDisplayCard}>
              <View style={styles.phoneIconCircle}>
                <Ionicons name="call-outline" size={18} color={GREEN} />
              </View>
              <Text style={styles.phoneNumberText}>{displayPhone}</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                <Text style={styles.verifiedBadgeText}>Account number</Text>
              </View>
            </View>

            {/* Phone Visibility Switch */}
            <View style={styles.switchWrapper}>
              <View style={styles.switchHeaderRow}>
                <Text style={styles.switchLabel}>Show my phone number to customers</Text>
                <Switch
                  value={phoneVisible}
                  onValueChange={onPhoneVisibleChange}
                  trackColor={{ false: "#CBD5E1", true: GREEN }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#CBD5E1"
                />
              </View>
              <Text style={styles.switchExplanation}>
                When enabled, customers can see your number and call you directly. When disabled, they can still send you a service request through Bulao.
              </Text>
            </View>
          </View>

          {/* SECTION 4: Online presence */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Ionicons name="link" size={20} color={TEXT_PRIMARY} />
                <Text style={styles.sectionTitle}>Online presence</Text>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalText}>Optional</Text>
                </View>
              </View>
            </View>
            <Text style={styles.sectionHelper}>
              Add links if customers can learn more about your service online.
            </Text>

            {/* Social & Web Inputs */}
            <View style={styles.socialInputsList}>
              {/* Website */}
              <View style={styles.socialInputRow}>
                <View style={styles.socialPrefixBox}>
                  <Ionicons name="globe-outline" size={18} color="#2563EB" />
                  <Text style={styles.socialPrefixLabel}>Website</Text>
                </View>
                <TextInput
                  style={styles.socialTextInput}
                  placeholder="https://yourwebsite.com"
                  placeholderTextColor="#94A3B8"
                  value={website}
                  onChangeText={onWebsiteChange}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Instagram */}
              <View style={styles.socialInputRow}>
                <View style={styles.socialPrefixBox}>
                  <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                  <Text style={styles.socialPrefixLabel}>Instagram</Text>
                </View>
                <TextInput
                  style={styles.socialTextInput}
                  placeholder="https://instagram.com/yourname"
                  placeholderTextColor="#94A3B8"
                  value={instagram}
                  onChangeText={onInstagramChange}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Facebook */}
              <View style={styles.socialInputRow}>
                <View style={styles.socialPrefixBox}>
                  <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                  <Text style={styles.socialPrefixLabel}>Facebook</Text>
                </View>
                <TextInput
                  style={styles.socialTextInput}
                  placeholder="https://facebook.com/yourname"
                  placeholderTextColor="#94A3B8"
                  value={facebook}
                  onChangeText={onFacebookChange}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>

          {/* SECTION 5: Trust Banner Card */}
          <View style={styles.trustBanner}>
            <View style={styles.trustBannerIconCircle}>
              <Ionicons name="bulb-outline" size={22} color={GREEN} />
            </View>
            <View style={styles.trustBannerContent}>
              <Text style={styles.trustBannerTitle}>Build trust with your profile</Text>
              <Text style={styles.trustBannerDesc}>
                Photos, accurate location and contact details help customers choose your service with confidence.
              </Text>
            </View>
          </View>
        </View>

        {/* Right Column (Tablet / Large Screen Preview & Tips) */}
        {isLargeScreen && (
          <View style={styles.sidebarColumn}>
            {/* Top Complete Profile Trust Card */}
            <View style={styles.trustSidebarCard}>
              <View style={styles.trustSidebarHeader}>
                <Ionicons name="shield-checkmark" size={28} color={GREEN} />
                <Text style={styles.trustSidebarTitle}>
                  A complete profile gets more trust
                </Text>
              </View>
              <Text style={styles.trustSidebarDesc}>
                Photos and contact details help customers feel confident and choose your service.
              </Text>
            </View>

            {/* Photo Tips Card */}
            <View style={styles.tipsCard}>
              <View style={styles.tipsHeaderRow}>
                <Ionicons name="camera" size={18} color={TEXT_PRIMARY} />
                <Text style={styles.tipsTitle}>Photo Tips</Text>
              </View>
              <View style={styles.tipsList}>
                {[
                  "Upload clear, real photos",
                  "Show your work, tools or results",
                  "Add your shop front (if you have one)",
                  "Avoid blurry or dark images",
                  "You can add or change photos anytime",
                ].map((tip, idx) => (
                  <View key={`tip-${idx}`} style={styles.tipItem}>
                    <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                    <Text style={styles.tipItemText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Supported Links Card */}
            <View style={styles.tipsCard}>
              <View style={styles.tipsHeaderRow}>
                <Ionicons name="link" size={18} color={TEXT_PRIMARY} />
                <Text style={styles.tipsTitle}>Supported Links</Text>
              </View>
              <View style={styles.tipsList}>
                {[
                  "Website (e.g. your business website)",
                  "Instagram (e.g. your profile)",
                  "Facebook (e.g. your page)",
                  "All links are optional",
                ].map((linkTip, idx) => (
                  <View key={`linkTip-${idx}`} style={styles.tipItem}>
                    <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                    <Text style={styles.tipItemText}>{linkTip}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Slogan */}
            <View style={styles.sloganWrap}>
              <Text style={styles.sloganText}>Show your work</Text>
              <Text style={styles.sloganText}>Build your name</Text>
              <Text style={[styles.sloganText, styles.sloganTextGreen]}>Grow with Bulao</Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Sheet Modal for Photo Upload Source */}
      <Modal
        visible={pickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerTarget(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPickerTarget(null)}
        >
          <View style={styles.actionSheetContent}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>
              {pickerTarget === "service" ? "Add Service Photo" : "Add Workspace Photo"}
            </Text>
            <Text style={styles.actionSheetSubtitle}>
              Choose how you want to add this photo
            </Text>

            <Pressable
              style={styles.actionOptionBtn}
              onPress={handleTakePhoto}
            >
              <View style={[styles.actionOptionIcon, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="camera" size={22} color={GREEN} />
              </View>
              <View style={styles.actionOptionTextGroup}>
                <Text style={styles.actionOptionTitle}>Take Photo</Text>
                <Text style={styles.actionOptionDesc}>Use your phone camera to capture now</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.actionOptionBtn}
              onPress={handleChooseFromGallery}
            >
              <View style={[styles.actionOptionIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="images" size={22} color="#2563EB" />
              </View>
              <View style={styles.actionOptionTextGroup}>
                <Text style={styles.actionOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.actionOptionDesc}>Select photos from your device library</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.actionCancelBtn}
              onPress={() => setPickerTarget(null)}
            >
              <Text style={styles.actionCancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={previewUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUri(null)}
      >
        <View style={styles.previewModalOverlay}>
          <Pressable
            style={styles.previewCloseBtn}
            onPress={() => setPreviewUri(null)}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>

          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={styles.previewModalImage}
              resizeMode="contain"
            />
          )}

          {previewType && previewUri && (
            <View style={styles.previewModalBottomBar}>
              <Pressable
                style={styles.previewDeleteBtn}
                onPress={() => {
                  if (previewType === "service") {
                    const idx = servicePhotos.indexOf(previewUri);
                    if (idx !== -1) handleRemovePhoto("service", idx);
                  } else {
                    const idx = shopPhotos.indexOf(previewUri);
                    if (idx !== -1) handleRemovePhoto("shop", idx);
                  }
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                <Text style={styles.previewDeleteBtnText}>Delete Photo</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* Processing indicator */}
      {isProcessingPhoto && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={styles.processingText}>Processing photo...</Text>
        </View>
      )}
    </View>
  );
}

// ── Helper Functions ──
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

function getCategoryOrServiceIcon(
  catId: string,
  srvId: string
): keyof typeof Ionicons.glyphMap {
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
    gap: 18,
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
    marginBottom: 4,
  },
  heroTextWrap: {
    flex: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: GREEN,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  heroTitleHighlight: {
    color: GREEN,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: TEXT_SECONDARY,
    lineHeight: 19,
    marginTop: 6,
  },
  stampBadge: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    transform: [{ rotate: "3deg" }],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  stampLine: {
    marginVertical: 1,
  },
  stampWord: {
    fontSize: 11.5,
    fontWeight: "800",
    color: GREEN_DARK,
    letterSpacing: 0.2,
    textAlign: "center",
  },

  // Service Summary Card
  serviceSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  serviceSummaryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: GREEN_BG,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceSummaryInfo: {
    flex: 1,
  },
  serviceSummaryTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  serviceSummaryBreadcrumb: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: GREEN_BG,
    gap: 2,
  },
  changeBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: GREEN,
  },

  // Section Cards
  sectionCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  optionalBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  optionalText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  photoCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_SECONDARY,
  },
  sectionHelper: {
    fontSize: 12.5,
    color: TEXT_SECONDARY,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },

  // Photo Grid
  photoGridScroll: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 4,
  },
  photoThumbWrapper: {
    position: "relative",
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  photoThumbPress: {
    width: "100%",
    height: "100%",
  },
  photoThumbImage: {
    width: "100%",
    height: "100%",
    borderRadius: 13,
  },
  deletePhotoBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoCard: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: GREEN_BG,
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: GREEN_DARK,
  },

  // Phone Contact Section
  phoneDisplayCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
    marginBottom: 16,
  },
  phoneIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GREEN_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneNumberText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_SOFT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: GREEN_DARK,
  },
  switchWrapper: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  switchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  switchExplanation: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 17,
  },

  // Social & Online Presence
  socialInputsList: {
    gap: 10,
  },
  socialInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    height: 48,
  },
  socialPrefixBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 105,
    paddingHorizontal: 12,
    height: "100%",
    backgroundColor: "#F1F5F9",
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  socialPrefixLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  socialTextInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
    fontSize: 13,
    color: TEXT_PRIMARY,
  },

  // Trust Banner Card
  trustBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: GREEN_BG,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    gap: 12,
  },
  trustBannerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  trustBannerContent: {
    flex: 1,
  },
  trustBannerTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: GREEN_DARK,
    marginBottom: 2,
  },
  trustBannerDesc: {
    fontSize: 12,
    color: "#166534",
    lineHeight: 17,
  },

  // Sidebar (Large Screen)
  trustSidebarCard: {
    backgroundColor: GREEN_BG,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    gap: 8,
  },
  trustSidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trustSidebarTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: GREEN_DARK,
    lineHeight: 20,
  },
  trustSidebarDesc: {
    fontSize: 12.5,
    color: "#166534",
    lineHeight: 18,
  },

  // Tips Card
  tipsCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  tipsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipsTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipItemText: {
    flex: 1,
    fontSize: 12.5,
    color: TEXT_SECONDARY,
    lineHeight: 17,
  },

  // Slogan
  sloganWrap: {
    paddingVertical: 12,
    alignItems: "center",
  },
  sloganText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#334155",
    fontStyle: "italic",
    lineHeight: 22,
  },
  sloganTextGreen: {
    color: GREEN,
  },

  // Modal / ActionSheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  actionSheetContent: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    gap: 12,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 4,
  },
  actionSheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    textAlign: "center",
  },
  actionSheetSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: "center",
    marginBottom: 6,
  },
  actionOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 14,
  },
  actionOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionOptionTextGroup: {
    flex: 1,
  },
  actionOptionTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  actionOptionDesc: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  actionCancelBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  actionCancelBtnText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#64748B",
  },

  // Preview Modal
  previewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  previewModalImage: {
    width: "90%",
    height: "70%",
    borderRadius: 16,
  },
  previewModalBottomBar: {
    position: "absolute",
    bottom: 40,
    flexDirection: "row",
    gap: 16,
  },
  previewDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DC2626",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 8,
  },
  previewDeleteBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Processing Overlay
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 100,
  },
  processingText: {
    fontSize: 14,
    fontWeight: "700",
    color: GREEN_DARK,
  },
});
