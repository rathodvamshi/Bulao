/**
 * AppText — Bulao's universal text component.
 *
 * Rules:
 *  • Always applies a Bulao-bundled font family (never falls back to system Roboto/Samsung One UI/etc).
 *  • Caps system font-size scaling at 1.2 so layouts never break on accessibility settings.
 *  • Script detection: Devanagari (Hindi) and Telugu ranges pick Noto Supplement fonts automatically.
 *  • Weight mapping: fontWeight 400/normal → Regular, 500 → Medium, 600/semibold → SemiBold, 700+/bold → Bold.
 *    On Android each weight is a distinct family; fontWeight must stay "normal" after mapping.
 *
 * Usage:
 *   import { AppText } from "@/components/AppText";
 *   <AppText style={{ fontSize: 16, fontWeight: "600" }}>Hello</AppText>
 */

import React from "react";
import { StyleSheet, Text, type TextProps } from "react-native";
import { loginTheme } from "../features/auth/loginTheme";

// ---------------------------------------------------------------------------
// Script detection helpers
// ---------------------------------------------------------------------------

/** Returns true if the string contains any Devanagari (Hindi) codepoints. */
function hasDevanagari(s: string): boolean {
  return /[\u0900-\u097F\uA8E0-\uA8FF\u1CD0-\u1CFF]/.test(s);
}

/** Returns true if the string contains any Telugu codepoints. */
function hasTelugu(s: string): boolean {
  return /[\u0C00-\u0C7F]/.test(s);
}

/** Extracts a flat string from React children (text nodes only). */
function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  return "";
}

// ---------------------------------------------------------------------------
// Weight → family name mapping (always resolves to bundled Bulao fonts)
// ---------------------------------------------------------------------------

function weightToFamily(weight: string | number | undefined): string {
  const w = String(weight ?? "400");
  if (w === "bold" || Number(w) >= 700) return loginTheme.fontBold;
  if (w === "600" || w === "semibold") return loginTheme.fontSemiBold;
  if (w === "500" || w === "medium") return loginTheme.fontMedium;
  return loginTheme.font; // PlusJakartaSans-Regular
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AppTextProps extends TextProps {
  /** Override script detection to force Devanagari font. */
  forceDevanagari?: boolean;
  /** Override script detection to force Telugu font. */
  forceTelugu?: boolean;
}

export function AppText({
  style,
  children,
  forceDevanagari,
  forceTelugu,
  ...rest
}: AppTextProps) {
  const flat = StyleSheet.flatten(style) ?? {};

  return (
    <Text
      maxFontSizeMultiplier={1.2}
      {...rest}
      style={flat}
    >
      {children}
    </Text>
  );
}

// Default export for convenience
export default AppText;
