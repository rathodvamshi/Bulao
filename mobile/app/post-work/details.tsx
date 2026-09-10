import { router } from "expo-router";
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../src/components/ui";
import { usePostWorkStore, ExperienceLevel } from "../../src/features/post-work/store";

export default function PostWorkDetailsScreen() {
  const { title, workers, experience, setDetails, roleName } = usePostWorkStore();
  
  const [localTitle, setLocalTitle] = useState(title);
  const [localWorkers, setLocalWorkers] = useState(workers);
  const [localExperience, setLocalExperience] = useState<ExperienceLevel>(experience);

  const handleNext = () => {
    setDetails(localTitle, localWorkers, localExperience);
    router.push("/post-work/location");
  };

  const experienceOptions: { value: ExperienceLevel; label: string; icon: string }[] = [
    { value: "any", label: "Any Level", icon: "🌱" },
    { value: "some", label: "Some Exp", icon: "🙂" },
    { value: "expert", label: "Expert", icon: "🏅" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Job Details</Text>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>Step 2/6</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>Tell us about the work</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Job Title</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={localTitle}
              onChangeText={setLocalTitle}
              placeholder={`${roleName} needed`}
              placeholderTextColor={colors.mutedLight}
              style={styles.input}
            />
            <Pressable style={styles.micButton}>
              <Text style={styles.micIcon}>🎤</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>How many workers?</Text>
          <View style={styles.stepperContainer}>
            <Pressable
              onPress={() => setLocalWorkers(Math.max(1, localWorkers - 1))}
              style={[styles.stepperBtn, localWorkers <= 1 && styles.stepperBtnDisabled]}
              disabled={localWorkers <= 1}
            >
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <View style={styles.stepperValue}>
              <Text style={styles.stepperValueText}>{localWorkers}</Text>
              <Text style={styles.stepperValueLabel}>{localWorkers === 1 ? "person" : "people"}</Text>
            </View>
            <Pressable
              onPress={() => setLocalWorkers(Math.min(50, localWorkers + 1))}
              style={[styles.stepperBtn, localWorkers >= 50 && styles.stepperBtnDisabled]}
              disabled={localWorkers >= 50}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Experience Required</Text>
          <View style={styles.experienceGrid}>
            {experienceOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setLocalExperience(option.value)}
                style={[
                  styles.experienceCard,
                  localExperience === option.value && styles.experienceCardActive,
                ]}
              >
                <Text style={styles.experienceIcon}>{option.icon}</Text>
                <Text style={[
                  styles.experienceLabel,
                  localExperience === option.value && styles.experienceLabelActive,
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryIcon}>✓</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryText}>
              {localTitle || `${roleName} needed`}
            </Text>
            <Text style={styles.summarySubtext}>
              {localWorkers} {localWorkers === 1 ? "person" : "people"} • {experienceOptions.find(e => e.value === localExperience)?.label}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handleNext} style={styles.nextButton}>
          <Text style={styles.nextButtonText}>Continue</Text>
        </Pressable>
      </View>

      <View style={styles.progressBar}>
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <View key={step} style={[styles.progressDot, step <= 2 && styles.progressDotActive]} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  backText: { fontSize: 24, color: colors.green },
  title: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.ink, marginLeft: 8 },
  stepIndicator: { backgroundColor: colors.greenLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  stepText: { fontSize: 12, fontWeight: "600", color: colors.green },
  content: { flex: 1, padding: 20 },
  question: { fontSize: 18, fontWeight: "600", color: colors.ink, marginBottom: 24 },
  section: { marginBottom: 28 },
  label: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 12 },
  inputRow: { flexDirection: "row", gap: 10 },
  input: { flex: 1, backgroundColor: colors.white, borderRadius: 14, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontWeight: "500", color: colors.ink },
  micButton: { width: 52, height: 52, backgroundColor: colors.white, borderRadius: 14, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  micIcon: { fontSize: 22 },
  stepperContainer: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.white, borderRadius: 16, borderWidth: 2, borderColor: colors.line, padding: 6 },
  stepperBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  stepperBtnDisabled: { backgroundColor: colors.line, opacity: 0.5 },
  stepperBtnText: { fontSize: 28, fontWeight: "700", color: colors.white },
  stepperValue: { alignItems: "center", paddingHorizontal: 24 },
  stepperValueText: { fontSize: 32, fontWeight: "800", color: colors.ink },
  stepperValueLabel: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 2 },
  experienceGrid: { flexDirection: "row", gap: 10 },
  experienceCard: { flex: 1, aspectRatio: 1, backgroundColor: colors.white, borderRadius: 16, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center", gap: 8 },
  experienceCardActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  experienceIcon: { fontSize: 32 },
  experienceLabel: { fontSize: 13, fontWeight: "700", color: colors.ink, textAlign: "center" },
  experienceLabelActive: { color: colors.green },
  summary: { flexDirection: "row", gap: 12, backgroundColor: colors.white, padding: 18, borderRadius: 16, borderWidth: 2, borderColor: colors.green, alignItems: "center" },
  summaryIcon: { fontSize: 28 },
  summaryText: { fontSize: 16, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  summarySubtext: { fontSize: 14, fontWeight: "500", color: colors.muted },
  footer: { padding: 20, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  nextButton: { backgroundColor: colors.green, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  nextButtonText: { fontSize: 17, fontWeight: "700", color: colors.white },
  progressBar: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12, backgroundColor: colors.white },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  progressDotActive: { backgroundColor: colors.green, width: 24 },
});
