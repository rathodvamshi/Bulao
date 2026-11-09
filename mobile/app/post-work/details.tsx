import { router, Redirect } from "expo-router";
import React, { useState, useMemo, useEffect, useRef, useImperativeHandle } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Animated,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/components/ui";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  PostWorkAnimatedContent,
  ExitModal,
  POST_WORK_TYPOGRAPHY,
} from "../../src/components/PostWorkUI";
import {
  usePostWorkStore,
  WorkMode,
} from "../../src/features/post-work/store";
import {
  SubcategoryId,
  DynamicJobAnswers,
  TEACHING_MODES,
  TUTOR_EXPERIENCES,
  SCHOOL_CLASSES,
  SCHOOL_BOARDS,
  SCHOOL_SUBJECTS,
  COLLEGE_COURSES,
  COLLEGE_BRANCHES,
  COLLEGE_SEMESTERS,
  COLLEGE_SUBJECTS,
  COMPETITIVE_EXAMS,
  EXAM_SUBJECT_FOCUS,
  TARGET_YEARS,
  PREPARATION_LEVELS,
  IT_COURSES,
  IT_SKILL_LEVELS,
  IT_LEARNING_GOALS,
  VOCATIONAL_SKILLS,
  VOCATIONAL_OBJECTIVES,
  VOCATIONAL_EXPERIENCE,
  CREATIVE_LANGUAGES,
  CREATIVE_PROFICIENCY,
  CREATIVE_GOALS,
  validateSubcategoryAnswers,
  generateDynamicJobTitle,
  generateDynamicJobDescription,
} from "../../src/features/post-work/dynamicCategories";

// ────────────────────────────────────────────────────────────
// REUSABLE VISUAL CARD CONTAINER
// ────────────────────────────────────────────────────────────
interface SectionCardProps {
  stepNumber?: number;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  required?: boolean;
  count?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: React.ReactNode;
}

