import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
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

const categoryVectorIcons: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  construction: { icon: "build-outline", color: "#D97706", bg: "#FEF3C7" },
  household: { icon: "home-outline", color: "#0284C7", bg: "#E0F2FE" },
  food: { icon: "restaurant-outline", color: "#EA580C", bg: "#FFEDD5" },
  transport: { icon: "car-outline", color: "#2563EB", bg: "#DBEAFE" },
  shops: { icon: "storefront-outline", color: "#7C3AED", bg: "#EDE9FE" },
  events: { icon: "balloon-outline", color: "#DB2777", bg: "#FCE7F3" },
  security: { icon: "shield-checkmark-outline", color: "#059669", bg: "#D1FAE5" },
  education: { icon: "school-outline", color: "#0D9488", bg: "#CCFBF1" },
  healthcare: { icon: "medkit-outline", color: "#DC2626", bg: "#FEE2E2" },
  beauty: { icon: "sparkles-outline", color: "#C026D3", bg: "#FAE8FF" },
  promotion: { icon: "megaphone-outline", color: "#CA8A04", bg: "#FEF9C3" },
  office: { icon: "briefcase-outline", color: "#475569", bg: "#F1F5F9" },
  other: { icon: "grid-outline", color: "#03402D", bg: "#E6F4EE" },
};

