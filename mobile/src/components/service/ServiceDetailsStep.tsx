import { useState, useMemo, useRef, useEffect } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { ServiceOption, ServiceOptionsResponse } from "../../api/types";

// Design Tokens
const GREEN = "#15803D";
const GREEN_SOFT = "#DCFCE7";
const GREEN_BG = "#F0FDF4";
const TEXT_PRIMARY = "#0F172A";
const TEXT_SECONDARY = "#64748B";
const BORDER = "#E5E7EB";
const WHITE = "#FFFFFF";

// Icon color palette for task cards
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
  default:               { color: "#475569", bg: "#F8FAFC" },
};

function getTaskIconStyle(optionId: string): { color: string; bg: string } {
  return TASK_ICON_PALETTES[optionId] ?? TASK_ICON_PALETTES.default ?? { color: "#475569", bg: "#F8FAFC" };
}

// Map option icons to Ionicons with safe fallbacks
function mapOptionIcon(icon?: string, id?: string): keyof typeof Ionicons.glyphMap {
  if (icon && icon in Ionicons.glyphMap) {
    return icon as keyof typeof Ionicons.glyphMap;
  }
  if (id) {
    if (id.includes("general") || id.includes("periodic")) return "settings-outline";
    if (id.includes("brake") || id.includes("disc")) return "disc-outline";
    if (id.includes("oil") || id.includes("filter")) return "color-fill-outline";
    if (id.includes("battery")) return "battery-charging-outline";
    if (id.includes("tyre") || id.includes("wheel")) return "ellipse-outline";
    if (id.includes("chain") || id.includes("link")) return "link-outline";
    if (id.includes("engine") || id.includes("motor")) return "hardware-chip-outline";
    if (id.includes("clutch") || id.includes("gear")) return "aperture-outline";
    if (id.includes("paint") || id.includes("dent")) return "color-palette-outline";
    if (id.includes("diagnostic") || id.includes("scan")) return "pulse-outline";
    if (id.includes("wash") || id.includes("clean")) return "sparkles-outline";
    if (id.includes("pipe") || id.includes("leak") || id.includes("tap")) return "water-outline";
    if (id.includes("wire") || id.includes("light") || id.includes("power")) return "flash-outline";
    if (id.includes("hair") || id.includes("cut")) return "cut-outline";
    if (id.includes("ac") || id.includes("cool")) return "snow-outline";
  }
  return "construct-outline";
}

// Props
export interface ServiceDetailsStepProps {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  serviceId: string;
  serviceName?: string;
  serviceIcon?: string;
  title: string;
  onTitleChange: (text: string) => void;
  businessName: string;
  onBusinessNameChange: (text: string) => void;
  description: string;
  onDescriptionChange: (text: string) => void;
  selectedOfferedServices: string[];
  onToggleOfferedService: (optionId: string) => void;
  customServices: string[];
  onAddCustomService: (customName: string) => void;
  onRemoveCustomService: (customName: string) => void;
  onChangeService: () => void;
  onChangeCategory?: () => void;
}

// Skeleton loading card
function SkeletonOptionCard({ width }: { width: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { width, opacity }]}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonText} />
    </Animated.View>
  );
}

