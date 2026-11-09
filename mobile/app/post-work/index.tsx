import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  ExitModal,
  CustomNameModal,
  StageSlider,
  POST_WORK_TYPOGRAPHY,
} from "../../src/components/PostWorkUI";
import { usePostWorkStore } from "../../src/features/post-work/store";
import { api } from "../../src/api/client";
import { verifyCustomName } from "../../src/utils/nameVerification";
import {
  MAIN_CATEGORIES,
  SUBCATEGORIES,
} from "../../src/features/post-work/dynamicCategories";
import { PostWorkDetailsScreen, PostWorkDetailsHandle } from "./details";
import { PostWorkLocationScreen, PostWorkLocationHandle } from "./location";
import { PostWorkScheduleScreen, PostWorkScheduleHandle } from "./schedule";
import { PostWorkPayScreen, PostWorkPayHandle } from "./pay";
import { PostWorkReviewScreen, PostWorkReviewHandle } from "./review";

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

  const params = useLocalSearchParams<{
    search?: string;
    q?: string;
    stage?: string;
    preserveDraft?: string;
  }>();

  // Child stage handles for validation and actions
  const detailsRef = useRef<PostWorkDetailsHandle>(null);
  const locationRef = useRef<PostWorkLocationHandle>(null);
  const scheduleRef = useRef<PostWorkScheduleHandle>(null);
  const payRef = useRef<PostWorkPayHandle>(null);
  const reviewRef = useRef<PostWorkReviewHandle>(null);

  const initialSearch = params.search || params.q || "";
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // Transition State Machine
  const initialStageNum = params.stage ? Math.min(Math.max(Number(params.stage) || 1, 1), 7) : 1;
  const [currentStage, setCurrentStage] = useState<number>(initialStageNum);
  const [visualActiveStage, setVisualActiveStage] = useState<number>(initialStageNum);
  const [transitionStage, setTransitionStage] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">("forward");
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const isTransitioningRef = useRef(false);

  // Animation values
  const lineProgress = useRef(new Animated.Value(initialStageNum)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Submitting state from review screen
  const [isPosting, setIsPosting] = useState(false);

  const [, setRoles] = useState<Role[]>([]);
  const [showExitModal, setShowExitModal] = useState(false);

  // Pop-up modal for custom role / category
  const [showCustomRoleModal, setShowCustomRoleModal] = useState(false);
  const [customRoleName, setCustomRoleName] = useState("");
  const [showCustomCategoryModal, setShowCustomCategoryModal] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");

  const { data: catalog, isLoading, isError, error, refetch: refetchCatalog } = useQuery<CatalogResponse>({
    queryKey: ["categories"],
    queryFn: () => api<CatalogResponse>("/categories"),
    staleTime: 0,
  });

  useEffect(() => {
    if (!editingJobId && params.preserveDraft !== "1") {
      resetFlow();
    }
  }, [editingJobId, params.preserveDraft]);

  // Synchronize stage param if requested externally
  useEffect(() => {
    if (params.stage) {
      const target = Number(params.stage);
      if (target >= 1 && target <= 7 && target !== currentStage && !isTransitioningRef.current) {
        lineProgress.setValue(target);
        setCurrentStage(target);
        setVisualActiveStage(target);
      }
    }
  }, [params.stage]);

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
      if ((role === "other-role" || role === "other-work-role") && roleName) {
        setCustomRoleName(roleName);
      }
    }
  }, [editingJobId, role, roleName]);

  const handleCategorySelect = (catId: string, catName: string) => {
    if (catId === "other") {
      setCustomCategoryName(category.startsWith("other-") ? categoryName : "");
      setShowCustomCategoryModal(true);
      return;
    }
    setCategory(catId, catName);
    if (catalog) {
      const categoryRoles = catalog.roles.filter((r) => r.categoryId === catId);
      setRoles(categoryRoles);
    }
    setSearchQuery("");
  };

  const handleSaveCustomCategory = async (sanitizedName: string) => {
    const slug = sanitizedName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "custom";
    const categoryId = `other-${slug}`;
    try {
      await api("/categories", {
        method: "POST",
        body: JSON.stringify({ id: categoryId, name: sanitizedName, icon: "📋", kind: "job" }),
      });
    } catch {}
    setCategory(categoryId, sanitizedName);
    setRoles([]);
    setSearchQuery("");
    setShowCustomCategoryModal(false);
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

  const handleSaveCustomRole = async (sanitizedName: string) => {
    const cleanId = sanitizedName.toLowerCase().trim().replace(/[^a-z0-9-_]/g, "-");
    setCustomRoleName(sanitizedName);
    setRole(cleanId, sanitizedName);
    setShowCustomRoleModal(false);
    try {
      await api("/roles", {
        method: "POST",
        body: JSON.stringify({ id: cleanId, categoryId: category || "general", name: sanitizedName, icon: "💼" }),
      });
      refetchCatalog();
    } catch {}
  };

  const isStage1Valid = Boolean(category);
  const isOtherRoleSelected = role === "other-role" || role === "other-work-role";
  const roleVerification = verifyCustomName(customRoleName);
  const isStage2Valid = Boolean(
    role && (!isOtherRoleSelected || roleVerification.isValid)
  );

  // ----------------------------------------------------
  // SEQUENCED NAVIGATION CONTROLLER (STRICT REQUIREMENTS)
  // ----------------------------------------------------
  const navigateToStage = useCallback((target: number, dir: "forward" | "backward") => {
    if (isTransitioningRef.current || target === currentStage) return;

    isTransitioningRef.current = true;
    setIsTransitioning(true);
    setSlideDirection(dir);

    // Step 2 & 3: Connector line begins moving from current stage to destination.
    // Destination icon STAYS INACTIVE until the line reaches it!
    Animated.timing(lineProgress, {
      toValue: target,
      duration: 220,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) {
        isTransitioningRef.current = false;
        setIsTransitioning(false);
        return;
      }

      // Step 4: Line reaches destination! NOW activate the destination stage icon.
      setVisualActiveStage(target);

      // Step 5: Smooth horizontal content transition
      setTransitionStage(target);
      slideAnim.setValue(0);

      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }).start(({ finished: slideFinished }) => {
        if (!slideFinished) {
          isTransitioningRef.current = false;
          setIsTransitioning(false);
          setTransitionStage(null);
          return;
        }

        // Settled
        setCurrentStage(target);
        setTransitionStage(null);
        isTransitioningRef.current = false;
        setIsTransitioning(false);
      });
    });
  }, [currentStage, lineProgress, slideAnim]);

  // ----------------------------------------------------
  // NEXT BUTTON HANDLER (VALIDATE FIRST, THEN ANIMATE)
  // ----------------------------------------------------
  const handleNext = async () => {
    if (isTransitioningRef.current) return;

    // Stage 1: Category
    if (currentStage === 1) {
      if (!isStage1Valid) {
        Alert.alert("Select Category", "Please select a category to continue.");
        return;
      }
      navigateToStage(2, "forward");
      return;
    }

    // Stage 2: Role
    if (currentStage === 2) {
      if (isOtherRoleSelected && !roleVerification.isValid) {
        setShowCustomRoleModal(true);
        return;
      }
      if (!isStage2Valid) {
        Alert.alert("Select Role", "Please select a role to continue.");
        return;
      }
      navigateToStage(3, "forward");
      return;
    }

    // Stage 3: Title & Details
    if (currentStage === 3) {
      const ok = detailsRef.current?.validateAndSave();
      if (!ok) return;

      // Online format skips map location (Stage 4) and jumps straight to schedule (Stage 5)
      const storeState = usePostWorkStore.getState();
      const isOnline =
        storeState.dynamicAnswers?.teachingMode === "online" ||
        storeState.workMode === "online";
      if (isOnline) {
        navigateToStage(5, "forward");
        return;
      }
      navigateToStage(4, "forward");
      return;
    }

    // Stage 4: Location
    if (currentStage === 4) {
      const ok = locationRef.current?.validateAndSave();
      if (!ok) return;
      navigateToStage(5, "forward");
      return;
    }

    // Stage 5: Dates / Schedule
    if (currentStage === 5) {
      const ok = scheduleRef.current?.validateAndSave();
      if (!ok) return;
      navigateToStage(6, "forward");
      return;
    }

    // Stage 6: Pay
    if (currentStage === 6) {
      const ok = payRef.current?.validateAndSave();
      if (!ok) return;
      navigateToStage(7, "forward");
      return;
    }

    // Stage 7: Review & Final Submit
    if (currentStage === 7) {
      reviewRef.current?.submitJob();
      return;
    }
  };

  // ----------------------------------------------------
  // BACK BUTTON HANDLER (STRICT REVERSE SEQUENCE)
  // ----------------------------------------------------
  const handleBack = () => {
    if (isTransitioningRef.current) return;

    if (currentStage === 1) {
      setShowExitModal(true);
      return;
    }

    // If on Stage 5 and online mode was chosen, jump back over Stage 4 to Stage 3
    if (currentStage === 5) {
      const storeState = usePostWorkStore.getState();
      const isOnline =
        storeState.dynamicAnswers?.teachingMode === "online" ||
        storeState.workMode === "online";
      if (isOnline) {
        navigateToStage(3, "backward");
        return;
      }
      navigateToStage(4, "backward");
      return;
    }

    navigateToStage(currentStage - 1, "backward");
  };

  // Progress Bar node tap
  const handleStepPress = (stepNum: number) => {
    if (isTransitioningRef.current || stepNum === currentStage) return;

    // Allow jumping to completed stages, or any stage if editing an existing job
    if (editingJobId || stepNum < currentStage) {
      navigateToStage(stepNum, stepNum > currentStage ? "forward" : "backward");
    }
  };

  // Stage 7 Review Edit buttons tap
  const handleJumpToStage = (target: number) => {
    if (isTransitioningRef.current || target === currentStage) return;
    navigateToStage(target, target > currentStage ? "forward" : "backward");
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

  // Dynamic categories and subcategories
  const filteredCategories = MAIN_CATEGORIES.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return c.name.toLowerCase().includes(q);
  });

  const subcategoriesForCat = SUBCATEGORIES.filter((s) => s.categoryId === category);
  const filteredRoles = subcategoriesForCat.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return r.name.toLowerCase().includes(q);
  });

  const activeCategoryTitle =
    categoryName ||
    (category === "tuition"
      ? "Tuition"
      : category === "education-training"
      ? "Education & Training"
      : category === "other"
      ? "Other"
      : "Service");

  // Disable Next button on stages 1 & 2 if incomplete
  const isNextDisabled =
    (currentStage === 1 && !isStage1Valid) ||
    (currentStage === 2 && !isStage2Valid) ||
    isPosting;

  // ----------------------------------------------------
  // STAGE CONTENT RENDERER
  // ----------------------------------------------------
  const renderStage = (stageNum: number) => {
    switch (stageNum) {
      case 1:
        return (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#03402D" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : isError ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={28} color="#DC2626" />
                <Text style={styles.errorText}>
                  {error instanceof Error ? error.message : "Could not load categories"}
                </Text>
              </View>
            ) : (
              <View style={styles.stageSection}>
                <View style={styles.questionHeader}>
                  <Text style={styles.question}>Select Category</Text>
                </View>

                {/* Live Search Bar */}
                <View style={styles.searchBarBox}>
                  <Ionicons name="search" size={17} color="#64748B" style={styles.searchIcon} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search category..."
                    placeholderTextColor="#94A3B8"
                    style={styles.searchInput}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </Pressable>
                  )}
                </View>

                {/* Main Category Cards */}
                <View style={styles.itemsList}>
                  {filteredCategories.map((cat) => {
                    const isSelected =
                      category === cat.id || (cat.id === "other" && category.startsWith("other-"));

                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => handleCategorySelect(cat.id, cat.name)}
                        style={[styles.itemCard, isSelected && styles.itemCardActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={cat.name}
                      >
                        <View style={[styles.iconBox, isSelected && styles.iconBoxActive]}>
                          <Ionicons
                            name={cat.icon}
                            size={26}
                            color={isSelected ? "#FFFFFF" : "#03402D"}
                          />
                        </View>

                        <Text style={[styles.itemTitle, isSelected && styles.itemTitleActive]}>
                          {cat.name}
                        </Text>

                        <View
                          style={[
                            styles.selectionCircle,
                            isSelected && styles.selectionCircleActive,
                          ]}
                        >
                          {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        );

      case 2:
        return (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.stageSection}>
              {/* Category Breadcrumb */}
              <View style={styles.subHeaderWrap}>
                <View style={styles.parentCatPill}>
                  <Ionicons name="apps" size={13} color="#03402D" />
                  <Text style={styles.parentCatText}>{activeCategoryTitle}</Text>
                </View>
              </View>

              <View style={styles.questionHeader}>
                <Text style={styles.question}>Select Service</Text>
              </View>

              {/* Search Bar */}
              <View style={styles.searchBarBox}>
                <Ionicons name="search" size={17} color="#64748B" style={styles.searchIcon} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search service..."
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </Pressable>
                )}
              </View>

              {/* Subcategory List */}
              <View style={styles.itemsList}>
                {filteredRoles.map((sub) => {
                  const isSelected = role === sub.id;

                  return (
                    <Pressable
                      key={sub.id}
                      onPress={() => handleRoleSelect(sub.id, sub.name)}
                      style={[styles.itemCard, isSelected && styles.itemCardActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={sub.name}
                    >
                      <View style={[styles.iconBox, isSelected && styles.iconBoxActive]}>
                        <Ionicons
                          name={sub.icon}
                          size={24}
                          color={isSelected ? "#FFFFFF" : "#03402D"}
                        />
                      </View>

                      <Text style={[styles.itemTitle, isSelected && styles.itemTitleActive]}>
                        {sub.name}
                      </Text>

                      <View
                        style={[
                          styles.selectionCircle,
                          isSelected && styles.selectionCircleActive,
                        ]}
                      >
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                    </Pressable>
                  );
                })}

                {/* Custom Role Option */}
                {isOtherRoleSelected && customRoleName ? (
                  <View style={[styles.itemCard, styles.itemCardActive]}>
                    <View style={[styles.iconBox, styles.iconBoxActive]}>
                      <Ionicons name="sparkles" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.itemTitle, styles.itemTitleActive]}>
                      {customRoleName}
                    </Text>
                    <Pressable
                      onPress={() => setShowCustomRoleModal(true)}
                      style={styles.customEditBtn}
                    >
                      <Text style={styles.customEditText}>Edit ✏️</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => handleRoleSelect("other-role", "Other")}
                    style={[styles.itemCard, styles.customItemCard]}
                    accessibilityRole="button"
                    accessibilityLabel="Add a custom service"
                  >
                    <View style={[styles.iconBox, styles.customIconBox]}>
                      <Ionicons name="add-circle-outline" size={20} color="#03402D" />
                    </View>
                    <Text style={styles.customPromptTitle}>
                      Can't find your service? Add custom
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </ScrollView>
        );

      case 3:
        return <PostWorkDetailsScreen ref={detailsRef} embedded />;

      case 4:
        return <PostWorkLocationScreen ref={locationRef} embedded />;

      case 5:
        return <PostWorkScheduleScreen ref={scheduleRef} embedded />;

      case 6:
        return <PostWorkPayScreen ref={payRef} embedded />;

      case 7:
        return (
          <PostWorkReviewScreen
            ref={reviewRef}
            embedded
            onNavigateStage={handleJumpToStage}
            onPostingChange={setIsPosting}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── 1. Top Header (Completely stationary, compact, centered title) ── */}
      <PostWorkHeader
        title={editingJobId ? "Edit Job" : "Job Details"}
        onExit={() => setShowExitModal(true)}
      />

      {/* ── 2. Seven-Stage Progress Navigation (Completely stationary) ── */}
      <StageProgressIndicator
        currentStep={currentStage}
        visualActiveStage={visualActiveStage}
        lineProgress={lineProgress}
        onStepPress={handleStepPress}
        disabled={isTransitioning}
      />

      {/* ── 3. Changing Stage Content (Smooth Horizontal Sliding Window) ── */}
      <StageSlider
        currentStage={currentStage}
        transitionStage={transitionStage}
        slideDirection={slideDirection}
        slideAnim={slideAnim}
        renderStage={renderStage}
      />

      {/* ── 4. Persistent Bottom Navigation (Completely stationary) ── */}
      <PostWorkFooter
        currentStep={currentStage}
        isStage1={currentStage === 1}
        isFinalStage={currentStage === 7}
        onBack={handleBack}
        onNext={handleNext}
        onExit={() => setShowExitModal(true)}
        nextDisabled={isNextDisabled}
        isTransitioning={isTransitioning}
        loading={isPosting}
        nextLabel={currentStage === 7 ? (editingJobId ? "Update Job" : "Post Work") : "Next"}
        backLabel={currentStage === 1 ? "Exit" : "Back"}
      />

      {/* Exit Modal */}
      <ExitModal
        visible={showExitModal}
        onClose={() => setShowExitModal(false)}
        onExit={handleConfirmExit}
      />

      {/* Custom Category Modal */}
      <CustomNameModal
        visible={showCustomCategoryModal}
        title="Add Category"
        subtitle="Specify your business or service field"
        placeholder="e.g. Pet Care, Gardening"
        value={customCategoryName}
        onSave={handleSaveCustomCategory}
        onClose={() => setShowCustomCategoryModal(false)}
      />

      {/* Custom Role Modal */}
      <CustomNameModal
        visible={showCustomRoleModal}
        title="Add Service"
        subtitle="Specify what role or service you need"
        placeholder="e.g. Dog Walker, Plant Pruner"
        value={customRoleName}
        onSave={handleSaveCustomRole}
        onClose={() => setShowCustomRoleModal(false)}
      />
    </SafeAreaView>
  );
}

// ----------------------------------------------------
// STYLES
// ----------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  stageSection: {
    gap: 12,
  },
  questionHeader: {
    marginBottom: 4,
  },
  question: {
    fontSize: POST_WORK_TYPOGRAPHY.screenHeading,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  subHeaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  parentCatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  parentCatText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#03402D",
  },
  searchBarBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
    marginBottom: 4,
  },
  searchIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
    padding: 0,
  },
  itemsList: {
    gap: 10,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  itemCardActive: {
    borderColor: "#03402D",
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxActive: {
    backgroundColor: "#03402D",
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  itemTitleActive: {
    color: "#03402D",
    fontWeight: "800",
  },
  selectionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCircleActive: {
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  customItemCard: {
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  customIconBox: {
    backgroundColor: "#E2E8F0",
  },
  customPromptTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    color: "#475569",
  },
  customEditBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
  },
  customEditText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  errorBox: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "600",
    textAlign: "center",
  },
});
