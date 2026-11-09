import React, { createContext, useContext } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  type StyleProp,
} from "react-native";

export const AppFontsContext = createContext(false);
export const appFontFamily =
  Platform.OS === "android"
    ? "sans-serif"
    : Platform.OS === "ios"
      ? "System"
      : "Arial, sans-serif";
export const appFonts = {
  "Bulao-Regular": require("../../assets/fonts/Inter-Regular.ttf"),
  "Bulao-SemiBold": require("../../assets/fonts/Inter-SemiBold.ttf"),
  "Bulao-Bold": require("../../assets/fonts/Inter-Bold.ttf"),
};
export function useAppTypography(style?: StyleProp<TextStyle>) {
  const loaded = useContext(AppFontsContext);
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const numericWeight = weight === "bold" ? 700 : Number(weight || 400);
  const family =
    numericWeight >= 700
      ? "Bulao-Bold"
      : numericWeight >= 500
        ? "Bulao-SemiBold"
        : "Bulao-Regular";
  return [
    style,
    loaded
      ? { fontFamily: family, fontWeight: "normal" as const }
      : { fontFamily: appFontFamily },
  ];
}
export interface AppTextProps extends TextProps {
  forceDevanagari?: boolean;
  forceTelugu?: boolean;
}
/** Bundled Inter weights; native glyph fallback handles Hindi/Telugu. Preserve accessibility scaling. */
export function AppText({
  style,
  forceDevanagari,
  forceTelugu,
  ...props
}: AppTextProps) {
  return <Text {...props} style={useAppTypography(style)} />;
}
export default AppText;
