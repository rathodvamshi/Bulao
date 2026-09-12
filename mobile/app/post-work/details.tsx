import { router } from "expo-router";
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/components/ui";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  ExitModal,
} from "../../src/components/PostWorkUI";
import {
  usePostWorkStore,
  ExperienceLevel,
  GenderType,
} from "../../src/features/post-work/store";
import {
  verifyJobTitle,
  verifyJobDescription,
  getExperienceOptionsForRole,
  getRoleGenderIcons,
  getTitleSuggestionsForRole,
  getExactRoleIcon,
} from "../../src/utils/nameVerification";

export default function PostWorkDetailsScreen() {
  const {
    category,
    categoryName,
    role,
    roleName,
    title,
    workers,
    genderType: savedGenderType,
    maleWorkers: savedMaleWorkers,
    femaleWorkers: savedFemaleWorkers,
    experience,
    experiences: savedExperiences,
    description: savedDescription,
    setDetails,
    resetFlow,
  } = usePostWorkStore();

  const [showExitModal, setShowExitModal] = useState(false);

  // 1. Job Title State & Default Auto-population
  const defaultTitle = title.trim() || `${roleName || "Worker"} needed`;
  const [localTitle, setLocalTitle] = useState(defaultTitle);

  // 2. Job Description State
  const [localDescription, setLocalDescription] = useState(savedDescription || "");

  // 3. Gender & Worker Count Strategy State
  const [localGenderType, setLocalGenderType] = useState<GenderType>(savedGenderType || "any");
  const [localWorkers, setLocalWorkers] = useState<number>(workers || 1);
  const [localMaleWorkers, setLocalMaleWorkers] = useState<number>(savedMaleWorkers ?? 1);
  const [localFemaleWorkers, setLocalFemaleWorkers] = useState<number>(savedFemaleWorkers ?? 0);

  // Dynamic Contextual Experience Options tailored for the selected Category & Role
  const dynamicExperienceOptions = useMemo(
    () => getExperienceOptionsForRole(role, roleName, category),
    [role, roleName, category]
  );

  // 4. Multi-Select Experience Level (Default: Top one is selected, at least one mandatory)
  const [localExperiences, setLocalExperiences] = useState<ExperienceLevel[]>(() => {
    if (savedExperiences && savedExperiences.length > 0) return savedExperiences;
    if (experience) return [experience];
    return [dynamicExperienceOptions[0]?.value || "any"];
  });

  // Auto-seed and sync store data whenever editing or store values change
  React.useEffect(() => {
    if (title) setLocalTitle(title);
    if (savedDescription) setLocalDescription(savedDescription);
    if (workers) setLocalWorkers(workers);
    if (savedGenderType) setLocalGenderType(savedGenderType);
    if (savedMaleWorkers !== undefined) setLocalMaleWorkers(savedMaleWorkers);
    if (savedFemaleWorkers !== undefined) setLocalFemaleWorkers(savedFemaleWorkers);
    if (savedExperiences && savedExperiences.length > 0) {
      setLocalExperiences(savedExperiences);
    } else if (experience) {
      setLocalExperiences([experience]);
    }
  }, [
    title,
    savedDescription,
    workers,
    savedGenderType,
    savedMaleWorkers,
    savedFemaleWorkers,
    savedExperiences,
    experience,
  ]);

  const { width } = useWindowDimensions();

  // Verification Results
  const titleVerification = useMemo(
    () => verifyJobTitle(localTitle, categoryName, roleName),
    [localTitle, categoryName, roleName]
  );

  const descriptionVerification = useMemo(
    () => verifyJobDescription(localDescription),
    [localDescription]
  );

  // Exact Role Icon for Job Title & Role matching
  const exactRoleIcon = useMemo(
    () => getExactRoleIcon(role, roleName, category),
    [role, roleName, category]
  );

  // Role-Specific Gender Avatars (Matching work dress codes: e.g. Hardhats for construction, Chef hats for cooks, etc.)
  const genderIcons = useMemo(
    () => getRoleGenderIcons(role, roleName, category),
    [role, roleName, category]
  );

  // Smart Context Suggestion Cards with matching icons & badges
  const titleSuggestions = useMemo(
    () => getTitleSuggestionsForRole(role, roleName, category, categoryName),
    [role, roleName, category, categoryName]
  );

  // Compute Total Active Workers based on Gender strategy
  const computedTotalWorkers = useMemo(() => {
    if (localGenderType === "custom") {
      return localMaleWorkers + localFemaleWorkers;
    }
    return localWorkers;
  }, [localGenderType, localWorkers, localMaleWorkers, localFemaleWorkers]);

  const isFormValid =
    titleVerification.isValid &&
    descriptionVerification.isValid &&
    computedTotalWorkers >= 1 &&
    localExperiences.length >= 1;

  // Handle Multi-Select Experience Toggle (Mandatory minimum 1)
  const handleToggleExperience = (expVal: ExperienceLevel) => {
    setLocalExperiences((prev) => {
      if (prev.includes(expVal)) {
        // Only remove if there's at least 1 other item selected
        if (prev.length > 1) {
          return prev.filter((item) => item !== expVal);
        }
        return prev; // Keep selected if it's the only one
      } else {
        return [...prev, expVal];
      }
    });
  };

  // Handle Gender Tab Selection
  const handleSelectGenderType = (type: GenderType) => {
    setLocalGenderType(type);
    if (type === "custom") {
      const male = localMaleWorkers > 0 ? localMaleWorkers : 1;
      const female = localFemaleWorkers > 0 ? localFemaleWorkers : 1;
      setLocalMaleWorkers(male);
      setLocalFemaleWorkers(female);
    } else {
      if (localWorkers < 1) setLocalWorkers(1);
    }
  };

  const handleNext = () => {
    if (!isFormValid) return;

    const primaryExperience = localExperiences[0] || "any";

    setDetails(
      titleVerification.sanitizedName,
      computedTotalWorkers,
      primaryExperience,
      localGenderType,
      localGenderType === "custom"
        ? localMaleWorkers
        : localGenderType === "male"
        ? localWorkers
        : 0,
      localGenderType === "custom"
        ? localFemaleWorkers
        : localGenderType === "female"
        ? localWorkers
        : 0,
      descriptionVerification.sanitizedName,
      localExperiences
    );

    router.push("/post-work/location");
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    resetFlow();
    router.replace("/provider-home");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header with ← Exit */}
      <PostWorkHeader
        title="Job Details"
        currentStep={3}
        totalSteps={7}
        onExit={() => setShowExitModal(true)}
      />

      {/* Connected Stage Progress Indicator */}
      <StageProgressIndicator
        currentStep={3}
        onStepPress={(step) => {
          if (step === 1 || step === 2) router.push("/post-work");
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stageTag}>STAGE 3 OF 7</Text>
        <Text style={styles.question}>Tell us about the work</Text>
        <Text style={styles.subtitle}>
          Set a clear job title, how many workers you need, gender preference, and their experience level.
        </Text>

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 1: JOB TITLE WITH ROLE ICON & CONTEXT VERIFICATION       */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Text style={styles.sectionIconEmoji}>{exactRoleIcon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Job Title</Text>
              <Text style={styles.sectionSubtitle}>
                Clear title for {roleName || "workers"} in {categoryName || "your category"}
              </Text>
            </View>
          </View>

          {/* Job Title Input with Role Icon on the left & Verified Check on the right */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIconLeft}>
              <Text style={styles.inputEmojiLeft}>{exactRoleIcon}</Text>
            </View>
            <TextInput
              value={localTitle}
              onChangeText={setLocalTitle}
              placeholder={`${roleName || "Worker"} needed`}
              placeholderTextColor={colors.mutedLight}
              maxLength={80}
              style={[
                styles.inputWithIcon,
                !titleVerification.isValid && localTitle.trim().length > 0 && styles.inputError,
                titleVerification.isValid && styles.inputSuccess,
              ]}
              returnKeyType="done"
            />
            {titleVerification.isValid && (
              <View style={styles.verifiedIconBadge}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              </View>
            )}
          </View>

          {/* Validation Feedback: Only show error banner if title is invalid */}
          {localTitle.trim().length > 0 && !titleVerification.isValid && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#E53E3E" />
              <Text style={styles.errorBannerText}>{titleVerification.errorReason}</Text>
            </View>
          )}

          {/* Smart Title Suggestion Cards (Structured 2x2 Grid with Increased Height & Clean Proportions) */}
          <Text style={styles.suggestionHeader}>Quick Title Suggestions:</Text>
          <View style={styles.suggestionGrid}>
            {titleSuggestions.map((item) => {
              const isSelected = localTitle === item.text;
              return (
                <Pressable
                  key={item.text}
                  onPress={() => setLocalTitle(item.text)}
                  style={[
                    styles.suggestionCard,
                    isSelected && styles.suggestionCardActive,
                  ]}
                >
                  <View style={styles.suggestionCardTop}>
                    <View
                      style={[
                        styles.suggestionIconCircle,
                        isSelected && styles.suggestionIconCircleActive,
                      ]}
                    >
                      <Text style={styles.suggestionIconText}>{item.icon}</Text>
                    </View>
                    <View
                      style={[
                        styles.suggestionTag,
                        isSelected && styles.suggestionTagActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.suggestionTagText,
                          isSelected && styles.suggestionTagTextActive,
                        ]}
                      >
                        {item.badge}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.suggestionCardText,
                      isSelected && styles.suggestionCardTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {item.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 2: OPTIONAL JOB DESCRIPTION BOX                          */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="document-text-outline" size={20} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.sectionTitle}>Job Description</Text>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalBadgeText}>Optional</Text>
                </View>
              </View>
              <Text style={styles.sectionSubtitle}>
                Add specific tasks, tools, or instructions (phone number allowed)
              </Text>
            </View>
          </View>

          <TextInput
            value={localDescription}
            onChangeText={setLocalDescription}
            placeholder="e.g. Need help with kitchen plumbing repair and pipe fitting. Bring basic tools. Contact: 9876543210"
            placeholderTextColor={colors.mutedLight}
            multiline
            numberOfLines={3}
            maxLength={500}
            style={[
              styles.textArea,
              !descriptionVerification.isValid && styles.inputError,
            ]}
          />

          <View style={styles.descriptionFooterRow}>
            {localDescription.trim().length > 0 && !descriptionVerification.isValid ? (
              <Text style={styles.descErrorText}>⚠️ {descriptionVerification.errorReason}</Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text style={styles.charCountText}>{localDescription.length}/500</Text>
          </View>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 3: WORKER COUNT & GENDER PREFERENCE STRATEGY             */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="people-outline" size={20} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Workers & Gender Preference</Text>
              <Text style={styles.sectionSubtitle}>
                Select required workers for {roleName || "work"}
              </Text>
            </View>
          </View>

          {/* Gender Selector Tabs with Role-Specific Dress Code Avatars */}
          <View style={styles.genderTabsRow}>
            <Pressable
              onPress={() => handleSelectGenderType("any")}
              style={[
                styles.genderTab,
                localGenderType === "any" && styles.genderTabActive,
              ]}
            >
              <Text style={styles.genderTabIcon}>{genderIcons.anyIcon}</Text>
              <Text
                style={[
                  styles.genderTabText,
                  localGenderType === "any" && styles.genderTabTextActive,
                ]}
              >
                Any Gender
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleSelectGenderType("male")}
              style={[
                styles.genderTab,
                localGenderType === "male" && styles.genderTabActive,
              ]}
            >
              <Text style={styles.genderTabIcon}>{genderIcons.maleIcon}</Text>
              <Text
                style={[
                  styles.genderTabText,
                  localGenderType === "male" && styles.genderTabTextActive,
                ]}
              >
                Men Only
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleSelectGenderType("female")}
              style={[
                styles.genderTab,
                localGenderType === "female" && styles.genderTabActive,
              ]}
            >
              <Text style={styles.genderTabIcon}>{genderIcons.femaleIcon}</Text>
              <Text
                style={[
                  styles.genderTabText,
                  localGenderType === "female" && styles.genderTabTextActive,
                ]}
              >
                Women Only
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleSelectGenderType("custom")}
              style={[
                styles.genderTab,
                localGenderType === "custom" && styles.genderTabActive,
              ]}
            >
              <Text style={styles.genderTabIcon}>{genderIcons.customIcon}</Text>
              <Text
                style={[
                  styles.genderTabText,
                  localGenderType === "custom" && styles.genderTabTextActive,
                ]}
              >
                Custom Mix
              </Text>
            </Pressable>
          </View>

          {/* Worker Counter UI: Single Stepper for Any / Men Only / Women Only */}
          {localGenderType !== "custom" ? (
            <View style={styles.counterSection}>
              <View style={styles.stepperContainer}>
                <Pressable
                  onPress={() => setLocalWorkers(Math.max(1, localWorkers - 1))}
                  style={[
                    styles.stepperBtn,
                    localWorkers <= 1 && styles.stepperBtnDisabled,
                  ]}
                  disabled={localWorkers <= 1}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>

                <View style={styles.stepperValue}>
                  <Text style={styles.stepperValueText}>{localWorkers}</Text>
                  <Text style={styles.stepperValueLabel}>
                    {localGenderType === "male"
                      ? localWorkers === 1
                        ? `Male ${roleName || "Worker"}`
                        : `Male ${roleName || "Workers"}`
                      : localGenderType === "female"
                      ? localWorkers === 1
                        ? `Female ${roleName || "Worker"}`
                        : `Female ${roleName || "Workers"}`
                      : localWorkers === 1
                      ? "Worker (Any)"
                      : "Workers (Any)"}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setLocalWorkers(Math.min(50, localWorkers + 1))}
                  style={[
                    styles.stepperBtn,
                    localWorkers >= 50 && styles.stepperBtnDisabled,
                  ]}
                  disabled={localWorkers >= 50}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>

              <Text style={styles.genderCaptionText}>
                {localGenderType === "male"
                  ? `✓ Only male ${roleName || "workers"} will receive job alerts`
                  : localGenderType === "female"
                  ? `✓ Only female ${roleName || "workers"} will receive job alerts`
                  : `✓ ${roleName || "Workers"} of any gender can accept this job`}
              </Text>
            </View>
          ) : (
            /* Custom Split Stepper: Men count + Women count with Role-Specific Dress Code Avatars */
            <View style={styles.splitCounterContainer}>
              <View style={styles.splitCard}>
                <View style={styles.splitCardHeader}>
                  <Text style={styles.splitIcon}>{genderIcons.maleIcon}</Text>
                  <Text style={styles.splitTitle}>Men ({roleName || "Worker"})</Text>
                </View>

                <View style={styles.miniStepperRow}>
                  <Pressable
                    onPress={() => setLocalMaleWorkers(Math.max(0, localMaleWorkers - 1))}
                    style={[
                      styles.miniStepperBtn,
                      localMaleWorkers <= 0 && styles.miniStepperBtnDisabled,
                    ]}
                    disabled={localMaleWorkers <= 0}
                  >
                    <Text style={styles.miniStepperBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.miniStepperCount}>{localMaleWorkers}</Text>
                  <Pressable
                    onPress={() => setLocalMaleWorkers(Math.min(25, localMaleWorkers + 1))}
                    style={[
                      styles.miniStepperBtn,
                      localMaleWorkers >= 25 && styles.miniStepperBtnDisabled,
                    ]}
                    disabled={localMaleWorkers >= 25}
                  >
                    <Text style={styles.miniStepperBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.splitCard}>
                <View style={styles.splitCardHeader}>
                  <Text style={styles.splitIcon}>{genderIcons.femaleIcon}</Text>
                  <Text style={styles.splitTitle}>Women ({roleName || "Worker"})</Text>
                </View>

                <View style={styles.miniStepperRow}>
                  <Pressable
                    onPress={() => setLocalFemaleWorkers(Math.max(0, localFemaleWorkers - 1))}
                    style={[
                      styles.miniStepperBtn,
                      localFemaleWorkers <= 0 && styles.miniStepperBtnDisabled,
                    ]}
                    disabled={localFemaleWorkers <= 0}
                  >
                    <Text style={styles.miniStepperBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.miniStepperCount}>{localFemaleWorkers}</Text>
                  <Pressable
                    onPress={() => setLocalFemaleWorkers(Math.min(25, localFemaleWorkers + 1))}
                    style={[
                      styles.miniStepperBtn,
                      localFemaleWorkers >= 25 && styles.miniStepperBtnDisabled,
                    ]}
                    disabled={localFemaleWorkers >= 25}
                  >
                    <Text style={styles.miniStepperBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Live Total Badge for Custom Split */}
          {localGenderType === "custom" && (
            <View style={styles.totalPill}>
              <Ionicons name="checkmark-circle" size={18} color={colors.green} />
              <Text style={styles.totalPillText}>
                Total: <Text style={styles.totalPillBold}>{computedTotalWorkers} Workers</Text> (
                {localMaleWorkers} Men + {localFemaleWorkers} Women)
              </Text>
            </View>
          )}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* SECTION 4: MULTI-SELECT ROLE & CATEGORY-BASED EXPERIENCE LEVELS  */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="ribbon-outline" size={20} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Experience Level</Text>
              <Text style={styles.sectionSubtitle}>
                Select one or more acceptable levels for {roleName || "selected role"}
              </Text>
            </View>
          </View>

          <View style={styles.dynamicExpList}>
            {dynamicExperienceOptions.map((opt) => {
              const isSelected = localExperiences.includes(opt.value);
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => handleToggleExperience(opt.value)}
                  style={[
                    styles.dynamicExpCard,
                    isSelected && styles.dynamicExpCardActive,
                  ]}
                >
                  <View
                    style={[
                      styles.dynamicExpIconContainer,
                      isSelected && styles.dynamicExpIconContainerActive,
                    ]}
                  >
                    <Text style={styles.dynamicExpEmoji}>{opt.icon}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.dynamicExpBadgeRow}>
                      <Text
                        style={[
                          styles.dynamicExpLabel,
                          isSelected && styles.dynamicExpLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <View
                        style={[
                          styles.dynamicExpBadge,
                          isSelected && styles.dynamicExpBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dynamicExpBadgeText,
                            isSelected && styles.dynamicExpBadgeTextActive,
                          ]}
                        >
                          {opt.badge}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.dynamicExpSubtext}>{opt.subtext}</Text>
                  </View>

                  {/* Checkbox Icon for Multi-Select */}
                  <View
                    style={[
                      styles.dynamicExpCheckbox,
                      isSelected && styles.dynamicExpCheckboxActive,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color={colors.white} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* LIVE SUMMARY CARD                                                */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryIconCircle}>
              <Ionicons name="checkmark-done-circle" size={24} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryCardTitle}>
                {titleVerification.isValid ? localTitle : `${roleName || "Worker"} needed`}
              </Text>
              {localDescription.trim().length > 0 && descriptionVerification.isValid && (
                <Text style={styles.summaryDescPreview} numberOfLines={2}>
                  "{localDescription.trim()}"
                </Text>
              )}
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryPillsRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillEmoji}>
                {localGenderType === "male"
                  ? genderIcons.maleIcon
                  : localGenderType === "female"
                  ? genderIcons.femaleIcon
                  : localGenderType === "custom"
                  ? genderIcons.customIcon
                  : genderIcons.anyIcon}
              </Text>
              <Text style={styles.summaryPillText}>
                {localGenderType === "custom"
                  ? `${computedTotalWorkers} (${localMaleWorkers}M, ${localFemaleWorkers}W)`
                  : localGenderType === "male"
                  ? `${localWorkers} Men`
                  : localGenderType === "female"
                  ? `${localWorkers} Women`
                  : `${localWorkers} Any`}
              </Text>
            </View>

            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillEmoji}>🎖️</Text>
              <Text style={styles.summaryPillText}>
                {localExperiences.length > 1
                  ? `${localExperiences.length} Exp Levels`
                  : dynamicExperienceOptions.find((e) => e.value === localExperiences[0])?.label || "Any Exp"}
              </Text>
            </View>

            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillEmoji}>{exactRoleIcon}</Text>
              <Text style={styles.summaryPillText}>{roleName || "Role"}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Nav Buttons */}
      <PostWorkFooter
        onBack={() => router.back()}
        onNext={handleNext}
        nextDisabled={!isFormValid}
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
    paddingBottom: 40,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  stageTag: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.green,
    letterSpacing: 1,
    marginBottom: 4,
  },
  question: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 20,
  },

  // Section Cards
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  sectionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionIconEmoji: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 1,
  },

  // Inputs
  inputWrapper: {
    position: "relative",
    justifyContent: "center",
  },
  inputIconLeft: {
    position: "absolute",
    left: 14,
    zIndex: 1,
  },
  inputEmojiLeft: {
    fontSize: 20,
  },
  inputWithIcon: {
    backgroundColor: colors.paper,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingLeft: 46,
    paddingRight: 44,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  inputError: {
    borderColor: "#E53E3E",
    backgroundColor: "#FFF5F5",
  },
  inputSuccess: {
    borderColor: colors.green,
  },
  verifiedIconBadge: {
    position: "absolute",
    right: 14,
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF5F5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FED7D7",
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C53030",
    flex: 1,
  },

  // Quick Suggestion Cards Grid (2x2 Structure with Increased Height & Balanced Proportions)
  suggestionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginTop: 14,
    marginBottom: 8,
  },
  suggestionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionCard: {
    width: "48.5%",
    backgroundColor: colors.paper,
    borderRadius: 14,
    padding: 10,
    minHeight: 64,
    borderWidth: 1.5,
    borderColor: colors.line,
    justifyContent: "space-between",
  },
  suggestionCardActive: {
    backgroundColor: colors.greenLight,
    borderColor: colors.green,
  },
  suggestionCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  suggestionIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionIconCircleActive: {
    backgroundColor: colors.green,
  },
  suggestionIconText: {
    fontSize: 14,
  },
  suggestionTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  suggestionTagActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  suggestionTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 0.5,
  },
  suggestionTagTextActive: {
    color: colors.white,
  },
  suggestionCardText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 16,
  },
  suggestionCardTextActive: {
    color: colors.green,
  },

  // Description Box
  optionalBadge: {
    backgroundColor: colors.paper,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  optionalBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  textArea: {
    backgroundColor: colors.paper,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
    color: colors.ink,
    minHeight: 80,
    textAlignVertical: "top",
  },
  descriptionFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  descErrorText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E53E3E",
    flex: 1,
  },
  charCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.mutedLight,
  },

  // Gender Selection Tabs
  genderTabsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  genderTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  genderTabActive: {
    backgroundColor: colors.greenLight,
    borderColor: colors.green,
  },
  genderTabIcon: {
    fontSize: 20,
  },
  genderTabText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textAlign: "center",
  },
  genderTabTextActive: {
    color: colors.green,
  },

  // Counter UI
  counterSection: {
    alignItems: "center",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 6,
    alignSelf: "center",
  },
  stepperBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnDisabled: {
    backgroundColor: colors.line,
    opacity: 0.5,
  },
  stepperBtnText: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.white,
    lineHeight: 28,
  },
  stepperValue: {
    alignItems: "center",
    paddingHorizontal: 28,
  },
  stepperValueText: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.ink,
  },
  stepperValueLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 2,
  },
  genderCaptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.green,
    marginTop: 10,
    textAlign: "center",
  },

  // Custom Split Counters
  splitCounterContainer: {
    flexDirection: "row",
    gap: 10,
  },
  splitCard: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
  },
  splitCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  splitIcon: {
    fontSize: 18,
  },
  splitTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink,
  },
  miniStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  miniStepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  miniStepperBtnDisabled: {
    backgroundColor: colors.line,
    opacity: 0.5,
  },
  miniStepperBtnText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.white,
  },
  miniStepperCount: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    minWidth: 24,
    textAlign: "center",
  },
  totalPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.greenLight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 14,
  },
  totalPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  totalPillBold: {
    fontWeight: "800",
    color: colors.green,
  },

  // Dynamic Experience Cards (Multi-Select Support)
  dynamicExpList: {
    gap: 10,
  },
  dynamicExpCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    gap: 12,
  },
  dynamicExpCardActive: {
    backgroundColor: colors.greenLight,
    borderColor: colors.green,
  },
  dynamicExpIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  dynamicExpIconContainerActive: {
    backgroundColor: colors.white,
  },
  dynamicExpEmoji: {
    fontSize: 22,
  },
  dynamicExpBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  dynamicExpLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  dynamicExpLabelActive: {
    color: colors.green,
  },
  dynamicExpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dynamicExpBadgeActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  dynamicExpBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
  },
  dynamicExpBadgeTextActive: {
    color: colors.white,
  },
  dynamicExpSubtext: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
  },
  dynamicExpCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  dynamicExpCheckboxActive: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.green,
    marginTop: 8,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  summaryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
  },
  summaryDescPreview: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    fontStyle: "italic",
    marginTop: 3,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 12,
  },
  summaryPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.paper,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  summaryPillEmoji: {
    fontSize: 14,
  },
  summaryPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
  },
});

