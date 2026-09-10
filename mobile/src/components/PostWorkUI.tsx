import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors } from "./ui";
import type { ReactNode } from "react";

export function PostWorkHeader({ title, step, onBack }: { title: string; step: number; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack || (() => router.back())} style={styles.backButton}>
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.stepIndicator}>
        <Text style={styles.stepText}>Step {step}/6</Text>
      </View>
    </View>
  );
}

export function PostWorkProgress({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.progressBar}>
      {[1, 2, 3, 4, 5, 6].map((step) => (
        <View key={step} style={[styles.progressDot, step <= currentStep && styles.progressDotActive]} />
      ))}
    </View>
  );
}

export function PostWorkFooter({ onNext, label = "Continue" }: { onNext: () => void; label?: string }) {
  return (
    <View style={styles.footer}>
      <Pressable onPress={onNext} style={styles.nextButton}>
        <Text style={styles.nextButtonText}>{label}</Text>
      </Pressable>
    </View>
  );
}

export function PostWorkSummary({ icon, text, subtext }: { icon: string; text: string; subtext?: string }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryText}>{text}</Text>
        {subtext && <Text style={styles.summarySubtext}>{subtext}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  backText: { fontSize: 24, color: colors.green },
  title: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.ink, marginLeft: 8 },
  stepIndicator: { backgroundColor: colors.greenLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  stepText: { fontSize: 12, fontWeight: "600", color: colors.green },
  progressBar: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12, backgroundColor: colors.white },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  progressDotActive: { backgroundColor: colors.green, width: 24 },
  footer: { padding: 20, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  nextButton: { backgroundColor: colors.green, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  nextButtonText: { fontSize: 17, fontWeight: "700", color: colors.white },
  summary: { flexDirection: "row", gap: 12, backgroundColor: colors.white, padding: 18, borderRadius: 16, borderWidth: 2, borderColor: colors.green, alignItems: "center" },
  summaryIcon: { fontSize: 28 },
  summaryText: { fontSize: 16, fontWeight: "700", color: colors.ink },
  summarySubtext: { fontSize: 13, fontWeight: "500", color: colors.muted, marginTop: 2 },
});
