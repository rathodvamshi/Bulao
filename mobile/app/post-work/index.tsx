import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/components/ui";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  ExitModal,
  CustomNameModal,
} from "../../src/components/PostWorkUI";
import { usePostWorkStore } from "../../src/features/post-work/store";
import { api } from "../../src/api/client";
import { verifyCustomName } from "../../src/utils/nameVerification";

type Category = {
  id: string;
  kind: string;
  name: string;
  icon: string;
};

type Role = {
  id: string;
  categoryId: string;
  name: string;
  icon?: string;
};

type CatalogResponse = {
  categories: Category[];
  roles: Role[];
  locations: any[];
  version: number;
};

const categoryIcons: Record<string, string> = {
  construction: "🏗️",
  household: "🏠",
  food: "🍽️",
  transport: "🚚",
  shops: "🏪",
  events: "🎉",
  security: "🛡️",
  education: "🎓",
  healthcare: "🩺",
  beauty: "💇‍♀️",
  promotion: "📢",
  office: "💼",
  other: "✨",
};

// Rich mapping for role icons to ensure EVERY role has a clean, relevant icon
const roleIconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  // Construction & Trades
  mason: "build-outline",
  painter: "color-palette-outline",
  plumber: "water-outline",
  electrician: "flash-outline",
  carpenter: "hammer-outline",
  welder: "flame-outline",
  helper: "construct-outline",
  laborer: "body-outline",
  tile_worker: "grid-outline",
  centering_worker: "subway-outline",

  // Household & Cleaning
  maid: "home-outline",
  housekeeper: "sparkles-outline",
  cook: "restaurant-outline",
  chef: "restaurant-outline",
  babysitter: "heart-outline",
  nanny: "heart-outline",
  elderly_care: "medical-outline",
  gardener: "leaf-outline",
  car_washer: "car-sport-outline",

  // Food & Hospitality
  waiter: "cafe-outline",
  kitchen_helper: "fast-food-outline",
  dishwasher: "water-outline",
  delivery_boy: "bicycle-outline",
  counter_staff: "storefront-outline",

  // Transport & Logistics
  driver: "car-outline",
  auto_driver: "car-outline",
  loader: "cube-outline",
  bike_rider: "bicycle-outline",

  // Shops & Sales
  shop_assistant: "bag-handle-outline",
  cashier: "cash-outline",
  salesperson: "pricetag-outline",
  storekeeper: "archive-outline",

  // Security
  guard: "shield-checkmark-outline",
  bouncer: "shield-outline",
  security_supervisor: "ribbon-outline",

  // Education & Office
  tutor: "school-outline",
  teacher: "book-outline",
  office_boy: "briefcase-outline",
  receptionist: "call-outline",
  data_entry: "desktop-outline",

  // Events
  promoter: "megaphone-outline",
  event_helper: "balloon-outline",
  photographer: "camera-outline",
  dj: "musical-notes-outline",

  // Custom / Other
  other: "sparkles-outline",
  "other-role": "sparkles-outline",
};

// Helper function to derive a clean icon for any role
function getRoleIcon(roleId: string, roleName: string): keyof typeof Ionicons.glyphMap {
  if (roleIconMap[roleId]) return roleIconMap[roleId];
  const name = roleName.toLowerCase();
  if (name.includes("mason") || name.includes("build")) return "build-outline";
  if (name.includes("paint")) return "color-palette-outline";
  if (name.includes("plumb") || name.includes("water")) return "water-outline";
  if (name.includes("electr") || name.includes("wire") || name.includes("spark")) return "flash-outline";
  if (name.includes("carpent") || name.includes("wood")) return "hammer-outline";
  if (name.includes("cook") || name.includes("chef") || name.includes("food")) return "restaurant-outline";
  if (name.includes("clean") || name.includes("maid") || name.includes("house")) return "home-outline";
  if (name.includes("driv") || name.includes("cab") || name.includes("ride")) return "car-outline";
  if (name.includes("guard") || name.includes("secur")) return "shield-checkmark-outline";
  if (name.includes("teach") || name.includes("tutor") || name.includes("learn")) return "school-outline";
  if (name.includes("pack") || name.includes("load")) return "cube-outline";
  if (name.includes("tech") || name.includes("repair")) return "hardware-chip-outline";
  return "briefcase-outline";
}