// Interactive Task Card
function TaskCard({
  option,
  width,
  isSelected,
  onPress,
}: {
  option: ServiceOption;
  width: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const iconStyle = getTaskIconStyle(option.id);
  const iconName = mapOptionIcon(option.icon, option.id);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  };

  return (
    <Animated.View style={[{ width }, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={`${option.name}, ${isSelected ? "selected" : "not selected"}`}
        style={[styles.taskCard, isSelected && styles.taskCardSelected]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Selected green check badge */}
        {isSelected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={12} color={WHITE} />
          </View>
        )}

        {/* Option Icon */}
        <View style={[styles.taskIconSquircle, { backgroundColor: isSelected ? GREEN_SOFT : iconStyle.bg }]}>
          <Ionicons
            name={iconName}
            size={24}
            color={isSelected ? GREEN : iconStyle.color}
          />
        </View>

        {/* Option Name */}
        <Text
          numberOfLines={2}
          style={[styles.taskCardName, isSelected && styles.taskCardNameSelected]}
        >
          {option.name}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// Main Component
export function ServiceDetailsStep({
  categoryId,
  categoryName,
  categoryIcon,
  serviceId,
  serviceName,
  serviceIcon,
  title,
  onTitleChange,
  businessName,
  onBusinessNameChange,
  description,
  onDescriptionChange,
  selectedOfferedServices,
  onToggleOfferedService,
  customServices,
  onAddCustomService,
  onRemoveCustomService,
  onChangeService,
}: ServiceDetailsStepProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [isOtherOpen, setIsOtherOpen] = useState<boolean>(customServices.length > 0);
  const [customInputText, setCustomInputText] = useState<string>("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Responsive Grid Columns: 4 columns on normal/tablet (>=360px), 3 columns on small (<360px)
  const isTablet = windowWidth >= 768;
  const isSmall = windowWidth < 360;
  const numColumns = isTablet ? 4 : isSmall ? 3 : 4;
  const gap = 10;
  const containerPadding = 40; // 20px on each side
  const availableWidth = Math.min(windowWidth, 880) - containerPadding;
  const cardWidth = Math.floor((availableWidth - gap * (numColumns - 1)) / numColumns);

  // Fetch Options from Backend
  const optionsQuery = useQuery({
    queryKey: ["service-options", serviceId],
    queryFn: async () => {
      if (!serviceId) return { serviceId: "", defaultTitle: "", options: [] };
      return api<ServiceOptionsResponse>(`/services/${serviceId}/options`);
    },
    enabled: Boolean(serviceId),
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

  // Auto-fill smart default title if title is currently empty
  useEffect(() => {
    if (!title && optionsQuery.data?.defaultTitle) {
      onTitleChange(optionsQuery.data.defaultTitle);
    }
  }, [optionsQuery.data?.defaultTitle, title, onTitleChange]);

  const displayServiceName = useMemo(() => {
    if (serviceName) return serviceName;
    return serviceId
      ? serviceId.split(/[_-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : "Selected Service";
  }, [serviceName, serviceId]);

  const displayCategoryName = categoryName || "Service Category";

  const handleAddCustom = () => {
    const trimmed = customInputText.trim();
    if (trimmed && !customServices.includes(trimmed)) {
      onAddCustomService(trimmed);
      setCustomInputText("");
    }
  };

  const isOtherActive = isOtherOpen || customServices.length > 0;

  return (
    <View style={styles.container}>
      {/* ── 1. Hero Title & Decorative Badge ── */}
      <View style={styles.heroWrap}>
        <View style={styles.heroTextCol}>
          <Text style={styles.sectionLabel}>SERVICE DETAILS</Text>
          <Text style={styles.mainTitle}>
            Tell customers about your{" "}
            <Text style={styles.mainTitleHighlight}>service</Text>
          </Text>
          <Text style={styles.subtitle}>
            Add a few details so customers know exactly what you provide.
          </Text>
        </View>

        {/* Small Friendly Sticker Badge */}
        <View style={styles.stickerBadge}>
          <Text style={styles.stickerText}>Small{"\n"}Services{"\n"}Make a{"\n"}Big Difference</Text>
        </View>
      </View>

      {/* ── 2. Selected Service Summary Card ── */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryIconSquircle}>
          <Ionicons
            name={(serviceIcon as keyof typeof Ionicons.glyphMap) || (categoryIcon as keyof typeof Ionicons.glyphMap) || "bicycle"}
            size={24}
            color={GREEN}
          />
        </View>
        <View style={styles.summaryInfoCol}>
          <Text style={styles.summaryTitle}>{displayServiceName}</Text>
          <Text style={styles.summaryBreadcrumb}>
            {displayCategoryName} &gt; {displayServiceName}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change service"
          onPress={onChangeService}
          style={styles.changeBtn}
        >
          <Text style={styles.changeBtnText}>Change</Text>
          <Ionicons name="chevron-forward" size={14} color={GREEN} />
        </Pressable>
      </View>

      {/* ── 3. Service Title (Required) ── */}
      <View style={styles.fieldSection}>
        <View style={styles.fieldHeaderRow}>
          <Ionicons name="pricetag-outline" size={18} color={TEXT_PRIMARY} />
          <Text style={styles.fieldLabel}>
            Service title <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
        </View>

        <View style={[
          styles.inputContainer,
          focusedField === "title" && styles.inputContainerFocused,
          !title.trim() && focusedField !== "title" && styles.inputContainerRequiredEmpty,
        ]}>
          <Ionicons name="pricetag" size={18} color={focusedField === "title" ? GREEN : TEXT_SECONDARY} style={styles.inputLeftIcon} />
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={(t) => {
              if (t.length <= 60) onTitleChange(t);
            }}
            onFocus={() => setFocusedField("title")}
            onBlur={() => setFocusedField(null)}
            placeholder="e.g. Bike Repair & Service"
            placeholderTextColor="#94A3B8"
            maxLength={60}
          />
        </View>

        <View style={styles.fieldFooterRow}>
          <Text style={styles.fieldHelperText}>This will be visible to customers.</Text>
          <Text style={styles.counterText}>{title.length}/60</Text>
        </View>
      </View>

      {/* ── 4. Business / Shop Name (Optional) ── */}
      <View style={styles.fieldSection}>
        <View style={styles.fieldHeaderRow}>
          <Ionicons name="storefront-outline" size={18} color={TEXT_PRIMARY} />
          <Text style={styles.fieldLabel}>
            Business or shop name <Text style={styles.optionalTag}>(Optional)</Text>
          </Text>
        </View>

        <View style={[
          styles.inputContainer,
          focusedField === "business" && styles.inputContainerFocused,
        ]}>
          <Ionicons name="storefront" size={18} color={focusedField === "business" ? GREEN : TEXT_SECONDARY} style={styles.inputLeftIcon} />
          <TextInput
            style={styles.textInput}
            value={businessName}
            onChangeText={(t) => {
              if (t.length <= 80) onBusinessNameChange(t);
            }}
            onFocus={() => setFocusedField("business")}
            onBlur={() => setFocusedField(null)}
            placeholder="e.g. Ravi Bike Care"
            placeholderTextColor="#94A3B8"
            maxLength={80}
          />
        </View>

        <View style={styles.fieldFooterRow}>
          <Text style={styles.fieldHelperText}>Leave blank if you provide services individually.</Text>
        </View>
      </View>

      {/* ── 5. About This Service (Optional) ── */}
      <View style={styles.fieldSection}>
        <View style={styles.fieldHeaderRow}>
          <Ionicons name="document-text-outline" size={18} color={TEXT_PRIMARY} />
          <Text style={styles.fieldLabel}>
            About this service <Text style={styles.optionalTag}>(Optional)</Text>
          </Text>
        </View>

        <View style={[
          styles.textareaContainer,
          focusedField === "description" && styles.inputContainerFocused,
        ]}>
          <Ionicons name="document-text" size={18} color={focusedField === "description" ? GREEN : TEXT_SECONDARY} style={styles.textareaLeftIcon} />
          <TextInput
            style={styles.textareaInput}
            value={description}
            onChangeText={(t) => {
              if (t.length <= 500) onDescriptionChange(t);
            }}
            onFocus={() => setFocusedField("description")}
            onBlur={() => setFocusedField(null)}
            placeholder="I provide bike servicing, repair and maintenance for all types of bikes. Quick, reliable and affordable service."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.fieldFooterRow}>
          <Text style={styles.fieldHelperText}>Example: What you repair, maintain or help customers with.</Text>
          <Text style={styles.counterText}>{description.length}/500</Text>
        </View>
      </View>

      {/* ── 6. What Can You Help With? (Multi-Select) ── */}
      <View style={styles.fieldSection}>
        <View style={styles.fieldHeaderRow}>
          <Ionicons name="construct" size={18} color={GREEN} />
          <Text style={styles.fieldLabel}>
            What can you help with? <Text style={styles.requiredAsterisk}>*</Text>
          </Text>
        </View>
        <Text style={styles.tasksSubtext}>Select all that you provide.</Text>

        {/* Options Grid / Skeletons */}
        <View style={[styles.optionsGrid, { gap }]}>
          {optionsQuery.isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <SkeletonOptionCard key={i} width={cardWidth} />
            ))
          ) : optionsQuery.isError ? (
            <View style={styles.errorBox}>
              <Ionicons name="cloud-offline-outline" size={24} color="#EF4444" />
              <Text style={styles.errorText}>Could not load service options.</Text>
              <Pressable
                style={styles.retryBtn}
                onPress={() => { void optionsQuery.refetch(); }}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {optionsQuery.data?.options.map((option) => (
                <TaskCard
                  key={option.id}
                  option={option}
                  width={cardWidth}
                  isSelected={selectedOfferedServices.includes(option.id)}
                  onPress={() => onToggleOfferedService(option.id)}
                />
              ))}

              {/* + Other Service Card */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add custom other service"
                style={[
                  styles.otherCard,
                  { width: cardWidth },
                  isOtherActive && styles.otherCardActive,
                ]}
                onPress={() => setIsOtherOpen(!isOtherOpen)}
              >
                {isOtherActive && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={12} color={WHITE} />
                  </View>
                )}
                <View style={styles.otherIconSquircle}>
                  <Ionicons name="add" size={22} color={isOtherActive ? GREEN : TEXT_SECONDARY} />
                </View>
                <Text style={[styles.otherCardText, isOtherActive && styles.otherCardTextActive]}>
                  Other Service
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Inline Other Service Custom Input (when opened) */}
        {isOtherOpen && (
          <View style={styles.otherInputWrapper}>
            <Text style={styles.otherInputLabel}>Custom Service / Task Name</Text>
            <View style={styles.otherInputRow}>
              <TextInput
                style={styles.otherTextInput}
                placeholder="e.g. ABS repair, custom fabrication"
                placeholderTextColor="#94A3B8"
                value={customInputText}
                onChangeText={setCustomInputText}
                maxLength={60}
                onSubmitEditing={handleAddCustom}
                returnKeyType="done"
              />
              <Pressable
                style={[styles.addCustomBtn, !customInputText.trim() && styles.addCustomBtnDisabled]}
                disabled={!customInputText.trim()}
                onPress={handleAddCustom}
              >
                <Ionicons name="add" size={18} color={WHITE} />
                <Text style={styles.addCustomBtnText}>Add</Text>
              </Pressable>
            </View>

            {/* Custom Added Chips */}
            {customServices.length > 0 && (
              <View style={styles.customChipsRow}>
                {customServices.map((custom) => (
                  <View key={custom} style={styles.customChip}>
                    <Ionicons name="checkmark-circle" size={15} color={GREEN} />
                    <Text style={styles.customChipText}>{custom}</Text>
                    <Pressable
                      onPress={() => onRemoveCustomService(custom)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={16} color="#94A3B8" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── 7. Info Helper Banner ── */}
      <View style={styles.infoBox}>
        <View style={styles.infoIconCol}>
          <Ionicons name="information-circle" size={22} color={GREEN} />
        </View>
        <View style={styles.infoTextCol}>
          <Text style={styles.infoTitle}>These details will appear on your service profile.</Text>
          <Text style={styles.infoSubtitle}>You can update or add more information later.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingBottom: 24,
  },
  heroWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  heroTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: GREEN,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  mainTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
    lineHeight: 29,
  },
  mainTitleHighlight: {
    color: GREEN,
  },
  subtitle: {
    fontSize: 13.5,
    color: TEXT_SECONDARY,
    marginTop: 4,
    lineHeight: 18,
  },
  stickerBadge: {
    backgroundColor: "#EAF8ED",
    borderWidth: 1.5,
    borderColor: "#B7EBC8",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    transform: [{ rotate: "3deg" }],
    alignSelf: "flex-start",
  },
  stickerText: {
    fontSize: 11,
    fontWeight: "800",
    color: GREEN,
    textAlign: "center",
    lineHeight: 14,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 14,
    gap: 12,
  },
  summaryIconSquircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryInfoCol: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 15.5,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  summaryBreadcrumb: {
    fontSize: 12.5,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
  },
  changeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
  },
  fieldSection: {
    gap: 8,
  },
  fieldHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  requiredAsterisk: {
    color: "#EF4444",
    fontWeight: "800",
  },
  optionalTag: {
    fontSize: 12,
    fontWeight: "500",
    color: TEXT_SECONDARY,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputContainerFocused: {
    borderColor: GREEN,
    backgroundColor: "#FAFCF8",
  },
  inputContainerRequiredEmpty: {
    borderColor: "#CBD5E1",
  },
  inputLeftIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: TEXT_PRIMARY,
    fontWeight: "600",
    paddingVertical: 12,
  },
  fieldFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  fieldHelperText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    flex: 1,
  },
  counterText: {
    fontSize: 11.5,
    color: "#94A3B8",
    fontWeight: "600",
  },
  textareaContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 110,
  },
  textareaLeftIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  textareaInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
    lineHeight: 20,
    minHeight: 90,
  },
  tasksSubtext: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: -4,
    marginBottom: 4,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  taskCard: {
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 104,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  taskCardSelected: {
    borderColor: GREEN,
    backgroundColor: GREEN_BG,
  },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  taskIconSquircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  taskCardName: {
    fontSize: 11.5,
    fontWeight: "600",
    color: TEXT_PRIMARY,
    textAlign: "center",
    lineHeight: 14.5,
  },
  taskCardNameSelected: {
    fontWeight: "700",
    color: GREEN,
  },
  otherCard: {
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 94,
    gap: 7,
  },
  otherCardActive: {
    borderColor: GREEN,
    borderStyle: "solid",
    backgroundColor: GREEN_BG,
  },
  otherIconSquircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  otherCardText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 14.5,
  },
  otherCardTextActive: {
    color: GREEN,
    fontWeight: "700",
  },
  otherInputWrapper: {
    backgroundColor: "#F8FAF6",
    borderWidth: 1.5,
    borderColor: "#D1E7DD",
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    gap: 8,
  },
  otherInputLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  otherInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  otherTextInput: {
    flex: 1,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: TEXT_PRIMARY,
  },
  addCustomBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: "center",
  },
  addCustomBtnDisabled: {
    backgroundColor: "#94A3B8",
  },
  addCustomBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: WHITE,
  },
  customChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  customChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: "#86EFAC",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  customChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#DCFCE7",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  infoIconCol: {
    width: 28,
    alignItems: "center",
  },
  infoTextCol: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
  },
  infoSubtitle: {
    fontSize: 12,
    color: "#166534",
    marginTop: 1,
  },
  skeletonCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 94,
    gap: 8,
  },
  skeletonIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  skeletonText: {
    width: "70%",
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E2E8F0",
  },
  errorBox: {
    width: "100%",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#EF4444",
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: WHITE,
  },
});
