/**
 * AppTextInput — Bulao's universal text input component.
 *
 * Rules:
 *  • Applies the same Plus Jakarta Sans font used by AppText.
 *  • Sets maxFontSizeMultiplier={1.2} on both input text and placeholder.
 *  • Never falls back to system font, even on Samsung One UI or MIUI.
 *  • Wrapped in React.forwardRef so input refs and focus managers work properly.
 *
 * Usage:
 *   import { AppTextInput } from "@/components/AppTextInput";
 *   <AppTextInput value={val} onChangeText={set} placeholder="Phone number" />
 */

import React, { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { loginTheme } from "../features/auth/loginTheme";

export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput(
  { style, ...rest },
  ref
) {
  const flat = StyleSheet.flatten(style) ?? {};
  const weight = flat.fontWeight;

  let fontFamily: string = loginTheme.font; // PlusJakartaSans-Regular
  const w = String(weight ?? "400");
  if (w === "bold" || Number(w) >= 700) fontFamily = loginTheme.fontBold;
  else if (w === "600" || w === "semibold") fontFamily = loginTheme.fontSemiBold;
  else if (w === "500" || w === "medium") fontFamily = loginTheme.fontMedium;

  return (
    <TextInput
      ref={ref}
      maxFontSizeMultiplier={1.2}
      {...rest}
      style={[
        flat,
        {
          fontFamily,
          fontWeight: "normal",
        },
      ]}
    />
  );
});

export default AppTextInput;
