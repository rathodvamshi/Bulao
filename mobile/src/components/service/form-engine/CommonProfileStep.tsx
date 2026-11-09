import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ProviderCommonProfile } from "@bulao/domain";
import { AppTextInput } from "../../AppTextInput";

const GREEN = "#15803D";
const GREEN_SOFT = "#DCFCE7";
const TEXT_PRIMARY = "#0F172A";
const TEXT_SECONDARY = "#64748B";
const BORDER = "#E2E8F0";
const WHITE = "#FFFFFF";
const BG_MUTED = "#F8FAFC";
const DANGER = "#DC2626";

const LANGUAGES = [
  "Telugu",
  "Hindi",
  "English",
  "Urdu",
  "Tamil",
  "Kannada",
  "Malayalam",
  "Marathi",
  "Bengali",
];

interface Props {
  profile: Partial<ProviderCommonProfile>;
  onChange: (updated: Partial<ProviderCommonProfile>) => void;
  errors?: Record<string, string>;
}

export function CommonProfileStep({ profile, onChange, errors = {} }: Props) {
  const providerType = profile.providerType || "individual";
  const languages = profile.languages || ["English"];

  const setField = (key: keyof ProviderCommonProfile, value: any) => {
    onChange({ ...profile, [key]: value });
  };

  const toggleLanguage = (lang: string) => {
    const next = languages.includes(lang)
      ? languages.filter((l) => l !== lang)
      : [...languages, lang];
    setField("languages", next.length ? next : ["English"]);
  };

  const generateIntro = () => {
    const exp = profile.overallExperience ? `${profile.overallExperience} years of experience` : "rich practical experience";
    const name = profile.displayName || "I am a local professional";
    setField(
      "introduction",
      `Hello, I am ${profile.displayName || "a verified professional"}. With ${exp}, I deliver reliable, high-quality local services to homes and businesses with guaranteed satisfaction.`
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroSection}>
        <Text style={styles.stageTag}>STEP 1 · BASIC PROVIDER INFO</Text>
        <Text style={styles.heading}>Tell customers about yourself</Text>
        <Text style={styles.subtitle}>
          This information is shared across all services you provide on Bulao.
        </Text>
      </View>

      {/* Provider Type Selector */}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Operating as *</Text>
        <View style={styles.typeRow}>
          {[
            { id: "individual", label: "Individual", icon: "person" },
            { id: "business", label: "Business / Shop", icon: "business" },
            { id: "team", label: "Team / Agency", icon: "people" },
          ].map((t) => {
            const isSel = providerType === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setField("providerType", t.id)}
                style={[styles.typeButton, isSel && styles.typeButtonActive]}
              >
                <Ionicons
                  name={t.icon as any}
                  size={18}
                  color={isSel ? GREEN : TEXT_SECONDARY}
                />
                <Text style={[styles.typeButtonText, isSel && styles.typeButtonTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Display Name */}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Display Name / Full Name *</Text>
        <AppTextInput
          placeholder="e.g. Ramesh Kumar"
          value={profile.displayName || ""}
          onChangeText={(v) => setField("displayName", v)}
        />
        {errors.displayName ? (
          <Text style={styles.errorText}>{errors.displayName}</Text>
        ) : null}

        {/* Business Fields (Conditional) */}
        {providerType !== "individual" && (
          <View style={{ marginTop: 12, gap: 10 }}>
            <View>
              <Text style={styles.fieldLabel}>Business / Enterprise Name</Text>
              <AppTextInput
                placeholder="e.g. Ramesh Electrical & Hardware Services"
                value={profile.businessName || ""}
                onChangeText={(v) => setField("businessName", v)}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>Team Size (Number of workers)</Text>
              <AppTextInput
                placeholder="e.g. 4"
                value={profile.teamSize ? String(profile.teamSize) : ""}
                onChangeText={(v) => {
                  const num = parseInt(v.replace(/[^0-9]/g, ""), 10);
                  setField("teamSize", isNaN(num) ? undefined : num);
                }}
                keyboardType="number-pad"
              />
            </View>
          </View>
        )}
      </View>

      {/* Experience & Languages */}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Overall Experience (Years) *</Text>
        <AppTextInput
          placeholder="e.g. 5"
          value={profile.overallExperience != null ? String(profile.overallExperience) : ""}
          onChangeText={(v) => {
            const num = parseInt(v.replace(/[^0-9]/g, ""), 10);
            setField("overallExperience", isNaN(num) ? 0 : num);
          }}
          keyboardType="number-pad"
        />

        <View style={{ marginTop: 14 }}>
          <Text style={styles.fieldLabel}>Languages you speak *</Text>
          <View style={styles.chipsRow}>
            {LANGUAGES.map((lang) => {
              const isSel = languages.includes(lang);
              return (
                <Pressable
                  key={lang}
                  onPress={() => toggleLanguage(lang)}
                  style={[styles.langChip, isSel && styles.langChipActive]}
                >
                  {isSel ? (
                    <Ionicons name="checkmark" size={13} color={GREEN} style={{ marginRight: 3 }} />
                  ) : null}
                  <Text style={[styles.langText, isSel && styles.langTextActive]}>
                    {lang}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Short Introduction */}
      <View style={styles.card}>
        <View style={styles.labelWithAction}>
          <Text style={styles.fieldLabel}>Short Introduction *</Text>
          <Pressable onPress={generateIntro} style={styles.autoButton}>
            <Ionicons name="sparkles" size={12} color={GREEN} />
            <Text style={styles.autoButtonText}>Auto-generate</Text>
          </Pressable>
        </View>
        <AppTextInput
          placeholder="Describe your skills, commitment to quality, and service area..."
          value={profile.introduction || ""}
          onChangeText={(v) => setField("introduction", v)}
          multiline
          numberOfLines={4}
          style={{ height: 90, textAlignVertical: "top" }}
        />
        {errors.introduction ? (
          <Text style={styles.errorText}>{errors.introduction}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  heroSection: {
    gap: 6,
  },
  stageTag: {
    fontSize: 11,
    fontWeight: "800",
    color: GREEN,
    letterSpacing: 1,
  },
  heading: {
    fontSize: 22,
    fontWeight: "900",
    color: TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 13.5,
    color: TEXT_SECONDARY,
    lineHeight: 19,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG_MUTED,
    gap: 6,
  },
  typeButtonActive: {
    backgroundColor: GREEN_SOFT,
    borderColor: GREEN,
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_SECONDARY,
  },
  typeButtonTextActive: {
    color: GREEN,
    fontWeight: "800",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG_MUTED,
  },
  langChipActive: {
    backgroundColor: GREEN_SOFT,
    borderColor: GREEN,
  },
  langText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  langTextActive: {
    color: GREEN,
    fontWeight: "700",
  },
  labelWithAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  autoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  autoButtonText: {
    fontSize: 12,
    color: GREEN,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 11.5,
    color: DANGER,
    fontWeight: "600",
  },
});
