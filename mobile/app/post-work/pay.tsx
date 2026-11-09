import { router, Redirect } from "expo-router";
import React, { useState, useRef, useImperativeHandle, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/components/ui";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  ExitModal,
  PostWorkAnimatedContent,
  POST_WORK_TYPOGRAPHY,
} from "../../src/components/PostWorkUI";
import {
  usePostWorkStore,
  PayUnit,
  PayWhen,
  PayMode,
  PayBasis,
  PaymentFrequency,
} from "../../src/features/post-work/store";

// Helper: Format raw number with Indian numbering commas (e.g. 1,000, 10,000, 1,00,000)
function formatIndianCommas(val: string): string {
  const digits = val.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("en-IN");
}

// Helper: Convert number to readable words (Thousand, Ten Thousand, Lakhs)
function numberToReadableWords(val: string): string {
  const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
  if (isNaN(num) || num <= 0) return "";
  if (num < 100) return `${num} Rupees`;

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] || "";
    const t = tens[Math.floor(n / 10)] || "";
    const o = ones[n % 10] || "";
    return o ? `${t} ${o}` : t;
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let s = "";
    if (h > 0) s += `${ones[h]} Hundred`;
    if (rem > 0) {
      if (s) s += " ";
      s += convertTwoDigits(rem);
    }
    return s;
  }

  const crores = Math.floor(num / 10000000);
  const lakhs = Math.floor((num % 10000000) / 100000);
  const thousands = Math.floor((num % 100000) / 1000);
  const hundreds = num % 1000;

  const parts: string[] = [];
  if (crores > 0) parts.push(`${convertTwoDigits(crores)} Crore`);
  if (lakhs > 0) parts.push(`${convertTwoDigits(lakhs)} Lakh`);
  if (thousands > 0) parts.push(`${convertTwoDigits(thousands)} Thousand`);
  if (hundreds > 0) parts.push(convertThreeDigits(hundreds));

  return `${parts.join(" ")} Rupees`;
}

interface PerkItem {
  id: string;
  label: string;
  sub: string;
  icon: string;
}

export interface PostWorkPayHandle {
  validateAndSave: () => boolean;
}

export interface PostWorkPayProps {
  embedded?: boolean;
}

