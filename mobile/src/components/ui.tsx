import {
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { t } from "../i18n/en";
export const colors = {
  ink: "#183E33",
  green: "#21634D",
  muted: "#64756D",
  paper: "#FAFAF5",
  line: "#DFE6DD",
  lime: "#E6F2A8",
};
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
export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
    </Text>
  );
}
export function Copy({
  children,
  small = false,
}: {
  children: ReactNode;
  small?: boolean;
}) {
  return (
    <Text
      style={{
        color: colors.muted,
        fontSize: small ? 14 : 17,
        lineHeight: small ? 21 : 26,
      }}
    >
      {children}
    </Text>
  );
}
export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text
        style={{
          fontSize: 17,
          fontWeight: "700",
          color: secondary ? colors.ink : "#FFF",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
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
        placeholderTextColor="#829087"
        multiline={multiline}
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
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
          fontSize: 15,
          fontWeight: "600",
          color: selected ? "white" : colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Loading() {
  return (
    <View style={{ gap: 12, padding: 24 }}>
      <ActivityIndicator color={colors.green} />
      <Copy>{t("loading")}</Copy>
    </View>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <Card>
      <Text
        accessibilityRole="alert"
        style={{ color: "#913E2B", fontSize: 16 }}
      >
        {error instanceof Error ? error.message : t("error")}
      </Text>
      {retry && <Button label={t("retry")} onPress={retry} secondary />}
    </Card>
  );
}
export const s = StyleSheet.create({
  screen: {
    padding: 24,
    paddingBottom: 40,
    gap: 20,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  heading: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.8,
    lineHeight: 37,
  },
  label: { fontSize: 17, fontWeight: "600", color: colors.ink },
  link: { color: colors.green, fontSize: 16, fontWeight: "600" },
  button: {
    minHeight: 54,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: "#EDF1E7" },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    color: colors.ink,
    backgroundColor: "white",
    minHeight: 54,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "white",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
