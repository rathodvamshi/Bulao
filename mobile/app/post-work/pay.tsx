import { router } from "expo-router";
import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../src/components/ui";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  PostWorkSummary,
  ExitModal,
} from "../../src/components/PostWorkUI";
import { usePostWorkStore, PayUnit, PayWhen } from "../../src/features/post-work/store";

export default function PostWorkPayScreen() {
  const { payAmount, payUnit, payWhen, extras, description, setPay, resetFlow } = usePostWorkStore();

  const [localAmount, setLocalAmount] = useState(payAmount);
  const [localUnit, setLocalUnit] = useState<PayUnit>(payUnit);
  const [localWhen, setLocalWhen] = useState<PayWhen>(payWhen);
  const [localExtras, setLocalExtras] = useState<string[]>(extras || []);
  const [localDescription, setLocalDescription] = useState(description);
  const [showExitModal, setShowExitModal] = useState(false);

  // Auto-seed and sync from store whenever editing or store values change
  useEffect(() => {
    if (payAmount) setLocalAmount(payAmount);
    if (payUnit) setLocalUnit(payUnit);
    if (payWhen) setLocalWhen(payWhen);
    if (extras && extras.length > 0) setLocalExtras(extras);
    if (description) setLocalDescription(description);
  }, [payAmount, payUnit, payWhen, extras, description]);

  const payUnits: { value: PayUnit; label: string }[] = [
    { value: "day", label: "Day" },
    { value: "job", label: "Task" },
    { value: "hour", label: "Hour" },
  ];

  const payWhenOptions: { value: PayWhen; label: string; icon: string }[] = [
    { value: "after", label: "After Work", icon: "✅" },
    { value: "daily", label: "Daily", icon: "📅" },
    { value: "weekly", label: "Weekly", icon: "📆" },
  ];

  const benefitOptions = ["🍽️ Meals", "🚗 Travel", "🏨 Stay"];

  const isBenefitActive = (benefit: string) => {
    const raw = benefit.toLowerCase().replace(/[^a-z]/g, "");
    return localExtras.some((e) => {
      const eRaw = e.toLowerCase().replace(/[^a-z]/g, "");
      return eRaw.includes(raw) || raw.includes(eRaw);
    });
  };

  const toggleBenefit = (benefit: string) => {
    const raw = benefit.toLowerCase().replace(/[^a-z]/g, "");
    setLocalExtras((prev) => {
      const exists = prev.some((e) => {
        const eRaw = e.toLowerCase().replace(/[^a-z]/g, "");
        return eRaw.includes(raw) || raw.includes(eRaw);
      });
      if (exists) {
        return prev.filter((e) => {
          const eRaw = e.toLowerCase().replace(/[^a-z]/g, "");
          return !eRaw.includes(raw) && !raw.includes(eRaw);
        });
      } else {
        return [...prev, benefit];
      }
    });
  };

  const handleNext = () => {
    if (!localAmount || parseFloat(localAmount) <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid pay amount.");
      return;
    }
    setPay(localAmount, localUnit, localWhen, localExtras, [], null, localDescription);
    router.push("/post-work/review");
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
        title="Payment"
        currentStep={6}
        totalSteps={7}
        onExit={() => setShowExitModal(true)}
      />

      {/* Connected Stage Progress Indicator with smooth line & tick animation */}
      <StageProgressIndicator
        currentStep={6}
        onStepPress={(step) => {
          if (step === 1 || step === 2) router.push("/post-work");
          else if (step === 3) router.push("/post-work/details");
          else if (step === 4) router.push("/post-work/location");
          else if (step === 5) router.push("/post-work/schedule");
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.stageTag}>STAGE 6 OF 7</Text>
        <Text style={styles.question}>How much will you pay?</Text>
        <Text style={styles.subtitle}>
          Set a fair pay amount and when you will pay your workers.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput
            value={localAmount}
            onChangeText={text => setLocalAmount(text.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder="1000"
            placeholderTextColor={colors.mutedLight}
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Per</Text>
          <View style={styles.unitRow}>
            {payUnits.map(option => (
              <Pressable key={option.value} onPress={() => setLocalUnit(option.value)} style={[styles.unitCard, localUnit === option.value && styles.unitCardActive]}>
                <Text style={[styles.unitText, localUnit === option.value && styles.unitTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>When Paid</Text>
          <View style={styles.whenGrid}>
            {payWhenOptions.map(option => (
              <Pressable key={option.value} onPress={() => setLocalWhen(option.value)} style={[styles.whenCard, localWhen === option.value && styles.whenCardActive]}>
                <Text style={styles.whenIcon}>{option.icon}</Text>
                <Text style={[styles.whenText, localWhen === option.value && styles.whenTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Benefits (Optional)</Text>
          <View style={styles.benefitRow}>
            {benefitOptions.map(benefit => (
              <Pressable key={benefit} onPress={() => toggleBenefit(benefit)} style={[styles.benefitChip, isBenefitActive(benefit) && styles.benefitChipActive]}>
                <Text style={[styles.benefitText, isBenefitActive(benefit) && styles.benefitTextActive]}>{benefit}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Additional Details (Optional)</Text>
          <TextInput
            value={localDescription}
            onChangeText={setLocalDescription}
            placeholder="Any extra instructions or details for workers..."
            placeholderTextColor={colors.mutedLight}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textarea]}
          />
        </View>

        <PostWorkSummary
          icon="💰"
          text={`₹${localAmount || "0"} per ${localUnit}`}
          subtext={`Paid ${localWhen === "after" ? "after work" : localWhen}${localExtras.length > 0 ? ` • ${localExtras.length} benefit${localExtras.length > 1 ? "s" : ""}` : ""}`}
        />
      </ScrollView>

      {/* Bottom Nav Buttons */}
      <PostWorkFooter
        onBack={() => router.back()}
        onNext={handleNext}
        nextDisabled={!localAmount || parseFloat(localAmount) <= 0}
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
  container: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 32, maxWidth: 640, width: "100%", alignSelf: "center" },
  stageTag: { fontSize: 11, fontWeight: "800", color: colors.green, letterSpacing: 1, marginBottom: 4 },
  question: { fontSize: 24, fontWeight: "800", color: colors.ink, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: "500", color: colors.muted, lineHeight: 20, marginBottom: 24 },
  section: { marginBottom: 24 },
  label: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 12 },
  input: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, fontWeight: "600", color: colors.ink },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  unitRow: { flexDirection: "row", gap: 10 },
  unitCard: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center" },
  unitCardActive: { borderColor: colors.green, backgroundColor: colors.green },
  unitText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  unitTextActive: { color: colors.white },
  whenGrid: { flexDirection: "row", gap: 10 },
  whenCard: { flex: 1, aspectRatio: 1, backgroundColor: colors.white, borderRadius: 16, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center", gap: 8 },
  whenCardActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  whenIcon: { fontSize: 28 },
  whenText: { fontSize: 12, fontWeight: "700", color: colors.ink, textAlign: "center" },
  whenTextActive: { color: colors.green },
  benefitRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  benefitChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white },
  benefitChipActive: { borderColor: colors.green, backgroundColor: colors.green },
  benefitText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  benefitTextActive: { color: colors.white },
});
