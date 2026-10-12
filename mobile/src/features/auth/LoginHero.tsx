import React from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { loginTheme as theme } from "./loginTheme";
import { BulaoWordmark } from "../../components/BulaoWordmark";

const heroImageSource = require("../../../assets/images/login-hero.jpg");
const heroImageDimensions = { width: 1024, height: 1024 };

type Props = {
  width: number;
  step?: "phone" | "otp" | "name";
  keyboardOpen?: boolean;
};

export function LoginHero({ width, step, keyboardOpen }: Props) {
  const { height: windowHeight } = useWindowDimensions();

  // Set stable hero container height (approx 42% screen height, min 260, max 380).
  // Kept stable so the image artwork does not violently compress when the keyboard opens.
  const height = Math.max(260, Math.min(380, Math.round(windowHeight * 0.42)));

  // Keep the image cover-scaled and pinned to the BOTTOM.
  // Workers' tool belts, hands, and tools land right at the bottom above the card.
  const calculatedHeight = Math.round((width * heroImageDimensions.height) / heroImageDimensions.width);
  const imageHeight = Math.max(height + 54, calculatedHeight);

  return (
    <View style={[styles.hero, { height }]}>
      <Image
        source={heroImageSource}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        resizeMode="cover"
        style={[styles.image, { width, height: imageHeight, bottom: -54 }]}
      />
      <View style={[styles.brand, { top: 12 }]}>
        <BulaoWordmark
          size={38}
          color={theme.primary}
          tagline="Local work & services, on demand"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexShrink: 0, backgroundColor: theme.sky, overflow: "hidden", width: "100%" },
  image: { position: "absolute", bottom: 0, alignSelf: "center" },
  brand: { position: "absolute", left: 12, right: 12, alignItems: "center" },
});
