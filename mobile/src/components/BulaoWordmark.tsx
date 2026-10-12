import React from "react";
import { StyleSheet, View, Text, type StyleProp, type ViewStyle } from "react-native";
import { loginTheme } from "../features/auth/loginTheme";

export type BulaoWordmarkProps = {
  /** Size in pixels or preset ("sm" = 22, "md" = 28, "lg" = 38, "xl" = 48). Defaults to "lg" (38). */
  size?: number | "sm" | "md" | "lg" | "xl";
  /** Brand color, defaults to #174C35 (forest green) */
  color?: string;
  /** Whether to show speech signal rays. Defaults to true. */
  withSignal?: boolean;
  /** Speech signal color, defaults to lively emerald #20BF86 or color */
  signalColor?: string;
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
  signalColor,
  tagline,
  taglineColor = "#2E5240",
  align = "center",
  style,
}: BulaoWordmarkProps) {
  const fontSize = resolveFontSize(size);
  const lineHeight = Math.round(fontSize * 1.16);
  const letterSpacing = Math.round(fontSize * 0.02 * 10) / 10; // e.g. 0.8 at 38px

  // Mathematically scaled location pin letter-O proportions
  const pinSize = Math.round(fontSize * 0.58); // 22px at 38
  const holeSize = Math.max(4, Math.round(pinSize * 0.36)); // ~8px at 22
  const tipHalfWidth = Math.max(2.5, Math.round(pinSize * 0.2)); // ~4.5px at 22
  const tipHeight = Math.max(3, Math.round(pinSize * 0.25)); // ~5.5px at 22
  const pinMarginLeft = Math.max(1.5, Math.round(fontSize * 0.08)); // ~3px at 38
  const pinMarginTop = Math.max(2, Math.round(fontSize * 0.1)); // ~4px at 38
  const rowHeight = Math.round(fontSize * 1.25);

  // Three Expressive Speech Rays (/// radiating from the upper-right of the pin)
  const effSignalColor = signalColor ?? (color === "#174C35" || color === "#0B5145" ? "#20BF86" : color);
  const strokeW = Math.max(1.3, Math.round(fontSize * 0.042 * 10) / 10); // ~1.6px at 38
  const cx = pinSize / 2;
  const cy = pinSize / 2;
  const pinRadius = pinSize / 2;
  const rayGap = Math.max(2, Math.round(fontSize * 0.065)); // spacing outside pin
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

        {/* Custom Geometric Location Pin Letter "o" with Speech Signal Rays */}
        <View
          style={[
            styles.pinWrap,
            {
              width: pinSize,
              marginLeft: pinMarginLeft,
              marginTop: pinMarginTop,
            },
          ]}
        >
          {/* Three Separate Expressive Speech Rays (/// radiating outward) */}
          {withSignal ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* Ray 1: Lower diagonal stroke */}
              <View
                style={[
                  styles.speechRay,
                  {
                    width: lenSide,
                    height: strokeW,
                    borderRadius: strokeW / 2,
                    backgroundColor: effSignalColor,
                    left: x1 - lenSide / 2,
                    top: y1 - strokeW / 2,
                    transform: [{ rotate: `-${a1Deg}deg` }],
                  },
                ]}
              />
              {/* Ray 2: Middle diagonal stroke (longer) */}
              <View
                style={[
                  styles.speechRay,
                  {
                    width: lenMid,
                    height: strokeW,
                    borderRadius: strokeW / 2,
                    backgroundColor: effSignalColor,
                    left: x2 - lenMid / 2,
                    top: y2 - strokeW / 2,
                    transform: [{ rotate: `-${a2Deg}deg` }],
                  },
                ]}
              />
              {/* Ray 3: Upper diagonal stroke */}
              <View
                style={[
                  styles.speechRay,
                  {
                    width: lenSide,
                    height: strokeW,
                    borderRadius: strokeW / 2,
                    backgroundColor: effSignalColor,
                    left: x3 - lenSide / 2,
                    top: y3 - strokeW / 2,
                    transform: [{ rotate: `-${a3Deg}deg` }],
                  },
                ]}
              />
            </View>
          ) : null}

          <View
            style={[
              styles.pinCircle,
              {
                width: pinSize,
                height: pinSize,
                borderRadius: pinSize / 2,
                backgroundColor: color,
              },
            ]}
          >
            <View
              style={[
                styles.pinHole,
                {
                  width: holeSize,
                  height: holeSize,
                  borderRadius: holeSize / 2,
                },
              ]}
            />
          </View>
          <View
            style={[
              styles.pinPointer,
              {
                borderLeftWidth: tipHalfWidth,
                borderRightWidth: tipHalfWidth,
                borderTopWidth: tipHeight,
                borderTopColor: color,
              },
            ]}
          />
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
  pinWrap: {
    alignItems: "center",
  },
  speechRay: {
    position: "absolute",
  },
  pinCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinHole: {
    backgroundColor: "#FFFFFF",
  },
  pinPointer: {
    width: 0,
    height: 0,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
  tagline: {
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
