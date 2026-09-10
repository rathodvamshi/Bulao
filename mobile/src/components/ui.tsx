import {
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  Platform,
} from "react-native";
import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { t } from "../i18n/en";

export const colors = {
  ink: "#0D2318",         // Very dark green-black — maximum readability
  green: "#1A6645",       // Rich forest green
  greenDark: "#124A31",   // Darker green for pressed states
  greenLight: "#E8F5EE",  // Light green tint for backgrounds
  muted: "#3D5246",       // Dark enough to read on white or light backgrounds
  mutedLight: "#6B8275",  // For placeholders only
  paper: "#F4F7F3",       // Off-white green-tinted background
  white: "#FFFFFF",
  line: "#C8D8CE",
  lime: "#C8E87A",
  error: "#B03A2E",
  errorBg: "#FEECEB",
  success: "#1A7A4A",
};

// ─── Screen ────────────────────────────────────────────────────────────────────
export function Screen({
  children,
  title,
  back = false,
  backgroundImage,
}: {
  children: ReactNode;
  title?: string;
  back?: boolean;
  backgroundImage?: any;
}) {
  const content = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.screen}
      showsVerticalScrollIndicator={false}
    >
      {back && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <Text style={s.link}>← {t("back")}</Text>
        </Pressable>
      )}
      {title && (
        <Text accessibilityRole="header" style={s.heading}>
          {title}
        </Text>
      )}
      {children}
    </ScrollView>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.paper }}
      edges={["top", "left", "right"]}
    >
      {backgroundImage ? (
        <ImageBackground
          source={backgroundImage}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          {content}
        </ImageBackground>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

// ─── Heading ───────────────────────────────────────────────────────────────────
export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
    </Text>
  );
}

// ─── Copy / Body Text ─────────────────────────────────────────────────────────
export function Copy({
  children,
  small = false,
  center = false,
  bold = false,
}: {
  children: ReactNode;
  small?: boolean;
  center?: boolean;
  bold?: boolean;
}) {
  return (
    <Text
      style={{
        color: colors.muted,
        fontSize: small ? 13 : 16,
        lineHeight: small ? 20 : 26,
        fontWeight: bold ? "600" : "400",
        textAlign: center ? "center" : "left",
      }}
    >
      {children}
    </Text>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  const bgColor = danger
    ? colors.errorBg
    : secondary
    ? colors.greenLight
    : colors.green;
  const textColor = danger
    ? colors.error
    : secondary
    ? colors.greenDark
    : colors.white;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bgColor },
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: textColor,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <View style={[s.card, accent && { borderColor: colors.green, borderWidth: 1.5 }]}>
      {children}
    </View>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: colors.mutedLight,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: -8,
      }}
    >
      {children}
    </Text>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
export function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedLight}
        multiline={multiline}
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        s.chip,
        selected && {
          backgroundColor: colors.green,
          borderColor: colors.green,
        },
      ]}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: selected ? colors.white : colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────
export function Loading() {
  return (
    <View style={{ gap: 14, padding: 32, alignItems: "center" }}>
      <ActivityIndicator color={colors.green} size="large" />
      <Copy center>{t("loading")}</Copy>
    </View>
  );
}

// ─── Failure ──────────────────────────────────────────────────────────────────
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <View style={s.errorCard}>
      <Text
        accessibilityRole="alert"
        style={{ color: colors.error, fontSize: 15, fontWeight: "500", lineHeight: 22 }}
      >
        {error instanceof Error ? error.message : t("error")}
      </Text>
      {retry && <Button label={t("retry")} onPress={retry} secondary />}
    </View>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
export function Divider() {
  return <View style={s.divider} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
export const s = StyleSheet.create({
  screen: {
    padding: 20,
    paddingBottom: 48,
    gap: 20,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  heading: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.8,
    lineHeight: 37,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: 0.1,
  },
  link: {
    color: colors.green,
    fontSize: 16,
    fontWeight: "600",
  },
  button: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 22,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.white,
    minHeight: 54,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  errorCard: {
    backgroundColor: colors.errorBg,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#F5C6C3",
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 4,
  },
});