function SectionCard({
  stepNumber,
  icon,
  title,
  subtitle,
  required,
  count,
  onLayout,
  children,
}: SectionCardProps) {
  return (
    <View style={cardStyles.card} onLayout={onLayout}>
      <View style={cardStyles.headerRow}>
        <View style={cardStyles.iconWrap}>
          <Ionicons name={icon} size={18} color="#03402D" />
        </View>
        <View style={cardStyles.headerTextWrap}>
          <View style={cardStyles.titleRow}>
            {stepNumber !== undefined && (
              <Text style={cardStyles.stepPrefix}>{stepNumber}. </Text>
            )}
            <Text style={cardStyles.title}>{title}</Text>
            {count !== undefined && count > 0 ? (
              <View style={cardStyles.countPill}>
                <Text style={cardStyles.countPillText}>{count} selected</Text>
              </View>
            ) : required ? (
              <View style={cardStyles.requiredPill}>
                <Text style={cardStyles.requiredPillText}>Required</Text>
              </View>
            ) : (
              <View style={cardStyles.optionalPill}>
                <Text style={cardStyles.optionalPillText}>Optional</Text>
              </View>
            )}
          </View>
          {subtitle ? <Text style={cardStyles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={cardStyles.content}>{children}</View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// REUSABLE SINGLE-SELECT WRAPPING CHIPS (NO DROPDOWN, NO SCROLL)
// ────────────────────────────────────────────────────────────
interface SingleSelectChipsProps {
  options: readonly string[] | string[];
  value?: string;
  onSelect: (val: string) => void;
  customValue?: string;
  onCustomChange?: (val: string) => void;
  customPlaceholder?: string;
}

function SingleSelectChips({
  options,
  value,
  onSelect,
  customValue,
  onCustomChange,
  customPlaceholder,
}: SingleSelectChipsProps) {
  return (
    <View style={chipStyles.container}>
      <View style={chipStyles.wrapRow}>
        {options.map((opt) => {
          const isSelected = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onSelect(isSelected ? "" : opt)}
              style={[chipStyles.chip, isSelected && chipStyles.chipActive]}
            >
              {isSelected && (
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color="#FFFFFF"
                  style={chipStyles.chipIcon}
                />
              )}
              <Text
                style={[
                  chipStyles.chipText,
                  isSelected && chipStyles.chipTextActive,
                ]}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Inline custom input when "Other" is chosen */}
      {value === "Other" && (
        <View style={chipStyles.customInputBox}>
          <Ionicons name="create-outline" size={16} color="#03402D" />
          <TextInput
            value={customValue || ""}
            onChangeText={onCustomChange}
            placeholder={customPlaceholder || "Specify detail..."}
            placeholderTextColor="#94A3B8"
            style={chipStyles.customTextInput}
          />
        </View>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// REUSABLE MULTI-SELECT WRAPPING CHIPS (NO DROPDOWN, NO SCROLL)
// ────────────────────────────────────────────────────────────
interface MultiSelectChipsProps {
  options: readonly string[] | string[];
  selected: string[];
  onToggle: (val: string) => void;
  layout?: "chips" | "grid";
  customValue?: string;
  onCustomChange?: (val: string) => void;
  customPlaceholder?: string;
}

function MultiSelectChips({
  options,
  selected,
  onToggle,
  layout = "chips",
  customValue,
  onCustomChange,
  customPlaceholder,
}: MultiSelectChipsProps) {
  return (
    <View style={chipStyles.container}>
      <View style={layout === "grid" ? chipStyles.multiGrid : chipStyles.wrapRow}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => onToggle(opt)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              style={[
                chipStyles.multiChip,
                layout === "grid" && chipStyles.multiChipGrid,
                isSelected && chipStyles.multiChipActive,
              ]}
            >
              <View
                style={[
                  chipStyles.checkboxDot,
                  isSelected && chipStyles.checkboxDotActive,
                ]}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                )}
              </View>
              <Text
                style={[
                  chipStyles.multiChipText,
                  layout === "grid" && chipStyles.multiChipTextGrid,
                  isSelected && chipStyles.multiChipTextActive,
                ]}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Inline custom input when "Other" is chosen */}
      {selected.includes("Other") && (
        <View style={chipStyles.customInputBox}>
          <Ionicons name="create-outline" size={16} color="#03402D" />
          <TextInput
            value={customValue || ""}
            onChangeText={onCustomChange}
            placeholder={customPlaceholder || "Specify other subject or topic..."}
            placeholderTextColor="#94A3B8"
            style={chipStyles.customTextInput}
          />
        </View>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// COMPACT NESTED FLEX GRIDS FOR SCHOOL CLASSES (AUTO-ADJUSTING)
// ────────────────────────────────────────────────────────────
interface SchoolClassGridProps {
  selected: string[];
  onToggle: (cls: string) => void;
}

const CLASS_TIERS = [
  {
    tierName: "Pre-Primary",
    badge: "Play & KG",
    items: [
      { id: "Nursery", label: "Nursery" },
      { id: "LKG", label: "LKG" },
      { id: "UKG", label: "UKG" },
    ],
  },
  {
    tierName: "Primary School",
    badge: "Classes 1 – 5",
    items: [
      { id: "Class 1", label: "1st" },
      { id: "Class 2", label: "2nd" },
      { id: "Class 3", label: "3rd" },
      { id: "Class 4", label: "4th" },
      { id: "Class 5", label: "5th" },
    ],
  },
  {
    tierName: "Middle School",
    badge: "Classes 6 – 8",
    items: [
      { id: "Class 6", label: "6th" },
      { id: "Class 7", label: "7th" },
      { id: "Class 8", label: "8th" },
    ],
  },
  {
    tierName: "Secondary School",
    badge: "Classes 9 – 10",
    items: [
      { id: "Class 9", label: "9th Class" },
      { id: "Class 10", label: "10th / SSC" },
    ],
  },
  {
    tierName: "Higher Secondary / Inter",
    badge: "Classes 11 – 12",
    items: [
      { id: "Class 11 / Inter 1st Year", label: "11th / Inter 1st Yr" },
      { id: "Class 12 / Inter 2nd Year", label: "12th / Inter 2nd Yr" },
    ],
  },
];

function SchoolClassGrid({ selected, onToggle }: SchoolClassGridProps) {
  return (
    <View style={classGridStyles.container}>
      {CLASS_TIERS.map((tier) => (
        <View key={tier.tierName} style={classGridStyles.tierBlock}>
          <View style={classGridStyles.tierHeader}>
            <Text style={classGridStyles.tierTitle}>{tier.tierName}</Text>
            <View style={classGridStyles.tierBadge}>
              <Text style={classGridStyles.tierBadgeText}>{tier.badge}</Text>
            </View>
          </View>
          <View style={classGridStyles.tierRow}>
            {tier.items.map((item) => {
              const isSelected = selected.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onToggle(item.id)}
                  style={[
                    classGridStyles.tile,
                    isSelected && classGridStyles.tileActive,
                  ]}
                >
                  <Text
                    style={[
                      classGridStyles.tileText,
                      isSelected && classGridStyles.tileTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {isSelected && (
                    <View style={classGridStyles.activeBadge}>
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// 2x2 TEACHING MODE CARDS (NO DROPDOWN, NO SCROLL)
// ────────────────────────────────────────────────────────────
interface TeachingModeGridProps {
  value?: "home" | "center" | "online" | "hybrid";
  onSelect: (val: "home" | "center" | "online" | "hybrid") => void;
}

function TeachingModeGrid({ value, onSelect }: TeachingModeGridProps) {
  const modeSubtitles: Record<string, string> = {
    home: "Tutor visits student",
    center: "Learner visits tutor",
    online: "Live video classes",
    hybrid: "Online & offline mix",
  };

  return (
    <View style={modeGridStyles.grid}>
      {TEACHING_MODES.map((mode) => {
        const isSelected = value === mode.id;
        return (
          <Pressable
            key={mode.id}
            onPress={() => onSelect(mode.id)}
            style={[
              modeGridStyles.card,
              isSelected && modeGridStyles.cardActive,
            ]}
          >
            <View
              style={[
                modeGridStyles.iconBox,
                isSelected && modeGridStyles.iconBoxActive,
              ]}
            >
              <Ionicons
                name={mode.icon}
                size={22}
                color={isSelected ? "#03402D" : "#475569"}
              />
            </View>
            <View style={modeGridStyles.textWrap}>
              <Text
                style={[
                  modeGridStyles.title,
                  isSelected && modeGridStyles.titleActive,
                ]}
                numberOfLines={1}
              >
                {mode.label}
              </Text>
              <Text
                style={[
                  modeGridStyles.subtitle,
                  isSelected && modeGridStyles.subtitleActive,
                ]}
                numberOfLines={1}
              >
                {modeSubtitles[mode.id] || "Flexible"}
              </Text>
            </View>
            <View
              style={[
                modeGridStyles.radioCircle,
                isSelected && modeGridStyles.radioCircleActive,
              ]}
            >
              {isSelected && (
                <View style={modeGridStyles.radioInner} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
type MissingDetail = { label: string; target: string };

function getMissingRequiredDetails(subcategoryId: SubcategoryId, answers: DynamicJobAnswers): MissingDetail[] {
  switch (subcategoryId) {
    case "school-tuition": {
      const missing: MissingDetail[] = [];
      if (!answers.schoolClasses?.length) missing.push({ label: "Class / Grade", target: "schoolClasses" });
      if (!answers.schoolSubjects?.length) missing.push({ label: "Subject(s)", target: "schoolSubjects" });
      else if (answers.schoolSubjects.includes("Other") && !answers.customSchoolSubject?.trim()) missing.push({ label: "Custom subject", target: "schoolSubjects" });
      return missing;
    }
    case "college-tuition": {
      const missing: MissingDetail[] = [];
      if (!answers.collegeCourse || (answers.collegeCourse === "Other" && !answers.customCollegeCourse?.trim())) missing.push({ label: "Course / Degree", target: "collegeCourse" });
      if (!answers.collegeSubjects?.length) missing.push({ label: "Subject(s)", target: "collegeSubjects" });
      else if (answers.collegeSubjects.includes("Other") && !answers.customCollegeSubject?.trim()) missing.push({ label: "Custom subject", target: "collegeSubjects" });
      return missing;
    }
    case "competitive-exams":
      if (!answers.examName || (answers.examName === "Other" && !answers.customExamName?.trim())) return [{ label: "Target Examination", target: "examName" }];
      return [];
    case "computer-it-courses":
      if (!answers.itCourse || (answers.itCourse === "Other" && !answers.customItCourse?.trim())) return [{ label: "Course / Technology", target: "itCourse" }];
      return [];
    case "vocational-skills":
      if (!answers.vocationalSkill || (answers.vocationalSkill === "Other" && !answers.customVocationalSkill?.trim())) return [{ label: "Skill or Course", target: "vocationalSkill" }];
      return [];
    case "languages-creative":
      if (!answers.creativeSkill || (answers.creativeSkill === "Other" && !answers.customCreativeSkill?.trim())) return [{ label: "Language or Creative Skill", target: "creativeSkill" }];
      return [];
    default:
      return [];
  }
}

// ────────────────────────────────────────────────────────────
// MAIN STAGE 3 SCREEN (SIMPLE, CLEAR, NO DROPDOWNS, NO SCROLL)
// ────────────────────────────────────────────────────────────
export interface PostWorkDetailsHandle {
  validateAndSave: () => boolean;
}

export interface PostWorkDetailsProps {
  embedded?: boolean;
}

export const PostWorkDetailsScreen = React.forwardRef<PostWorkDetailsHandle, PostWorkDetailsProps>(
  function PostWorkDetailsScreen({ embedded = false }, ref) {
  const {
    category,
    categoryName,
    role,
    roleName,
    dynamicAnswers: savedAnswers,
    workMode: storeWorkMode,
    setDynamicAnswers,
    setWorkMode,
    setLocation,
    setCategoryDetails,
    setTitle,
    resetFlow,
  } = usePostWorkStore();

  const [showExitModal, setShowExitModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showStickyPreview, setShowStickyPreview] = useState(false);
  const [stickyPreviewTop, setStickyPreviewTop] = useState(0);
  const stickyPreviewAnim = useRef(new Animated.Value(0)).current;
  const validationAnim = useRef(new Animated.Value(0)).current;
  const detailsScrollRef = useRef<ScrollView>(null);
  const formGroupTop = useRef(0);
  const sectionPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    Animated.timing(stickyPreviewAnim, {
      toValue: showStickyPreview ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [showStickyPreview, stickyPreviewAnim]);

  useEffect(() => {
    if (errorMessage) {
      validationAnim.setValue(0);
      Animated.spring(validationAnim, {
        toValue: 1,
        speed: 20,
        bounciness: 4,
        useNativeDriver: true,
      }).start();
      const dismissTimer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(dismissTimer);
    }
  }, [errorMessage, validationAnim]);

  // Active subcategory ID
  const subcatId = (role || "school-tuition") as SubcategoryId;

  // Local state for dynamic answers initialized from store
  const [answers, setAnswers] = useState<DynamicJobAnswers>(() => ({
    teachingMode: (storeWorkMode as any) || savedAnswers?.teachingMode || "home",
    additionalRequirements: savedAnswers?.additionalRequirements || "",
    tutorGender: savedAnswers?.tutorGender || "any",
    tutorCount: savedAnswers?.tutorCount || 1,
    tutorGenders: savedAnswers?.tutorGenders || (savedAnswers?.tutorGender === "both" ? ["male", "female"] : savedAnswers?.tutorGender && savedAnswers.tutorGender !== "any" ? [savedAnswers.tutorGender] : []),
    maleTutorCount: savedAnswers?.maleTutorCount || savedAnswers?.tutorCount || 1,
    femaleTutorCount: savedAnswers?.femaleTutorCount || savedAnswers?.tutorCount || 1,
    anyTutorCount: savedAnswers?.anyTutorCount || savedAnswers?.tutorCount || 1,
    tutorExperience: savedAnswers?.tutorExperience || "any",
    ...savedAnswers,
  }));
  const activeTutorGenders = answers.tutorGenders || (answers.tutorGender === "both" ? ["male", "female"] : answers.tutorGender && answers.tutorGender !== "any" ? [answers.tutorGender] : []);
  const requestedTutorCount = activeTutorGenders.length > 0
    ? (activeTutorGenders.includes("male") ? (answers.maleTutorCount || answers.tutorCount || 1) : 0) +
      (activeTutorGenders.includes("female") ? (answers.femaleTutorCount || answers.tutorCount || 1) : 0)
    : (answers.anyTutorCount || answers.tutorCount || 1);

  // Update a single answer field
  const updateField = <K extends keyof DynamicJobAnswers>(
    key: K,
    val: DynamicJobAnswers[K]
  ) => {
    setErrorMessage(null);
    setAnswers((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const selectTutorGender = (gender: "any" | "male" | "female" | "both") => {
    setErrorMessage(null);
    const tutorGenders: Array<"male" | "female"> = gender === "both" ? ["male", "female"] : gender === "any" ? [] : gender === "male" || gender === "female" ? [gender] : [];
    setAnswers((previous) => {
      const maleCount = previous.maleTutorCount || previous.tutorCount || 1;
      const femaleCount = previous.femaleTutorCount || previous.tutorCount || 1;
      return {
        ...previous,
        tutorGender: gender,
        tutorGenders,
        ...(gender === "both" && maleCount + femaleCount > 100
          ? { maleTutorCount: Math.min(maleCount, 99), femaleTutorCount: Math.min(femaleCount, 100 - Math.min(maleCount, 99)) }
          : {}),
      };
    });
  };

  const setTutorCount = (gender: "male" | "female" | "any", count: number) => {
    if (gender === "any") {
      updateField("anyTutorCount", Math.max(1, Math.min(100, count)));
      return;
    }
    const selected = answers.tutorGenders || (answers.tutorGender === "both" ? ["male", "female"] : answers.tutorGender && answers.tutorGender !== "any" ? [answers.tutorGender] : []);
    const otherGender = gender === "male" ? "female" : "male";
    const otherCount = otherGender === "male" ? answers.maleTutorCount || 1 : answers.femaleTutorCount || 1;
    const maxCount = selected.includes(otherGender) ? Math.max(1, 100 - otherCount) : 100;
    updateField(gender === "male" ? "maleTutorCount" : "femaleTutorCount", Math.max(1, Math.min(maxCount, count)));
  };

  const getTutorMaxCount = (gender: "male" | "female" | "any") => {
    if (gender === "any") return 100;
    const selected = answers.tutorGenders || (answers.tutorGender === "both" ? ["male", "female"] : answers.tutorGender && answers.tutorGender !== "any" ? [answers.tutorGender] : []);
    const otherGender = gender === "male" ? "female" : "male";
    const otherCount = otherGender === "male" ? answers.maleTutorCount || 1 : answers.femaleTutorCount || 1;
    return selected.includes(otherGender) ? Math.max(1, 100 - otherCount) : 100;
  };

  // Multi-select toggle helper
  const toggleMultiSelect = (
    key: "schoolClasses" | "schoolSubjects" | "collegeSubjects" | "examFocus",
    item: string
  ) => {
    setErrorMessage(null);
    setAnswers((prev) => {
      const current = prev[key] || [];
      const exists = current.includes(item);
      const updated = exists
        ? current.filter((x) => x !== item)
        : [...current, item];
      return {
        ...prev,
        [key]: updated,
      };
    });
  };

  // Compute live generated title and description preview
  const liveTitle = useMemo(() => {
    return generateDynamicJobTitle(category, role, answers);
  }, [category, role, answers]);
  const previewTitle = liveTitle.replace(/^wanted:\s*/i, "").trim();

  const liveDescription = useMemo(() => {
    return generateDynamicJobDescription(
      categoryName || (category === "tuition" ? "Tuition" : "Education & Training"),
      roleName || "Tuition",
      answers
    );
  }, [category, categoryName, roleName, answers]);

  // Keep parent store in sync with answers for title generation
  useEffect(() => {
    setTitle(liveTitle, "auto");
  }, [liveTitle, setTitle]);

  const validateAndSave = (): boolean => {
    const validation = validateSubcategoryAnswers(subcatId, answers);
    if (!validation.valid) {
      const missing = getMissingRequiredDetails(subcatId, answers);
      const missingLabels = missing.length > 0
        ? missing.map((item) => item.label)
        : [validation.error || "Required details"];
      setErrorMessage(`Please complete: ${missingLabels.join(", ")}`);
      const target = missing[0]?.target;
      const sectionY = target ? sectionPositions.current[target] : undefined;
      requestAnimationFrame(() => {
        detailsScrollRef.current?.scrollTo({
          y: Math.max(0, (sectionY !== undefined ? formGroupTop.current + sectionY : 0) - 12),
          animated: true,
        });
      });
      return false;
    }

    setErrorMessage(null);

    // Persist in store
    setDynamicAnswers(answers);
    const modeForFormat =
      answers.teachingMode === "hybrid"
        ? "flexible"
        : answers.teachingMode || "home";
    setWorkMode(modeForFormat as WorkMode);

    setCategoryDetails({
      educationLevel: answers.schoolClasses,
      board: answers.schoolBoard === "Other" ? answers.customSchoolBoard : answers.schoolBoard,
      subjects: answers.schoolSubjects || answers.collegeSubjects,
      customSubject: answers.customSchoolSubject || answers.customCollegeSubject,
      stream: answers.collegeBranch === "Other" ? answers.customCollegeBranch : answers.collegeBranch,
      exam: answers.examName === "Other" ? answers.customExamName : answers.examName,
      degree: answers.collegeCourse === "Other" ? answers.customCollegeCourse : answers.collegeCourse,
      teachingFormat: modeForFormat as "home" | "online" | "center" | "flexible",
      specialRequirements: answers.additionalRequirements ? [answers.additionalRequirements] : [],
    });

    setTitle(liveTitle, "auto");

    // If online class is selected, no location selection is needed
    if (answers.teachingMode === "online") {
      setLocation(
        17.3850,
        78.4867,
        "Online / Remote",
        "Online / Remote Sessions (No physical address)",
        undefined,
        "online"
      );
    }
    return true;
  };

  useImperativeHandle(ref, () => ({
    validateAndSave,
  }));

  const handleNext = () => {
    if (!validateAndSave()) return;
    if (answers.teachingMode === "online") {
      router.push("/post-work/schedule");
      return;
    }
    router.push("/post-work/location");
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    resetFlow();
    router.replace("/provider-home");
  };

  const ContainerComponent = embedded ? View : SafeAreaView;

  return (
    <ContainerComponent style={screenStyles.container} {...(!embedded ? { edges: ["top" as const] } : {})}>
      {!embedded && (
        <View
          onLayout={(event) => {
            const nextTop = event.nativeEvent.layout.height;
            setStickyPreviewTop((current) => current === nextTop ? current : nextTop);
          }}
        >
          <PostWorkHeader
            title="Job Details"
            currentStep={3}
            totalSteps={7}
            onExit={() => setShowExitModal(true)}
          />

          <StageProgressIndicator
            currentStep={3}
            onStepPress={(step) => {
              if (step <= 2) {
                router.push({
                  pathname: "/post-work",
                  params: { stage: String(step), preserveDraft: "1" },
                });
              }
            }}
          />
        </View>
      )}

      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden={!showStickyPreview}
        importantForAccessibility={showStickyPreview ? "yes" : "no-hide-descendants"}
        accessibilityLiveRegion="polite"
        style={[
          screenStyles.stickyPreview,
          {
            position: "absolute",
            top: stickyPreviewTop,
            left: 0,
            right: 0,
            zIndex: 10,
            elevation: 8,
            height: stickyPreviewAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 46] }),
            borderTopWidth: stickyPreviewAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
            borderBottomWidth: stickyPreviewAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
            transform: [{ translateY: stickyPreviewAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        <View style={screenStyles.stickyTitleAccent} />
        <Text style={screenStyles.stickyPreviewTitle} numberOfLines={1} ellipsizeMode="tail">
          {previewTitle}
        </Text>
      </Animated.View>

      {errorMessage && (
        <Animated.View
          style={[
            screenStyles.validationBanner,
            {
              opacity: validationAnim,
              transform: [{ translateY: validationAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
            },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <Ionicons name="alert-circle" size={19} color="#B42318" />
          <View style={{ flex: 1 }}>
            <Text style={screenStyles.validationTitle}>Complete these details</Text>
            <Text style={screenStyles.validationText}>{errorMessage}</Text>
          </View>
          <Pressable onPress={() => setErrorMessage(null)} hitSlop={8} accessibilityLabel="Dismiss message">
            <Ionicons name="close" size={18} color="#8B1D16" />
          </Pressable>
        </Animated.View>
      )}

      <PostWorkAnimatedContent>
      <ScrollView
        ref={detailsScrollRef}
        style={screenStyles.content}
        contentContainerStyle={screenStyles.contentContainer}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => {
          const shouldShow = event.nativeEvent.contentOffset.y > 150;
          setShowStickyPreview((visible) => visible === shouldShow ? visible : shouldShow);
        }}
      >
        {/* Compact, editable job-title suggestion */}
        <View style={screenStyles.previewBanner}>
          <View style={screenStyles.previewIconWrap}>
            <Ionicons name="sparkles" size={17} color={colors.greenDark} />
          </View>
          <View style={screenStyles.previewCopy}>
          <View style={screenStyles.previewHeader}>
              <Text style={screenStyles.previewLabel}>Suggested job title</Text>
              <Text style={screenStyles.autoGeneratedHint}>AUTO</Text>
            </View>
            <Text style={screenStyles.previewTitleText}>{previewTitle}</Text>
          </View>
        </View>

        {/* ============================================================ */}
        {/* A. SCHOOL TUITION                                            */}
        {/* ============================================================ */}
        {subcatId === "school-tuition" && (
          <View style={screenStyles.formGroup} onLayout={(event) => { formGroupTop.current = event.nativeEvent.layout.y; }}>
            {/* 1. Class / Grade */}
            <SectionCard
              stepNumber={1}
              icon="school-outline"
              title="Class / Grade"
              subtitle="Select all applicable grades (tap to select):"
              required
              count={(answers.schoolClasses || []).length}
              onLayout={(event) => { sectionPositions.current.schoolClasses = event.nativeEvent.layout.y; }}
            >
              <SchoolClassGrid
                selected={answers.schoolClasses || []}
                onToggle={(cls) => toggleMultiSelect("schoolClasses", cls)}
              />
            </SectionCard>

            {/* 2. Board / Syllabus */}
            <SectionCard
              stepNumber={2}
              icon="book-outline"
              title="Board / Syllabus"
              subtitle="Choose the school curriculum:"
            >
              <SingleSelectChips
                options={SCHOOL_BOARDS}
                value={answers.schoolBoard}
                onSelect={(val) => updateField("schoolBoard", val)}
                customValue={answers.customSchoolBoard}
                onCustomChange={(val) => updateField("customSchoolBoard", val)}
                customPlaceholder="Type board name (e.g. Cambridge, State Board)..."
              />
            </SectionCard>

            {/* 3. Subjects */}
            <SectionCard
              stepNumber={3}
              icon="library-outline"
              title="Subject(s)"
              subtitle="Select subjects you want taught (choose multiple):"
              required
              count={(answers.schoolSubjects || []).length}
              onLayout={(event) => { sectionPositions.current.schoolSubjects = event.nativeEvent.layout.y; }}
            >
              <MultiSelectChips
                options={SCHOOL_SUBJECTS}
                selected={answers.schoolSubjects || []}
                onToggle={(item) => toggleMultiSelect("schoolSubjects", item)}
                layout="grid"
                customValue={answers.customSchoolSubject}
                onCustomChange={(val) => updateField("customSchoolSubject", val)}
                customPlaceholder="Specify other subject..."
              />
            </SectionCard>
          </View>
        )}

        {/* ============================================================ */}
        {/* B. COLLEGE & UNIVERSITY TUITION                              */}
        {/* ============================================================ */}
        {subcatId === "college-tuition" && (
          <View style={screenStyles.formGroup} onLayout={(event) => { formGroupTop.current = event.nativeEvent.layout.y; }}>
            {/* 1. Degree / Course */}
            <SectionCard
              stepNumber={1}
              icon="school-outline"
              title="Course / Degree"
              subtitle="Select the learner's degree:"
              required
              onLayout={(event) => { sectionPositions.current.collegeCourse = event.nativeEvent.layout.y; }}
            >
              <SingleSelectChips
                options={COLLEGE_COURSES}
                value={answers.collegeCourse}
                onSelect={(val) => updateField("collegeCourse", val)}
                customValue={answers.customCollegeCourse}
                onCustomChange={(val) => updateField("customCollegeCourse", val)}
                customPlaceholder="Type degree name (e.g. B.Tech Mechanical, B.Sc Nursing)..."
              />
            </SectionCard>

            {/* 2. Branch / Specialization */}
            <SectionCard
              stepNumber={2}
              icon="git-branch-outline"
              title="Branch / Specialization"
              subtitle="Select branch or department:"
            >
              <SingleSelectChips
                options={COLLEGE_BRANCHES}
                value={answers.collegeBranch}
                onSelect={(val) => updateField("collegeBranch", val)}
                customValue={answers.customCollegeBranch}
                onCustomChange={(val) => updateField("customCollegeBranch", val)}
                customPlaceholder="Type branch or specialization..."
              />
            </SectionCard>

            {/* 3. Year / Semester */}
            <SectionCard
              stepNumber={3}
              icon="calendar-outline"
              title="Academic Year / Semester"
              subtitle="Select current academic year:"
            >
              <SingleSelectChips
                options={COLLEGE_SEMESTERS}
                value={answers.collegeSemester}
                onSelect={(val) => updateField("collegeSemester", val)}
              />
            </SectionCard>

            {/* 4. College Subjects */}
            <SectionCard
              stepNumber={4}
              icon="documents-outline"
              title="Subject(s)"
              subtitle="Select required college subjects (choose multiple):"
              required
              count={(answers.collegeSubjects || []).length}
              onLayout={(event) => { sectionPositions.current.collegeSubjects = event.nativeEvent.layout.y; }}
            >
              <MultiSelectChips
                options={COLLEGE_SUBJECTS}
                selected={answers.collegeSubjects || []}
                onToggle={(item) => toggleMultiSelect("collegeSubjects", item)}
                layout="grid"
                customValue={answers.customCollegeSubject}
                onCustomChange={(val) => updateField("customCollegeSubject", val)}
                customPlaceholder="Type subject name..."
              />
            </SectionCard>
          </View>
        )}

        {/* ============================================================ */}
        {/* C. COMPETITIVE EXAM COACHING                                 */}
        {/* ============================================================ */}
        {subcatId === "competitive-exams" && (
          <View style={screenStyles.formGroup} onLayout={(event) => { formGroupTop.current = event.nativeEvent.layout.y; }}>
            {/* 1. Target Exam */}
            <SectionCard
              stepNumber={1}
              icon="trophy-outline"
              title="Target Examination"
              subtitle="Select the competitive exam:"
              required
              onLayout={(event) => { sectionPositions.current.examName = event.nativeEvent.layout.y; }}
            >
              <SingleSelectChips
                options={COMPETITIVE_EXAMS}
                value={answers.examName}
                onSelect={(val) => updateField("examName", val)}
                customValue={answers.customExamName}
                onCustomChange={(val) => updateField("customExamName", val)}
                customPlaceholder="Type competitive exam name..."
              />
            </SectionCard>

            {/* 2. Preparation Focus */}
            <SectionCard
              stepNumber={2}
              icon="locate-outline"
              title="Preparation Focus"
              subtitle="Select preparation areas (choose multiple):"
              count={(answers.examFocus || []).length}
            >
              <MultiSelectChips
                options={EXAM_SUBJECT_FOCUS}
                selected={answers.examFocus || []}
                onToggle={(item) => toggleMultiSelect("examFocus", item)}
                customValue={answers.customExamFocus}
                onCustomChange={(val) => updateField("customExamFocus", val)}
                customPlaceholder="Type specific focus area..."
              />
            </SectionCard>

            {/* 3. Target Year */}
            <SectionCard
              stepNumber={3}
              icon="calendar-outline"
              title="Target Year"
              subtitle="When will you appear for the exam?"
            >
              <SingleSelectChips
                options={TARGET_YEARS}
                value={answers.targetYear}
                onSelect={(val) => updateField("targetYear", val)}
              />
            </SectionCard>

            {/* 4. Preparation Level */}
            <SectionCard
              stepNumber={4}
              icon="speedometer-outline"
              title="Current Preparation Level"
              subtitle="Where are you currently in your prep?"
            >
              <SingleSelectChips
                options={PREPARATION_LEVELS}
                value={answers.prepLevel}
                onSelect={(val) => updateField("prepLevel", val)}
              />
            </SectionCard>
          </View>
        )}

        {/* ============================================================ */}
        {/* D. COMPUTER & IT COURSES                                     */}
        {/* ============================================================ */}
        {subcatId === "computer-it-courses" && (
          <View style={screenStyles.formGroup} onLayout={(event) => { formGroupTop.current = event.nativeEvent.layout.y; }}>
            {/* 1. Technology / Course */}
            <SectionCard
              stepNumber={1}
              icon="laptop-outline"
              title="Course / Technology"
              subtitle="Select the language or tech stack to learn:"
              required
              onLayout={(event) => { sectionPositions.current.itCourse = event.nativeEvent.layout.y; }}
            >
              <SingleSelectChips
                options={IT_COURSES}
                value={answers.itCourse}
                onSelect={(val) => updateField("itCourse", val)}
                customValue={answers.customItCourse}
                onCustomChange={(val) => updateField("customItCourse", val)}
                customPlaceholder="Type technology name (e.g. Flutter, Rust)..."
              />
            </SectionCard>

            {/* 2. Current Skill Level */}
            <SectionCard
              stepNumber={2}
              icon="bar-chart-outline"
              title="Current Skill Level"
              subtitle="What is your current knowledge level?"
            >
              <SingleSelectChips
                options={IT_SKILL_LEVELS}
                value={answers.itSkillLevel}
                onSelect={(val) => updateField("itSkillLevel", val)}
              />
            </SectionCard>

            {/* 3. Learning Goal */}
            <SectionCard
              stepNumber={3}
              icon="flag-outline"
              title="Learning Goal"
              subtitle="What do you want to achieve?"
            >
              <SingleSelectChips
                options={IT_LEARNING_GOALS}
                value={answers.itLearningGoal}
                onSelect={(val) => updateField("itLearningGoal", val)}
                customValue={answers.customItLearningGoal}
                onCustomChange={(val) => updateField("customItLearningGoal", val)}
                customPlaceholder="Type your learning goal..."
              />
            </SectionCard>
          </View>
        )}

        {/* ============================================================ */}
        {/* E. PROFESSIONAL & VOCATIONAL SKILLS                          */}
        {/* ============================================================ */}
        {subcatId === "vocational-skills" && (
          <View style={screenStyles.formGroup} onLayout={(event) => { formGroupTop.current = event.nativeEvent.layout.y; }}>
            {/* 1. Skill or Course */}
            <SectionCard
              stepNumber={1}
              icon="briefcase-outline"
              title="Skill or Course"
              subtitle="Select the vocational skill:"
              required
              onLayout={(event) => { sectionPositions.current.vocationalSkill = event.nativeEvent.layout.y; }}
            >
              <SingleSelectChips
                options={VOCATIONAL_SKILLS}
                value={answers.vocationalSkill}
                onSelect={(val) => updateField("vocationalSkill", val)}
                customValue={answers.customVocationalSkill}
                onCustomChange={(val) => updateField("customVocationalSkill", val)}
                customPlaceholder="Type skill or vocation..."
              />
            </SectionCard>

            {/* 2. Learning Objective */}
            <SectionCard
              stepNumber={2}
              icon="rocket-outline"
              title="Learning Objective"
              subtitle="Why are you learning this skill?"
            >
              <SingleSelectChips
                options={VOCATIONAL_OBJECTIVES}
                value={answers.vocationalObjective}
                onSelect={(val) => updateField("vocationalObjective", val)}
              />
            </SectionCard>

            {/* 3. Experience Level */}
            <SectionCard
              stepNumber={3}
              icon="trending-up-outline"
              title="Experience Level"
              subtitle="Your previous experience with this skill:"
            >
              <SingleSelectChips
                options={VOCATIONAL_EXPERIENCE}
                value={answers.vocationalExperience}
                onSelect={(val) => updateField("vocationalExperience", val)}
              />
            </SectionCard>
          </View>
        )}

        {/* ============================================================ */}
        {/* F. LANGUAGES & CREATIVE SKILLS                               */}
        {/* ============================================================ */}
        {subcatId === "languages-creative" && (
          <View style={screenStyles.formGroup} onLayout={(event) => { formGroupTop.current = event.nativeEvent.layout.y; }}>
            {/* 1. Language or Creative Skill */}
            <SectionCard
              stepNumber={1}
              icon="color-palette-outline"
              title="Language or Creative Skill"
              subtitle="Select the language or art form:"
              required
              onLayout={(event) => { sectionPositions.current.creativeSkill = event.nativeEvent.layout.y; }}
            >
              <SingleSelectChips
                options={CREATIVE_LANGUAGES}
                value={answers.creativeSkill}
                onSelect={(val) => updateField("creativeSkill", val)}
                customValue={answers.customCreativeSkill}
                onCustomChange={(val) => updateField("customCreativeSkill", val)}
                customPlaceholder="Type language or creative skill..."
              />
            </SectionCard>

            {/* 2. Current Proficiency */}
            <SectionCard
              stepNumber={2}
              icon="chatbubble-ellipses-outline"
              title="Current Proficiency"
              subtitle="Your current speaking or skill level:"
            >
              <SingleSelectChips
                options={CREATIVE_PROFICIENCY}
                value={answers.creativeProficiency}
                onSelect={(val) => updateField("creativeProficiency", val)}
              />
            </SectionCard>

            {/* 3. Learning Goal */}
            <SectionCard
              stepNumber={3}
              icon="bulb-outline"
              title="Learning Goal"
              subtitle="What is your main reason for learning?"
            >
              <SingleSelectChips
                options={CREATIVE_GOALS}
                value={answers.creativeGoal}
                onSelect={(val) => updateField("creativeGoal", val)}
              />
            </SectionCard>
          </View>
        )}

        {/* ============================================================ */}
        {/* COMMON SECTIONS: TEACHING MODE, TIMING, PREFERENCES          */}
        {/* ============================================================ */}

        {/* Teaching Mode (Required) */}
        <SectionCard
          icon="navigate-outline"
          title="Teaching Mode"
          subtitle="Where should lessons be conducted?"
          required
        >
          <TeachingModeGrid
            value={answers.teachingMode}
            onSelect={(val) => updateField("teachingMode", val)}
          />
        </SectionCard>


        {/* Tutor Preferences (Tuition Only) */}
        {(subcatId === "school-tuition" || subcatId === "college-tuition") && (
          <SectionCard
            icon="person-outline"
            title="Tutor Preferences"
            subtitle="Choose who you need and how many"
          >
            {/* Tutor Gender */}
            <Text style={screenStyles.subLabel}>Tutor Gender</Text>
            <View style={screenStyles.genderRow}>
              {([
                { id: "any", label: "Any gender" },
                { id: "male", label: "Male" },
                { id: "female", label: "Female" },
                { id: "both", label: "Both" },
              ] as const).map((option) => {
                const isSelected = answers.tutorGender === option.id || (option.id === "both" && activeTutorGenders.length === 2);
                const iconName: keyof typeof Ionicons.glyphMap =
                  option.id === "female"
                    ? isSelected
                      ? "woman"
                      : "woman-outline"
                    : option.id === "male"
                    ? isSelected
                      ? "man"
                      : "man-outline"
                    : isSelected
                    ? "people"
                    : "people-outline";

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => selectTutorGender(option.id)}
                    style={[
                      screenStyles.genderBtn,
                      isSelected && screenStyles.genderBtnActive,
                    ]}
                  >
                    <Ionicons
                      name={iconName}
                      size={18}
                      color={isSelected ? "#FFFFFF" : "#475569"}
                      style={screenStyles.genderIcon}
                    />
                    <Text
                      style={[
                        screenStyles.genderBtnText,
                        isSelected && screenStyles.genderBtnTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 14, marginBottom: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={screenStyles.subLabel}>How many tutors are needed?</Text>
              <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "#EAF5EE" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#03402D" }}>Total: {requestedTutorCount}</Text>
              </View>
            </View>
            {((activeTutorGenders).length > 0
              ? activeTutorGenders
              : ["any" as const]).map((gender) => (
              <View key={gender} style={{ marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#DCEFE5", backgroundColor: "#F7FCF9", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[screenStyles.subLabel, { marginBottom: 0 }]}>{gender === "any" ? "Tutors needed" : `${gender === "female" ? "Female" : "Male"} tutors needed`}</Text>
                  <Text style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>{gender === "any" ? "Any gender" : "Choose the number you need"}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 4, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Reduce ${gender} tutor quantity`}
                    disabled={((gender === "male" ? answers.maleTutorCount : gender === "female" ? answers.femaleTutorCount : answers.anyTutorCount) || 1) <= 1}
                    onPress={() => setTutorCount(gender, ((gender === "male" ? answers.maleTutorCount : gender === "female" ? answers.femaleTutorCount : answers.anyTutorCount) || 1) - 1)}
                    style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", opacity: ((gender === "male" ? answers.maleTutorCount : gender === "female" ? answers.femaleTutorCount : answers.anyTutorCount) || 1) <= 1 ? 0.45 : 1 }}
                  >
                    <Ionicons name="remove" size={18} color="#03402D" />
                  </Pressable>
                  <Text style={{ minWidth: 24, textAlign: "center", fontSize: 16, fontWeight: "800", color: "#03402D" }}>{(gender === "male" ? answers.maleTutorCount : gender === "female" ? answers.femaleTutorCount : answers.anyTutorCount) || 1}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${gender} tutor quantity`}
                    disabled={((gender === "male" ? answers.maleTutorCount : gender === "female" ? answers.femaleTutorCount : answers.anyTutorCount) || 1) >= getTutorMaxCount(gender)}
                    onPress={() => setTutorCount(gender, ((gender === "male" ? answers.maleTutorCount : gender === "female" ? answers.femaleTutorCount : answers.anyTutorCount) || 1) + 1)}
                    style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#EAF5EE", alignItems: "center", justifyContent: "center", opacity: ((gender === "male" ? answers.maleTutorCount : gender === "female" ? answers.femaleTutorCount : answers.anyTutorCount) || 1) >= getTutorMaxCount(gender) ? 0.45 : 1 }}
                  >
                    <Ionicons name="add" size={18} color="#03402D" />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Minimum Experience */}
            <Text style={[screenStyles.subLabel, { marginTop: 12 }]}>
              Minimum Experience
            </Text>
            <View style={chipStyles.wrapRow}>
              {TUTOR_EXPERIENCES.map((exp) => {
                const isSelected = answers.tutorExperience === exp.id;
                return (
                  <Pressable
                    key={exp.id}
                    onPress={() => updateField("tutorExperience", exp.id)}
                    style={[
                      chipStyles.chip,
                      isSelected && chipStyles.chipActive,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#FFFFFF"
                        style={chipStyles.chipIcon}
                      />
                    )}
                    <Text
                      style={[
                        chipStyles.chipText,
                        isSelected && chipStyles.chipTextActive,
                      ]}
                    >
                      {exp.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>
        )}

        {/* Special Instructions / Notes */}
        <SectionCard
          icon="create-outline"
          title="Special Instructions"
          subtitle="Any specific requirements or syllabus topics (optional):"
        >
          <TextInput
            value={answers.additionalRequirements || ""}
            onChangeText={(text) => updateField("additionalRequirements", text)}
            placeholder="e.g. Focus on Organic Chemistry, need 3 classes a week..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            style={screenStyles.textArea}
          />
        </SectionCard>

        <View style={{ height: 32 }} />
      </ScrollView>
      </PostWorkAnimatedContent>

      {!embedded && (
        <>
          {/* Persistent Bottom Action Footer */}
          <PostWorkFooter
            onBack={() => router.back()}
            onNext={handleNext}
            nextLabel="Next"
          />

          {/* Exit Modal */}
          <ExitModal
            visible={showExitModal}
            onClose={() => setShowExitModal(false)}
            onExit={handleConfirmExit}
          />
        </>
      )}
    </ContainerComponent>
  );
});

export default function PostWorkDetailsRoute() {
  return <Redirect href={{ pathname: "/post-work", params: { stage: "3" } }} />;
}

// ────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  headerBlock: {
    marginBottom: 12,
  },
  stageTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#03402D",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  questionTitle: {
    fontSize: POST_WORK_TYPOGRAPHY.screenHeading,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#03402D",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#03402D",
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 14,
  },
  previewIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.greenLight,
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  stickyPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    overflow: "hidden",
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  stickyTitleAccent: {
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: colors.lime,
  },
  stickyPreviewTitle: {
    flex: 1,
    width: "100%",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: -0.1,
    textAlign: "left",
  },
  validationBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECDC9",
    backgroundColor: "#FFF5F4",
  },
  validationTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#912018",
    marginBottom: 2,
  },
  validationText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    color: "#7A271A",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.greenLight,
  },
  autoGeneratedHint: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: colors.greenDark,
    flexShrink: 1,
    textAlign: "right",
    backgroundColor: colors.greenLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  previewTitleText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.white,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
    flex: 1,
  },
  formGroup: {
    gap: 0,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  genderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genderBtn: {
    width: "48%",
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
  },
  genderIcon: {
    marginTop: 0,
  },
  genderBtnActive: {
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  genderBtnTextActive: {
    color: "#FFFFFF",
  },
  textArea: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
    textAlignVertical: "top",
    minHeight: 68,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  headerTextWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    gap: 5,
  },
  stepPrefix: {
    fontSize: 15,
    fontWeight: "800",
    color: "#03402D",
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
    flex: 1,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  requiredPill: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: "auto",
    marginTop: 1,
  },
  requiredPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#DC2626",
    textTransform: "uppercase",
  },
  optionalPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optionalPillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },
  countPill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#03402D",
  },
  content: {
    paddingTop: 2,
  },
});

const chipStyles = StyleSheet.create({
  container: {
    width: "100%",
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  multiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    columnGap: 7,
    rowGap: 7,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chipActive: {
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  chipIcon: {
    marginRight: 5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  multiChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
  },
  multiChipGrid: {
    width: "31.5%",
    minHeight: 40,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 9,
    gap: 5,
  },
  multiChipActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#059669",
  },
  checkboxDot: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxDotActive: {
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  multiChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
  },
  multiChipTextGrid: {
    flex: 1,
    flexShrink: 1,
    fontSize: 11.5,
    lineHeight: 14,
    flexWrap: "wrap",
  },
  multiChipTextActive: {
    color: "#03402D",
    fontWeight: "700",
  },
  customInputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1.2,
    borderColor: "#86EFAC",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 10,
    gap: 8,
  },
  customTextInput: {
    flex: 1,
    height: 38,
    fontSize: 13,
    color: "#0F172A",
  },
});

const classGridStyles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 8,
  },
  tierBlock: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 8,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  tierTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tierBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tierBadgeText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#64748B",
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  tile: {
    flex: 1,
    height: 38,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingHorizontal: 2,
  },
  tileActive: {
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  tileText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  tileTextActive: {
    color: "#FFFFFF",
  },
  activeBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
});

const modeGridStyles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  card: {
    width: "48.5%", // 2 columns
    backgroundColor: "#F8FAFC",
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    position: "relative",
  },
  cardActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#059669",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconBoxActive: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
  },
  textWrap: {
    paddingRight: 16,
  },
  title: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 2,
  },
  titleActive: {
    color: "#03402D",
  },
  subtitle: {
    fontSize: 10.5,
    fontWeight: "500",
    color: "#64748B",
  },
  subtitleActive: {
    color: "#059669",
  },
  radioCircle: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: {
    borderColor: "#03402D",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#03402D",
  },
});
