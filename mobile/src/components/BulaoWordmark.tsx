import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, Text, type StyleProp, type ViewStyle } from "react-native";
import { loginTheme } from "../features/auth/loginTheme";

const SIGNAL_STRETCH_MS = 150;
const SIGNAL_RECOIL_MS = 90;
const SIGNAL_SETTLE_MS = 90;
const SIGNAL_RETURN_MS = 140;
const SIGNAL_REST_MS = 480;
const SIGNAL_PHASE_STAGGER_MS = 70;
export const SIGNAL_RAY_CYCLE_MS =
  SIGNAL_STRETCH_MS + SIGNAL_RECOIL_MS + SIGNAL_SETTLE_MS + SIGNAL_RETURN_MS + SIGNAL_REST_MS;

export type BulaoWordmarkProps = {
  /** Size in pixels or preset ("sm" = 22, "md" = 28, "lg" = 38, "xl" = 48). Defaults to "lg" (38). */
  size?: number | "sm" | "md" | "lg" | "xl";
  /** Brand color, defaults to #174C35 (forest green) */
  color?: string;
  /** Whether to show speech signal rays. Defaults to true. */
  withSignal?: boolean;
  /** Scales the animated signal rays above the final "o". */
  pinScale?: number;
  /** @deprecated The final letter is a regular text "o" and has no cutout. */
  pinHoleColor?: string;
  /** Speech signal color, defaults to lively emerald #20BF86 or color */
  signalColor?: string;
  /** Gently animate the signal rays above the final letter. */
  animateSignal?: boolean;
  /** Optional tagline rendered below the title */
  tagline?: string;
  /** Tagline color, defaults to #2E5240 */
  taglineColor?: string;
  /** Align items horizontally: "center" (default) | "flex-start" */
  align?: "center" | "flex-start";
  /** Container custom style */
  style?: StyleProp<ViewStyle>;
};

function resolveFontSize(size: number | "sm" | "md" | "lg" | "xl" | undefined): number {
  if (typeof size === "number") return size;
  switch (size) {
    case "sm": return 22;
    case "md": return 28;
    case "xl": return 48;
    case "lg":
    default: return 38;
  }
}