export const PostWorkPayScreen = React.forwardRef<PostWorkPayHandle, PostWorkPayProps>(
  function PostWorkPayScreen({ embedded = false }, ref) {
  const scrollViewRef = useRef<ScrollView>(null);
  const focusedAmountInputHandle = useRef<number | null>(null);

  useEffect(() => {
    const keyboardEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const subscription = Keyboard.addListener(keyboardEvent, () => {
      const inputHandle = focusedAmountInputHandle.current;
      if (inputHandle === null) return;

      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
          inputHandle,
          160,
          true,
        );
      });
    });

    return () => subscription.remove();
  }, []);

  const {
    payAmount: storeAmount,
    payUnit: storeUnit,
    payWhen: storeWhen,
    payMode: storePayMode,
    payBasis: storePayBasis,
    paymentFrequency: storePaymentFreq,
    demoFeeTerms: storeDemoFeeTerms,
    extras: storeExtras,
    category,
    categoryName,
    roleName,
    setPay,
    setAdaptivePay,
    resetFlow,
  } = usePostWorkStore();

  const isEducation =
    (category || "").toLowerCase().includes("edu") ||
    (categoryName || "").toLowerCase().includes("edu") ||
    (roleName || "").toLowerCase().includes("tutor") ||
    (roleName || "").toLowerCase().includes("teach");

  // Payment Arrangement: "fixed" | "negotiable" | "discuss" | ("demo_first" for tutors)
  const [localPayMode, setLocalPayMode] = useState<PayMode>(
    storePayMode || "fixed"
  );

  // Unified Payment Calculation & Timing Model
  const [selectedPayPlan, setSelectedPayPlan] = useState<string>(() => {
    if (storePayBasis === "week" || storePaymentFreq === "weekly") return "weekly";
    if (storePayBasis === "month" || storePaymentFreq === "monthly") return "monthly";
    if (storePayBasis === "task" || storePaymentFreq === "completion") return "completion";
    if (storePayBasis === "hour") return "hour";
    if (storePayBasis === "session") return "session";
    return isEducation ? "monthly" : "day";
  });

  // Pay Amount (String, digits only - NO suggestions)
  const [localAmount, setLocalAmount] = useState<string>(storeAmount || "");

  // Demo / Trial Terms
  const [localDemoTerms, setLocalDemoTerms] = useState<string>(
    storeDemoFeeTerms || "Free Demo Class"
  );

  // Optional Perks / Allowances
  const [localExtras, setLocalExtras] = useState<string[]>(storeExtras || []);
  const [showExitModal, setShowExitModal] = useState(false);

  // Payment Calculation Options
  const paymentPlanOptions = [
    {
      id: "day",
      label: "Pay Per Day",
      payoutTag: "Same Day",
      desc: "Paid daily at the end of each work day",
      basis: "day" as PayBasis,
      freq: "daily" as PaymentFrequency,
      unit: "day" as PayUnit,
      when: "daily" as PayWhen,
      suffix: "/ day",
    },
    {
      id: "weekly",
      label: "Weekly",
      payoutTag: "Every Week",
      desc: "Cumulative payment settled each weekend",
      basis: "week" as PayBasis,
      freq: "weekly" as PaymentFrequency,
      unit: "job" as PayUnit,
      when: "weekly" as PayWhen,
      suffix: "/ week",
    },
    {
      id: "monthly",
      label: "Monthly",
      payoutTag: "Month End",
      desc: "Regular monthly salary or retainer",
      basis: "month" as PayBasis,
      freq: "monthly" as PaymentFrequency,
      unit: "month" as PayUnit,
      when: "monthly" as PayWhen,
      suffix: "/ month",
    },
    {
      id: "completion",
      label: "On Completion",
      payoutTag: "When Done",
      desc: "Full payment released once work is delivered",
      basis: "task" as PayBasis,
      freq: "completion" as PaymentFrequency,
      unit: "job" as PayUnit,
      when: "after" as PayWhen,
      suffix: "total",
    },
    {
      id: isEducation ? "session" : "hour",
      label: isEducation ? "Per Class" : "Per Hour",
      payoutTag: isEducation ? "Per Session" : "Hourly",
      desc: isEducation ? "Paid per individual class session" : "Paid based on tracked hours worked",
      basis: (isEducation ? "session" : "hour") as PayBasis,
      freq: "daily" as PaymentFrequency,
      unit: (isEducation ? "job" : "hour") as PayUnit,
      when: "daily" as PayWhen,
      suffix: isEducation ? "/ class" : "/ hour",
    },
  ];

  const activePlan =
    paymentPlanOptions.find((p) => p.id === selectedPayPlan) || paymentPlanOptions[0]!;
  const paymentPlanGridOptions = [...paymentPlanOptions].sort((a, b) => {
    const order = [isEducation ? "session" : "hour", "day", "weekly", "monthly", "completion"];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });
  const paymentPeriodLabel = (planId: string) => {
    if (planId === "completion") return "/task";
    if (planId === "hour") return "/hour";
    if (planId === "session") return "/class";
    if (planId === "day") return "/day";
    if (planId === "weekly") return "/week";
    return "/month";
  };

  // Well-Structured Optional Perks (Clean 2-Column Grid)
  const structuredPerks: PerkItem[] = isEducation
    ? [
        {
          id: "travel",
          label: "Travel Allowance",
          sub: "Transport fare covered",
          icon: "car-outline",
        },
        {
          id: "refreshments",
          label: "Refreshments",
          sub: "Beverages & snacks provided",
          icon: "cafe-outline",
        },
        {
          id: "flexible",
          label: "Flexible Timings",
          sub: "Adjustable session hours",
          icon: "time-outline",
        },
        {
          id: "wifi",
          label: "WiFi Access",
          sub: "High-speed internet provided",
          icon: "wifi-outline",
        },
      ]
    : [
        {
          id: "meals",
          label: "Meals Provided",
          sub: "Daily lunch or food included",
          icon: "restaurant-outline",
        },
        {
          id: "travel",
          label: "Travel Allowance",
          sub: "Transport reimbursement",
          icon: "car-outline",
        },
        {
          id: "accommodation",
          label: "Accommodation",
          sub: "Stay or room provided",
          icon: "home-outline",
        },
        {
          id: "bonus",
          label: "Completion Bonus",
          sub: "Extra incentive on delivery",
          icon: "gift-outline",
        },
      ];

  // Toggle Perk by Label
  const togglePerk = (label: string) => {
    setLocalExtras((prev) =>
      prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label]
    );
  };

  const handleAmountChange = (text: string) => {
    const rawDigits = text.replace(/[^0-9]/g, "");
    setLocalAmount(rawDigits);
  };

  const validateAndSave = (): boolean => {
    const isAmountRequired = localPayMode === "fixed" || localPayMode === "negotiable";

    if (isAmountRequired && (!localAmount || parseFloat(localAmount) <= 0)) {
      Alert.alert(
        "Enter Pay Amount",
        localPayMode === "fixed"
          ? "Please enter your fixed pay rate, or choose 'Discuss Directly'."
          : "Please enter your target budget amount."
      );
      return false;
    }

    const amountVal = isAmountRequired
      ? localAmount
      : localAmount && parseFloat(localAmount) > 0
      ? localAmount
      : "0";

    setAdaptivePay({
      payAmount: amountVal,
      payMode: localPayMode,
      payBasis: activePlan.basis,
      paymentFrequency: activePlan.freq,
      demoFeeTerms: localPayMode === "demo_first" ? localDemoTerms : "",
      extras: localExtras,
      benefits: localExtras,
    });

    setPay(amountVal, activePlan.unit, activePlan.when, localExtras, localExtras, null, "");
    return true;
  };

  useImperativeHandle(ref, () => ({
    validateAndSave,
  }));

  const handleNext = () => {
    if (!validateAndSave()) return;
    router.push("/post-work/review");
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    resetFlow();
    router.replace("/provider-home");
  };

  const wordsInReadable = numberToReadableWords(localAmount);
  const ContainerComp = embedded ? View : SafeAreaView;

  return (
    <ContainerComp style={styles.container} {...(!embedded ? { edges: ["top" as const] } : {})}>
      {!embedded && (
        <>
          {/* Header */}
          <PostWorkHeader
            title="Payment"
            currentStep={6}
            totalSteps={7}
            onBack={() => router.push("/post-work/schedule")}
            onExit={() => setShowExitModal(true)}
          />

          {/* Progress Indicator */}
          <StageProgressIndicator
            currentStep={6}
            onStepPress={(step) => {
              if (step <= 2) {
                router.push({
                  pathname: "/post-work",
                  params: { stage: String(step), preserveDraft: "1" },
                });
              }
              else if (step === 3) router.push("/post-work/details");
              else if (step === 4) router.push("/post-work/location");
              else if (step === 5) router.push("/post-work/schedule");
            }}
          />
        </>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <PostWorkAnimatedContent>
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.question}>How much will you pay?</Text>
          <Text style={styles.subtitle}>
            Choose your payment model, set the pay rate, and add perks.
          </Text>

          {/* 1. HIGH-END PAYMENT METHOD CARDS */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>1. Payment Method</Text>
            <Text style={styles.sectionHint}>Select how the pay terms will be agreed:</Text>

            <View style={styles.modelGrid}>
              {[
                {
                  id: "fixed",
                  title: "Fixed Rate",
                  sub: "Exact, non-negotiable pay",
                  badge: "Standard",
                  icon: "lock-closed",
                },
                {
                  id: "negotiable",
                  title: "Negotiable",
                  sub: "Target budget open to discuss",
                  badge: "Flexible",
                  icon: "chatbubbles",
                },
                ...(isEducation
                  ? [
                      {
                        id: "demo_first",
                        title: "Demo First",
                        sub: "Decide after trial session",
                        badge: "Trial",
                        icon: "sparkles",
                      },
                    ]
                  : []),
                {
                  id: "discuss",
                  title: "Discuss Directly",
                  sub: "Agree with candidates directly",
                  badge: "Custom",
                  icon: "people",
                },
              ].map((item) => {
                const isSelected = localPayMode === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setLocalPayMode(item.id as PayMode)}
                    style={[
                      styles.modelCard,
                      isSelected && styles.modelCardActive,
                    ]}
                  >
                    <View style={styles.modelCardTopRow}>
                      <View
                        style={[
                          styles.modelIconBox,
                          isSelected && styles.modelIconBoxActive,
                        ]}
                      >
                        <Ionicons
                          name={item.icon as any}
                          size={18}
                          color={isSelected ? "#03402D" : "#475569"}
                        />
                      </View>
                      <View
                        style={[
                          styles.modelBadgePill,
                          isSelected && styles.modelBadgePillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.modelBadgeText,
                            isSelected && styles.modelBadgeTextActive,
                          ]}
                        >
                          {item.badge}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.modelTitle,
                        isSelected && styles.modelTitleActive,
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.modelSub}>{item.sub}</Text>

                    <View style={styles.modelFooterRow}>
                      <View
                        style={[
                          styles.modelCheckDot,
                          isSelected && styles.modelCheckDotActive,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.modelSelectedStatus,
                          isSelected && styles.modelSelectedStatusActive,
                        ]}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 2. PAYMENT CALCULATION & PAYOUT */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {localPayMode === "discuss" ? "2. Payment Terms" : "2. Payment Calculation & Payout"}
            </Text>
            <View style={styles.ratePeriodGrid}>
              {paymentPlanGridOptions.map((plan) => {
                const isSelected = selectedPayPlan === plan.id;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedPayPlan(plan.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.ratePeriodOption, isSelected && styles.ratePeriodOptionActive]}
                  >
                    <Text
                      style={[styles.ratePeriodText, isSelected && styles.ratePeriodTextActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {paymentPeriodLabel(plan.id)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.payoutDetailRow}>
              <View style={styles.payoutDetailIcon}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payoutDetailTitle}>{activePlan.payoutTag}</Text>
                <Text style={styles.payoutDetailDesc}>{activePlan.desc}</Text>
              </View>
            </View>
          </View>

          {/* 3. PAY RATE AMOUNT (CLEAN, NO MONEY SUGGESTIONS) */}
          {localPayMode === "discuss" ? (
            <View style={styles.sectionCard}>
              <View style={styles.discussNoticeBox}>
                <Ionicons name="chatbubbles" size={24} color="#03402D" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.discussNoticeTitle}>Pay Discussed Directly</Text>
                  <Text style={styles.discussNoticeSub}>
                    No upfront rate will be shown on the job post. Applicants will discuss and agree on pay directly with you.
                  </Text>
                </View>
              </View>
            </View>
          ) : localPayMode === "demo_first" ? (
            <View style={styles.sectionCard}>
              <View style={styles.discussNoticeBox}>
                <Ionicons name="sparkles" size={24} color="#03402D" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.discussNoticeTitle}>Decided After Demo Class</Text>
                  <Text style={styles.discussNoticeSub}>
                    Evaluate the demo session first. Final compensation will be mutually agreed with the tutor.
                  </Text>
                </View>
              </View>

              <Text style={[styles.sectionSubtitle, { marginTop: 14 }]}>
                Demo Class Terms:
              </Text>
              <View style={styles.pillsRow}>
                {["Free Demo Class", "Paid Trial Class"].map((term) => {
                  const isSelected = localDemoTerms === term;
                  return (
                    <Pressable
                      key={term}
                      onPress={() => setLocalDemoTerms(term)}
                      style={[
                        styles.demoPill,
                        isSelected && styles.demoPillActive,
                      ]}
                    >
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={15}
                        color={isSelected ? "#03402D" : "#94A3B8"}
                      />
                      <Text
                        style={[
                          styles.demoPillText,
                          isSelected && styles.demoPillTextActive,
                        ]}
                      >
                        {term}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                {localPayMode === "negotiable" ? "3. Target Budget Amount" : "3. Pay Rate Amount"}
              </Text>

              {/* Amount Input with Live Comma Formatting */}
              <View style={styles.amountInputRow}>
                <View style={styles.currencyBox}>
                  <Text style={styles.currencySymbol}>₹</Text>
                </View>
                <TextInput
                  value={formatIndianCommas(localAmount)}
                  onChangeText={handleAmountChange}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#CBD5E1"
                  style={styles.amountTextInput}
                  maxLength={11}
                  onFocus={(event) => {
                    const inputHandle = event.nativeEvent.target;
                    focusedAmountInputHandle.current = inputHandle;
                    if (Keyboard.isVisible()) {
                      requestAnimationFrame(() => {
                        scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
                          inputHandle,
                          160,
                          true,
                        );
                      });
                    }
                  }}
                />
                <Text style={styles.amountUnitSuffix}>
                  {paymentPeriodLabel(activePlan.id)}
                </Text>
              </View>

              {/* Number in Words Clarification Badge */}
              {wordsInReadable ? (
                <View style={styles.wordsClarificationBox}>
                  <Ionicons name="sparkles" size={13} color="#059669" />
                  <Text style={styles.wordsClarificationText} numberOfLines={1}>
                    {wordsInReadable}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* 4. OPTIONAL PERKS (BEAUTIFULLY STRUCTURED 2-COLUMN GRID) */}
          <View style={styles.sectionCard}>
            <View style={styles.perksHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>
                  {localPayMode === "discuss" ? "3. Optional Perks" : "4. Optional Perks"}
                </Text>
                <Text style={styles.sectionHint}>
                  Add benefits to make your job attractive to top applicants:
                </Text>
              </View>
              {localExtras.length > 0 && (
                <View style={styles.activePerksCountBadge}>
                  <Text style={styles.activePerksCountText}>
                    {localExtras.length} Selected
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.perksGrid}>
              {structuredPerks.map((perk) => {
                const isSelected = localExtras.includes(perk.label);
                return (
                  <Pressable
                    key={perk.id}
                    onPress={() => togglePerk(perk.label)}
                    style={[
                      styles.perkCard,
                      isSelected && styles.perkCardActive,
                    ]}
                  >
                    <View style={styles.perkCardTop}>
                      <View
                        style={[
                          styles.perkIconBox,
                          isSelected && styles.perkIconBoxActive,
                        ]}
                      >
                        <Ionicons
                          name={perk.icon as any}
                          size={18}
                          color={isSelected ? "#03402D" : "#475569"}
                        />
                      </View>
                      <View
                        style={[
                          styles.perkToggleBtn,
                          isSelected && styles.perkToggleBtnActive,
                        ]}
                      >
                        <Ionicons
                          name={isSelected ? "checkmark" : "add"}
                          size={12}
                          color={isSelected ? "#FFFFFF" : "#64748B"}
                        />
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.perkTitle,
                        isSelected && styles.perkTitleActive,
                      ]}
                      numberOfLines={1}
                    >
                      {perk.label}
                    </Text>
                    <Text style={styles.perkSub} numberOfLines={2}>
                      {perk.sub}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 5. LIVE SUMMARY */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconBox}>
              <Ionicons name="wallet" size={22} color="#03402D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>
                {localPayMode === "discuss"
                  ? "Rate Discussed Directly with Candidates"
                  : localPayMode === "demo_first"
                  ? `Decided After Demo (${localDemoTerms})`
                  : localAmount && parseFloat(localAmount) > 0
                  ? `₹${formatIndianCommas(localAmount)} ${activePlan.suffix} (${localPayMode === "negotiable" ? "Negotiable" : "Fixed"})`
                  : `Enter pay amount ${activePlan.suffix}`}
              </Text>
              <Text style={styles.summarySub}>
                {activePlan.label} • Paid {activePlan.payoutTag}
                {localExtras.length > 0 ? ` • ${localExtras.length} perks added` : ""}
              </Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
        </PostWorkAnimatedContent>
      </KeyboardAvoidingView>

      {!embedded && (
        <>
          {/* Persistent Footer */}
          <PostWorkFooter
            onBack={() => router.push("/post-work/schedule")}
            onNext={handleNext}
            nextLabel="Review & Post"
          />

          {/* Exit Modal */}
          <ExitModal
            visible={showExitModal}
            onClose={() => setShowExitModal(false)}
            onExit={handleConfirmExit}
          />
        </>
      )}
    </ContainerComp>
  );
});

export default function PostWorkPayRoute() {
  return <Redirect href={{ pathname: "/post-work", params: { stage: "6" } }} />;
}

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
    paddingTop: 10,
    paddingBottom: 32,
  },
  stageTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#03402D",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  question: {
    fontSize: POST_WORK_TYPOGRAPHY.screenHeading,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 16,
  },

  // Section Card
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sectionHint: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 12,
  },
  // 1. High-End Payment Method Grid
  modelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modelCard: {
    width: "48.5%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    justifyContent: "space-between",
  },
  modelCardActive: {
    borderColor: "#03402D",
    backgroundColor: "#F0FDF4",
    shadowColor: "#03402D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  modelCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modelIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modelIconBoxActive: {
    backgroundColor: "#DCFCE7",
  },
  modelBadgePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  modelBadgePillActive: {
    backgroundColor: "#ECFDF5",
  },
  modelBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
  modelBadgeTextActive: {
    color: "#03402D",
  },
  modelTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  modelTitleActive: {
    color: "#03402D",
  },
  modelSub: {
    fontSize: 10.5,
    color: "#64748B",
    lineHeight: 14,
    marginBottom: 10,
  },
  modelFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  modelCheckDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  modelCheckDotActive: {
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  modelSelectedStatus: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },
  modelSelectedStatusActive: {
    color: "#03402D",
  },

  // 2. Amount Input Row
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    height: 58,
  },
  currencyBox: {
    paddingRight: 6,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: "800",
    color: "#03402D",
  },
  amountTextInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    padding: 0,
  },
  amountUnitSuffix: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#64748B",
  },

  // Number in Words Clarification Box
  wordsClarificationBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  wordsClarificationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#03402D",
  },

  // Payment period selector and selected payout details
  ratePeriodGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
    marginTop: 8,
  },
  ratePeriodOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  ratePeriodOptionActive: {
    borderColor: "#03402D",
    backgroundColor: "#03402D",
  },
  ratePeriodText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    includeFontPadding: false,
  },
  ratePeriodTextActive: {
    color: "#FFFFFF",
  },
  payoutDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: "#F8FAFC",
  },
  payoutDetailIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#03402D",
  },
  payoutDetailTitle: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#03402D",
  },
  payoutDetailDesc: {
    fontSize: 10,
    lineHeight: 13,
    color: "#64748B",
  },
  // Discuss / Demo Notice Box
  discussNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  discussNoticeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#03402D",
    marginBottom: 2,
  },
  discussNoticeSub: {
    fontSize: 12,
    color: "#059669",
    lineHeight: 16,
  },
  pillsRow: {
    flexDirection: "row",
    gap: 8,
  },
  demoPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
  },
  demoPillActive: {
    borderColor: "#03402D",
    backgroundColor: "#F0FDF4",
  },
  demoPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  demoPillTextActive: {
    color: "#03402D",
  },

  // 4. Well-Structured Optional Perks Grid
  perksHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  activePerksCountBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  activePerksCountText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#03402D",
  },
  perksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  perkCard: {
    width: "48.5%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    justifyContent: "space-between",
  },
  perkCardActive: {
    borderColor: "#03402D",
    backgroundColor: "#F0FDF4",
    shadowColor: "#03402D",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  perkCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  perkIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  perkIconBoxActive: {
    backgroundColor: "#DCFCE7",
  },
  perkToggleBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  perkToggleBtnActive: {
    backgroundColor: "#03402D",
  },
  perkTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  perkTitleActive: {
    color: "#03402D",
  },
  perkSub: {
    fontSize: 10.5,
    color: "#64748B",
    lineHeight: 14,
  },

  // 5. Summary Card
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
  },
  summaryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  summaryTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  summarySub: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginTop: 2,
  },
});