function getCategoryVectorIcon(catId: string, catName: string) {
  if (categoryVectorIcons[catId]) return categoryVectorIcons[catId];
  const name = catName.toLowerCase();
  if (name.includes("build") || name.includes("construct")) return { icon: "build-outline" as const, color: "#D97706", bg: "#FEF3C7" };
  if (name.includes("house") || name.includes("home") || name.includes("clean")) return { icon: "home-outline" as const, color: "#0284C7", bg: "#E0F2FE" };
  if (name.includes("food") || name.includes("cook") || name.includes("eat")) return { icon: "restaurant-outline" as const, color: "#EA580C", bg: "#FFEDD5" };
  if (name.includes("car") || name.includes("driv") || name.includes("trans")) return { icon: "car-outline" as const, color: "#2563EB", bg: "#DBEAFE" };
  if (name.includes("shop") || name.includes("store")) return { icon: "storefront-outline" as const, color: "#7C3AED", bg: "#EDE9FE" };
  if (name.includes("event") || name.includes("party")) return { icon: "balloon-outline" as const, color: "#DB2777", bg: "#FCE7F3" };
  if (name.includes("guard") || name.includes("secur")) return { icon: "shield-checkmark-outline" as const, color: "#059669", bg: "#D1FAE5" };
  if (name.includes("teach") || name.includes("school") || name.includes("edu")) return { icon: "school-outline" as const, color: "#0D9488", bg: "#CCFBF1" };
  if (name.includes("health") || name.includes("med")) return { icon: "medkit-outline" as const, color: "#DC2626", bg: "#FEE2E2" };
  if (name.includes("office") || name.includes("work")) return { icon: "briefcase-outline" as const, color: "#475569", bg: "#F1F5F9" };
  return { icon: "grid-outline" as const, color: "#03402D", bg: "#E6F4EE" };
}

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
    editingJobId,
  } = usePostWorkStore();

  const params = useLocalSearchParams<{ search?: string; q?: string }>();
  const initialSearch = params.search || params.q || "";
  const [searchQuery, setSearchQuery] = useState(initialSearch);

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
    if (!editingJobId) {
      resetFlow();
    }
  }, [editingJobId]);

  useEffect(() => {
    if (catalog && category) {
      const categoryRoles = catalog.roles.filter((r) => r.categoryId === category);
      setRoles(categoryRoles);
      const matchedCat = catalog.categories.find((c) => c.id === category);
      if (matchedCat && !categoryName) {
        setCategory(matchedCat.id, matchedCat.name);
      }
      if (role && !roleName) {
        const matchedRole = categoryRoles.find((r) => r.id === role);
        if (matchedRole) {
          setRole(matchedRole.id, matchedRole.name);
        }
      }
    }
  }, [category, catalog, role, categoryName, roleName]);

  useEffect(() => {
    if (editingJobId) {
      if ((category === "other" || category === "other-work") && categoryName) {
        setCustomCategoryName(categoryName);
      }
      if ((role === "other-role" || role === "other-work-role") && roleName) {
        setCustomRoleName(roleName);
      }
    }
  }, [editingJobId, category, role, categoryName, roleName]);

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
    const targetId = editingJobId;
    setShowExitModal(false);
    resetFlow();
    if (targetId) {
      router.replace(`/jobs/${targetId}`);
    } else {
      router.replace("/provider-home");
    }
  };

  const handleStepPress = (stepNum: number) => {
    if (stepNum === 1) {
      setStage(1);
    } else if (stepNum === 2 && isStage1Valid) {
      setStage(2);
    } else if (editingJobId) {
      if (stepNum === 3) router.push("/post-work/details");
      else if (stepNum === 4) router.push("/post-work/location");
      else if (stepNum === 5) router.push("/post-work/schedule");
      else if (stepNum === 6) router.push("/post-work/pay");
      else if (stepNum === 7) router.push("/post-work/review");
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

  const filteredCategories = searchQuery.trim()
    ? allCategories.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : allCategories;

  const filteredRoles = searchQuery.trim()
    ? allRoles.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : allRoles;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header with ← Exit button */}
      <PostWorkHeader
        title={editingJobId ? "Edit Job" : "Post Job"}
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
            <ActivityIndicator size="large" color="#03402D" />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : isError ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={32} color="#DC2626" />
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
                Pick the main category of work so we can match you with verified local workers.
              </Text>
            </View>

            {/* Live Search Input Bar */}
            <View style={styles.searchBarBox}>
              <View style={styles.searchBadgeIcon}>
                <Ionicons name="search" size={16} color="#03402D" />
              </View>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search categories (e.g. Household, Construction...)"
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </Pressable>
              ) : null}
            </View>

            {/* Responsive Flexible Category Grid */}
            <View style={styles.responsiveGrid}>
              {filteredCategories.map((cat) => {
                const isSelected = category === cat.id;
                const displayName =
                  cat.id === "other" && catVerification.isValid
                    ? `Other (${customCategoryName.trim()})`
                    : cat.name;
                const iconConfig = getCategoryVectorIcon(cat.id, cat.name);

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
                        { backgroundColor: isSelected ? "#03402D" : iconConfig.bg },
                      ]}
                    >
                      <Ionicons
                        name={iconConfig.icon}
                        size={22}
                        color={isSelected ? "#FFFFFF" : iconConfig.color}
                      />
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
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
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
                    <Text style={{ color: "#DC2626", fontWeight: "700" }}>⚠️ {catVerification.errorReason || "Invalid category name"}</Text>
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

            {/* Live Search Input Bar for Roles */}
            <View style={styles.searchBarBox}>
              <View style={styles.searchBadgeIcon}>
                <Ionicons name="search" size={16} color="#03402D" />
              </View>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={`Search roles in ${categoryName || "category"}...`}
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </Pressable>
              ) : null}
            </View>

            {/* Responsive Flexible Role Grid with Rich Icons for Every Role */}
            <View style={styles.responsiveGrid}>
              {filteredRoles.map((r) => {
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
                        size={20}
                        color={isSelected ? "#FFFFFF" : "#03402D"}
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
                        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
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
                    <Text style={{ color: "#DC2626", fontWeight: "700" }}>⚠️ {roleVerification.errorReason || "Invalid role name"}</Text>
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
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    position: "relative",
    padding: 14,
    paddingVertical: 18,
    minHeight: 118,
  },
  categoryCardActive: {
    borderColor: "#03402D",
    borderWidth: 2,
    backgroundColor: "#E6F4EE",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
    lineHeight: 17,
  },
  categoryLabelActive: {
    color: "#03402D",
    fontWeight: "800",
  },
  checkmarkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#03402D",
    alignItems: "center",
    justifyContent: "center",
  },
  roleCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    position: "relative",
    padding: 14,
    paddingVertical: 16,
    minHeight: 110,
  },
  roleCardActive: {
    borderColor: "#03402D",
    borderWidth: 2,
    backgroundColor: "#E6F4EE",
  },
  roleIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  roleIconCircleActive: {
    backgroundColor: "#03402D",
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
    lineHeight: 17,
  },
  roleLabelActive: {
    color: "#03402D",
    fontWeight: "800",
  },
  roleCheckmarkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#03402D",
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
    borderColor: "#03402D",
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
    color: "#03402D",
  },
  customSummaryEdit: {
    fontSize: 12,
    fontWeight: "700",
    color: "#03402D",
    backgroundColor: "#E6F4EE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  searchBarBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingLeft: 10,
    paddingRight: 14,
    height: 48,
    marginBottom: 16,
  },
  searchBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E6F4EE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    height: "100%",
    paddingVertical: 0,
  },
});