export function BulaoWordmark({
  size = "lg",
  color = loginTheme.primary,
  withSignal = true,
  pinScale = 1,
  signalColor,
  animateSignal = true,
  tagline,
  taglineColor = "#2E5240",
  align = "center",
  style,
}: BulaoWordmarkProps) {
  const signalStretchOne = useRef(new Animated.Value(1)).current;
  const signalStretchTwo = useRef(new Animated.Value(1)).current;
  const signalStretchThree = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animateSignal || !withSignal) return;
    const createStretch = (stretch: Animated.Value, phaseDelay: number) => Animated.loop(
      Animated.sequence([
        Animated.delay(phaseDelay),
        Animated.timing(stretch, {
          toValue: 1.45,
          duration: SIGNAL_STRETCH_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(stretch, {
          toValue: 0.82,
          duration: SIGNAL_RECOIL_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(stretch, {
          toValue: 1.08,
          duration: SIGNAL_SETTLE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(stretch, {
          toValue: 1,
          duration: SIGNAL_RETURN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(SIGNAL_REST_MS - phaseDelay),
      ])
    );
    const stretches = [
      createStretch(signalStretchOne, 0),
      createStretch(signalStretchTwo, SIGNAL_PHASE_STAGGER_MS),
      createStretch(signalStretchThree, SIGNAL_PHASE_STAGGER_MS * 2),
    ];
    stretches.forEach((stretch) => stretch.start());
    return () => stretches.forEach((stretch) => stretch.stop());
  }, [animateSignal, withSignal, signalStretchOne, signalStretchTwo, signalStretchThree]);

  const fontSize = resolveFontSize(size);
  const lineHeight = Math.round(fontSize * 1.16);
  const letterSpacing = Math.round(fontSize * 0.02 * 10) / 10; // e.g. 0.8 at 38px

  // Keep the animated rays at the same visual size and position as before,
  // while rendering the final letter as an ordinary lowercase "o".
  const pinSize = Math.round(fontSize * 0.58 * pinScale);
  const pinMarginLeft = Math.max(0, Math.round(fontSize * 0.08));
  const rowHeight = Math.round(fontSize * 1.25);

  // Three expressive rays above and to the right of the final letter.
  const effSignalColor = signalColor ?? (color === "#174C35" || color === "#0B5145" ? "#20BF86" : color);
  const strokeW = Math.max(1.3, Math.round(fontSize * pinScale * 0.042 * 10) / 10);
  const cx = pinSize / 2;
  const cy = pinSize / 2;
  const pinRadius = pinSize / 2;
  const rayGap = Math.max(2, Math.round(fontSize * pinScale * 0.065)); // spacing outside ray anchor
  const rStart = pinRadius + rayGap;

  // Lengths: middle ray is slightly longer for balanced prominence
  const lenSide = Math.max(4.5, Math.round(pinSize * 0.28)); // ~6px at 38
  const lenMid = Math.max(6.5, Math.round(pinSize * 0.40));  // ~9px at 38

  // Radiating angles (deg) pointing up & right like ///
  const degToRad = Math.PI / 180;
  const a1Deg = 26;
  const a2Deg = 45;
  const a3Deg = 64;

  const a1 = a1Deg * degToRad;
  const a2 = a2Deg * degToRad;
  const a3 = a3Deg * degToRad;

  // Ray 1 (lower diagonal)
  const rMid1 = rStart + lenSide / 2;
  const x1 = cx + rMid1 * Math.cos(a1);
  const y1 = cy - rMid1 * Math.sin(a1);

  // Ray 2 (middle diagonal, longer)
  const rMid2 = rStart + lenMid / 2;
  const x2 = cx + rMid2 * Math.cos(a2);
  const y2 = cy - rMid2 * Math.sin(a2);

  // Ray 3 (upper diagonal)
  const rMid3 = rStart + lenSide / 2;
  const x3 = cx + rMid3 * Math.cos(a3);
  const y3 = cy - rMid3 * Math.sin(a3);

  const rightBuffer = withSignal ? Math.max(6, Math.round(fontSize * 0.22)) : 0;
  const rayScaleOne = animateSignal ? signalStretchOne : 1;
  const rayScaleTwo = animateSignal ? signalStretchTwo : 1;
  const rayScaleThree = animateSignal ? signalStretchThree : 1;

  const taglineFontSize = Math.max(10, Math.round(fontSize * 0.32));
  const taglineMarginTop = Math.max(2, Math.round(fontSize * 0.1));

  return (
    <View style={[styles.container, align === "flex-start" && styles.alignStart, style]}>
      <View
        accessible
        accessibilityLabel="Bulao"
        accessibilityRole="image"
        style={[styles.wordmarkRow, { height: rowHeight, paddingRight: rightBuffer }]}
      >
        <Text
          accessible={false}
          allowFontScaling={false}
          style={[
            styles.wordmarkText,
            {
              fontSize,
              lineHeight,
              letterSpacing,
              color,
            },
          ]}
        >
          Bula
        </Text>

        {/* Regular text "o" with the animated signal rays retained above it. */}
        <View
          style={[
            styles.letterWrap,
            {
              width: Math.round(fontSize * 0.58),
              marginLeft: pinMarginLeft,
            },
          ]}
        >
          {/* Three Separate Expressive Speech Rays (/// radiating outward) */}
          {withSignal ? (
            <View
              pointerEvents="none"
              style={[styles.signalLayer, { width: pinSize, height: pinSize, top: Math.round((lineHeight - pinSize) / 2) }]}
            >
              {/* Ray 1: Lower diagonal stroke */}
              <Animated.View
                style={[
                  styles.speechRay,
                  {
                    width: lenSide,
                    height: strokeW,
                    borderRadius: strokeW / 2,
                    backgroundColor: effSignalColor,
                    left: x1 - lenSide / 2,
                    top: y1 - strokeW / 2,
                    transform: [{ rotate: `-${a1Deg}deg` }, { scaleX: rayScaleOne }],
                  },
                ]}
              />
              {/* Ray 2: Middle diagonal stroke (longer) */}
              <Animated.View
                style={[
                  styles.speechRay,
                  {
                    width: lenMid,
                    height: strokeW,
                    borderRadius: strokeW / 2,
                    backgroundColor: effSignalColor,
                    left: x2 - lenMid / 2,
                    top: y2 - strokeW / 2,
                    transform: [{ rotate: `-${a2Deg}deg` }, { scaleX: rayScaleTwo }],
                  },
                ]}
              />
              {/* Ray 3: Upper diagonal stroke */}
              <Animated.View
                style={[
                  styles.speechRay,
                  {
                    width: lenSide,
                    height: strokeW,
                    borderRadius: strokeW / 2,
                    backgroundColor: effSignalColor,
                    left: x3 - lenSide / 2,
                    top: y3 - strokeW / 2,
                    transform: [{ rotate: `-${a3Deg}deg` }, { scaleX: rayScaleThree }],
                  },
                ]}
              />
            </View>
          ) : null}

          <Text
            accessible={false}
            allowFontScaling={false}
            style={[styles.wordmarkText, { fontSize, lineHeight, letterSpacing, color }]}
          >
            o
          </Text>
        </View>
      </View>

      {tagline ? (
        <Text
          maxFontSizeMultiplier={1.2}
          style={[
            styles.tagline,
            {
              fontSize: taglineFontSize,
              marginTop: taglineMarginTop,
              color: taglineColor,
              textAlign: align === "flex-start" ? "left" : "center",
            },
          ]}
        >
          {tagline}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  alignStart: {
    alignItems: "flex-start",
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  wordmarkText: {
    fontWeight: "900",
    includeFontPadding: false,
  },
  letterWrap: { position: "relative", justifyContent: "center", overflow: "visible" },
  signalLayer: { position: "absolute", left: 0 },
  speechRay: {
    position: "absolute",
  },
  tagline: {
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