export default function PostWorkCategoryScreen() {
  const {
    resetFlow,
    setCategory,
    setRole,
    category,
    role,
    categoryName,
    roleName,
  } = usePostWorkStore();

  const [stage, setStage] = useState<1 | 2>(1);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showExitModal, setShowExitModal] = useState(false);

  // Pop-up modals for custom category / role
  const [showCustomCatModal, setShowCustomCatModal] = useState(false);
  const [showCustomRoleModal, setShowCustomRoleModal] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [customRoleName, setCustomRoleName] = useState("");

  const { width } = useWindowDimensions();

  // Responsive Grid Calculations:
  const contentWidth = Math.min(width - 40, 640);
  const columns = width >= 768 ? 4 : width >= 480 ? 3 : 2;
  const gap = 12;
  const itemWidth = Math.floor((contentWidth - gap * (columns - 1)) / columns);

  const { data: catalog, isLoading, isError, error } = useQuery<CatalogResponse>({
    queryKey: ["categories"],
    queryFn: () => api<CatalogResponse>("/categories"),
    staleTime: 86400000,
  });

  useEffect(() => {
    resetFlow();
  }, []);

  useEffect(() => {
    if (catalog && category) {
      const categoryRoles = catalog.roles.filter((r) => r.categoryId === category);
      setRoles(categoryRoles);
    }
  }, [category, catalog]);

  const handleCategorySelect = (catId: string, catName: string) => {
    if (catId === "other") {
      setCategory("other", customCategoryName.trim() || "Other");
      setShowCustomCatModal(true);
    } else {
      setCustomCategoryName("");
      setCategory(catId, catName);
    }

    if (catalog) {
      const categoryRoles = catalog.roles.filter((r) => r.categoryId === catId);
      setRoles(categoryRoles);
    }
  };

  const handleSaveCustomCategory = (sanitizedName: string) => {
    setCustomCategoryName(sanitizedName);
    setCategory("other", sanitizedName);
    setShowCustomCatModal(false);
  };

  const handleRoleSelect = (roleId: string, rName: string) => {
    if (roleId === "other-role") {
      setRole("other-role", customRoleName.trim() || "Other");
      setShowCustomRoleModal(true);
    } else {
      setCustomRoleName("");
      setRole(roleId, rName);
    }
  };

  const handleSaveCustomRole = (sanitizedName: string) => {
    setCustomRoleName(sanitizedName);
    setRole("other-role", sanitizedName);
    setShowCustomRoleModal(false);
  };

  const isOtherCategorySelected = category === "other" || category === "other-work";
  const catVerification = verifyCustomName(customCategoryName);
  const isStage1Valid = Boolean(
    category && (!isOtherCategorySelected || catVerification.isValid)
  );

  const isOtherRoleSelected = role === "other-role" || role === "other-work-role";
  const roleVerification = verifyCustomName(customRoleName);
  const isStage2Valid = Boolean(
    role && (!isOtherRoleSelected || roleVerification.isValid)
  );

  const handleNext = () => {
    if (stage === 1) {
      if (isOtherCategorySelected && !catVerification.isValid) {
        setShowCustomCatModal(true);
        return;
      }
      if (isStage1Valid) {
        setStage(2);
      }
    } else if (stage === 2) {
      if (isOtherRoleSelected && !roleVerification.isValid) {
        setShowCustomRoleModal(true);
        return;
      }
      if (isStage2Valid) {
        router.push("/post-work/details");
      }
    }
  };

  const handleBack = () => {
    if (stage === 2) {
      setStage(1);
    }
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    resetFlow();
    router.replace("/provider-home");
  };

  const handleStepPress = (stepNum: number) => {
    if (stepNum === 1) {
      setStage(1);
    } else if (stepNum === 2 && isStage1Valid) {
      setStage(2);
    }
  };

  // Base categories from API + ensure "Other" is present
  const fetchedCategories = catalog?.categories.filter((c) => c.kind === "job") || [];
  const hasOtherCat = fetchedCategories.some((c) => c.id === "other" || c.id === "other-work");
  const allCategories: Category[] = hasOtherCat
    ? fetchedCategories
    : [...fetchedCategories, { id: "other", kind: "job", name: "Other", icon: "✨" }];

  // Base roles from selected category + ensure "Other" role is present
  const hasOtherRole = roles.some((r) => r.id === "other-role" || r.id === "other-work-role");
  const allRoles: Role[] = hasOtherRole
    ? roles
    : [...roles, { id: "other-role", categoryId: category, name: "Other" }];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header with ← Exit button */}
      <PostWorkHeader
        title="Post Job"
        currentStep={stage}
        totalSteps={7}
        onExit={() => setShowExitModal(true)}
      />

      {/* Connected Stage Progress Indicator with smooth line & tick pop */}
      <StageProgressIndicator
        currentStep={stage}
        onStepPress={handleStepPress}
      />

      {/* Main Content Area */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.green} />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : "Could not load categories"}
            </Text>
          </View>
        ) : stage === 1 ? (
          /* STAGE 1 — CATEGORIES */
          <View style={styles.stageSection}>
            <View style={styles.questionHeader}>
              <Text style={styles.stageTag}>STAGE 1 OF 7</Text>
              <Text style={styles.question}>Select a Category</Text>
              <Text style={styles.subtitle}>
                Pick the main type of work you need done so we can show you the right worker roles.
              </Text>
            </View>

            {/* Responsive Flexible Category Grid */}
            <View style={styles.responsiveGrid}>
              {allCategories.map((cat) => {
                const isSelected = category === cat.id;
                const displayName =
                  cat.id === "other" && catVerification.isValid
                    ? `Other (${customCategoryName.trim()})`
                    : cat.name;

                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => handleCategorySelect(cat.id, cat.name)}
                    style={[
                      styles.categoryCard,
                      { width: itemWidth },
                      isSelected && styles.categoryCardActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Category ${displayName}`}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        isSelected && styles.iconCircleActive,
                      ]}
                    >
                      <Text style={styles.categoryIcon}>
                        {categoryIcons[cat.id] || cat.icon || "🛠️"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.categoryLabel,
                        isSelected && styles.categoryLabelActive,
                      ]}
                      numberOfLines={2}
                    >
                      {displayName}
                    </Text>

                    {isSelected && (
                      <View style={styles.checkmarkBadge}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Custom Category Summary Pill if set */}
            {isOtherCategorySelected ? (
              <Pressable
                onPress={() => setShowCustomCatModal(true)}
                style={styles.customSummaryPill}
              >
                <Text style={styles.customSummaryText}>
                  {catVerification.isValid ? (
                    <>Custom Category: <Text style={styles.customSummaryBold}>{customCategoryName.trim()}</Text></>
                  ) : (
                    <Text style={{ color: "#E53E3E", fontWeight: "700" }}>⚠️ {catVerification.errorReason || "Invalid category name"}</Text>
                  )}
                </Text>
                <Text style={styles.customSummaryEdit}>
                  {catVerification.isValid ? "Edit ✏️" : "Fix ✏️"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          /* STAGE 2 — ROLES */
          <View style={styles.stageSection}>
            <View style={styles.questionHeader}>
              <View style={styles.selectedCategoryBar}>
                <Text style={styles.selectedCategoryLabel}>
                  Category: <Text style={styles.selectedCategoryName}>{categoryName}</Text>
                </Text>
                <Pressable
                  onPress={() => setStage(1)}
                  style={styles.changeCategoryBtn}
                >
                  <Text style={styles.changeCategoryText}>Change ✏️</Text>
                </Pressable>
              </View>
              <Text style={styles.stageTag}>STAGE 2 OF 7</Text>
              <Text style={styles.question}>
                Select a Role for {categoryName}
              </Text>
              <Text style={styles.subtitle}>
                Pick the specific job role so workers nearby know exactly what work they'll be doing.
              </Text>
            </View>

            {/* Responsive Flexible Role Grid with Rich Icons for Every Role */}
            <View style={styles.responsiveGrid}>
              {allRoles.map((r) => {
                const isSelected = role === r.id;
                const displayName =
                  r.id === "other-role" && roleVerification.isValid
                    ? `Other (${customRoleName.trim()})`
                    : r.name;
                const iconName = getRoleIcon(r.id, r.name);

                return (
                  <Pressable
                    key={r.id}
                    onPress={() => handleRoleSelect(r.id, r.name)}
                    style={[
                      styles.roleCard,
                      { width: itemWidth },
                      isSelected && styles.roleCardActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Role ${displayName}`}
                  >
                    <View
                      style={[
                        styles.roleIconCircle,
                        isSelected && styles.roleIconCircleActive,
                      ]}
                    >
                      <Ionicons
                        name={iconName}
                        size={22}
                        color={isSelected ? colors.green : colors.ink}
                      />
                    </View>

                    <Text
                      style={[
                        styles.roleLabel,
                        isSelected && styles.roleLabelActive,
                      ]}
                      numberOfLines={2}
                    >
                      {displayName}
                    </Text>

                    {isSelected && (
                      <View style={styles.roleCheckmarkBadge}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Custom Role Summary Pill if set */}
            {isOtherRoleSelected ? (
              <Pressable
                onPress={() => setShowCustomRoleModal(true)}
                style={styles.customSummaryPill}
              >
                <Text style={styles.customSummaryText}>
                  {roleVerification.isValid ? (
                    <>Custom Role: <Text style={styles.customSummaryBold}>{customRoleName.trim()}</Text></>
                  ) : (
                    <Text style={{ color: "#E53E3E", fontWeight: "700" }}>⚠️ {roleVerification.errorReason || "Invalid role name"}</Text>
                  )}
                </Text>
                <Text style={styles.customSummaryEdit}>
                  {roleVerification.isValid ? "Edit ✏️" : "Fix ✏️"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Buttons */}
      <PostWorkFooter
        isStage1={stage === 1}
        onExit={() => setShowExitModal(true)}
        onBack={handleBack}
        onNext={handleNext}
        nextDisabled={stage === 1 ? !isStage1Valid : !isStage2Valid}
      />

      {/* Pop-up Modal for Custom Category Name */}
      <CustomNameModal
        visible={showCustomCatModal}
        title="Custom Category"
        subtitle="Enter a clean, descriptive category name for your job."
        placeholder="e.g. Pet Care, Event Support, Gardening..."
        value={customCategoryName}
        onSave={handleSaveCustomCategory}
        onClose={() => setShowCustomCatModal(false)}
      />

      {/* Pop-up Modal for Custom Role Name */}
      <CustomNameModal
        visible={showCustomRoleModal}
        title="Custom Role"
        subtitle="Enter a clean, descriptive role name for workers."
        placeholder="e.g. Dog Walker, Special Assistant, Technician..."
        value={customRoleName}
        onSave={handleSaveCustomRole}
        onClose={() => setShowCustomRoleModal(false)}
      />

      {/* Exit Confirmation Modal */}
      <ExitModal
        visible={showExitModal}
        onClose={() => setShowExitModal(false)}
        onExit={handleConfirmExit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 32,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  errorBox: {
    backgroundColor: "#FFF5F5",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#FED7D7",
  },
  errorIcon: { fontSize: 36 },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.error,
    textAlign: "center",
  },
  stageSection: {
    gap: 20,
  },
  questionHeader: {
    gap: 6,
  },
  stageTag: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.green,
    letterSpacing: 1,
  },
  question: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
    lineHeight: 20,
  },
  selectedCategoryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 6,
  },
  selectedCategoryLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  selectedCategoryName: {
    fontWeight: "700",
    color: colors.green,
  },
  changeCategoryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.greenLight,
  },
  changeCategoryText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.green,
  },
  responsiveGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  categoryCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    position: "relative",
    padding: 14,
    paddingVertical: 18,
    minHeight: 120,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  categoryCardActive: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
    elevation: 3,
    shadowColor: colors.green,
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleActive: {
    backgroundColor: colors.white,
  },
  categoryIcon: { fontSize: 26 },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
    lineHeight: 17,
  },
  categoryLabelActive: {
    color: colors.green,
  },
  checkmarkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: "800",
  },
  roleCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    position: "relative",
    padding: 14,
    paddingVertical: 16,
    minHeight: 110,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  roleCardActive: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
    elevation: 3,
    shadowColor: colors.green,
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  roleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  roleIconCircleActive: {
    backgroundColor: colors.white,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
    lineHeight: 17,
  },
  roleLabelActive: {
    color: colors.green,
  },
  roleCheckmarkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  customSummaryPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.green,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  customSummaryText: {
    fontSize: 14,
    color: colors.ink,
  },
  customSummaryBold: {
    fontWeight: "700",
    color: colors.green,
  },
  customSummaryEdit: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.green,
    backgroundColor: colors.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
});
