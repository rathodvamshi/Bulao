import { router } from "expo-router";
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../src/components/ui";
import { PostWorkHeader, PostWorkProgress, PostWorkFooter, PostWorkSummary } from "../../src/components/PostWorkUI";
import { usePostWorkStore, PayUnit, PayWhen } from "../../src/features/post-work/store";

export default function PostWorkPayScreen() {
  const { payAmount, payUnit, payWhen, extras, description, setPay } = usePostWorkStore();

  const [localAmount, setLocalAmount] = useState(payAmount);
  const [localUnit, setLocalUnit] = useState<PayUnit>(payUnit);
  const [localWhen, setLocalWhen] = useState<PayWhen>(payWhen);
  const [localExtras, setLocalExtras] = useState<string[]>([]);
  const [localDescription, setLocalDescription] = useState(description);

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

  const toggleBenefit = (benefit: string) => {
    setLocalExtras(prev => prev.includes(benefit) ? prev.filter(b => b !== benefit) : [...prev, benefit]);
  };

  const handleNext = () => {
    if (!localAmount || parseFloat(localAmount) <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid pay amount.");
      return;
    }
    setPay(localAmount, localUnit, localWhen, localExtras, [], null, localDescription);
    router.push("/post-work/review");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PostWorkHeader title="Payment" step={5} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>How much will you pay?</Text>

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
              <Pressable key={benefit} onPress={() => toggleBenefit(benefit)} style={[styles.benefitChip, localExtras.includes(benefit) && styles.benefitChipActive]}>
                <Text style={[styles.benefitText, localExtras.includes(benefit) && styles.benefitTextActive]}>{benefit}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Additional Details (Optional)</Text>
          <TextInput
            value={localDescription}
            onChangeText={setLocalDescription}
            placeholder="Any other details..."
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

      <PostWorkFooter onNext={handleNext} />
      <PostWorkProgress currentStep={5} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, padding: 20 },
  question: { fontSize: 18, fontWeight: "600", color: colors.ink, marginBottom: 24 },
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
