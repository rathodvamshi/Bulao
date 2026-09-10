import { View, StyleSheet, Animated, Easing } from "react-native";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "./ui";

/**
 * Enhanced Skeleton with Shimmer Wave Effect
 * 
 * This creates a more sophisticated loading animation with a gradient wave
 * that sweeps across the skeleton for a premium feel
 */

export function SkeletonShimmer({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
}: {
  width?: string | number;
  height?: number;
  borderRadius?: number;
  style?: any;
}) {
  const shimmerAnimation = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnimation, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnimation]);

  // Calculate translateX based on width
  const numericWidth = typeof width === "number" ? width : 300;
  
  const translateX = shimmerAnimation.interpolate({
    inputRange: [-1, 1],
    outputRange: [-numericWidth, numericWidth],
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.line,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: "100%",
          height: "100%",
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={[
            "rgba(255,255,255,0)",
            "rgba(255,255,255,0.5)",
            "rgba(255,255,255,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flex: 1,
            width: numericWidth * 2,
          }}
        />
      </Animated.View>
    </View>
  );
}

// ─── Shimmer Circle ───────────────────────────────────────────────────────────
export function SkeletonShimmerCircle({ size = 40 }: { size?: number }) {
  return <SkeletonShimmer width={size} height={size} borderRadius={size / 2} />;
}

// ─── Provider Stats with Shimmer ──────────────────────────────────────────────
export function YourHiringsSkeletonShimmer() {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <SkeletonShimmer width={130} height={24} borderRadius={6} />
        <SkeletonShimmer width={80} height={20} borderRadius={6} />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {[1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={{
              backgroundColor: colors.white,
              borderRadius: 14,
              paddingTop: 12,
              paddingHorizontal: 12,
              paddingBottom: 8,
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 85,
              gap: 8,
            }}
          >
            <SkeletonShimmer width={32} height={28} borderRadius={6} />
            <SkeletonShimmer width="70%" height={12} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Recent Jobs with Shimmer ─────────────────────────────────────────────────
export function RecentJobsSkeletonShimmer({ count = 3 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 32 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <SkeletonShimmer width={130} height={24} borderRadius={6} />
        <SkeletonShimmer width={80} height={20} borderRadius={6} />
      </View>

      <View style={{ gap: 12 }}>
        {Array.from({ length: count }).map((_, index) => (
          <View
            key={index}
            style={{
              backgroundColor: colors.white,
              borderRadius: 18,
              padding: 14,
              flexDirection: "row",
              gap: 14,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <SkeletonShimmerCircle size={70} />
            <View style={{ flex: 1, justifyContent: "space-between", gap: 8 }}>
              <SkeletonShimmer width="80%" height={18} borderRadius={4} />
              <SkeletonShimmer width="60%" height={14} borderRadius={4} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <SkeletonShimmer width={80} height={24} borderRadius={12} />
                <SkeletonShimmer width={60} height={24} borderRadius={12} />
              </View>
            </View>
            <SkeletonShimmerCircle size={20} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Job Card with Shimmer ────────────────────────────────────────────────────
export function JobCardSkeletonShimmer() {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 18,
        padding: 14,
        flexDirection: "row",
        gap: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <SkeletonShimmerCircle size={70} />
      <View style={{ flex: 1, justifyContent: "space-between", gap: 8 }}>
        <SkeletonShimmer width="80%" height={18} borderRadius={4} />
        <SkeletonShimmer width="60%" height={14} borderRadius={4} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SkeletonShimmer width={80} height={24} borderRadius={12} />
          <SkeletonShimmer width={60} height={24} borderRadius={12} />
        </View>
      </View>
      <SkeletonShimmerCircle size={20} />
    </View>
  );
}

// ─── Profile Header with Shimmer ──────────────────────────────────────────────
export function ProfileHeaderSkeletonShimmer() {
  return (
    <View style={{ alignItems: "center", gap: 16, paddingVertical: 24 }}>
      <SkeletonShimmerCircle size={100} />
      <View style={{ alignItems: "center", gap: 8 }}>
        <SkeletonShimmer width={150} height={24} borderRadius={6} />
        <SkeletonShimmer width={200} height={16} borderRadius={4} />
      </View>
    </View>
  );
}

// ─── List Item with Shimmer ───────────────────────────────────────────────────
export function ListItemSkeletonShimmer() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
        backgroundColor: colors.white,
        borderRadius: 12,
      }}
    >
      <SkeletonShimmerCircle size={48} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonShimmer width="70%" height={18} borderRadius={4} />
        <SkeletonShimmer width="50%" height={14} borderRadius={4} />
      </View>
      <SkeletonShimmerCircle size={20} />
    </View>
  );
}

// ─── Card with Shimmer ────────────────────────────────────────────────────────
export function CardSkeletonShimmer({
  lines = 3,
  showHeader = false,
}: {
  lines?: number;
  showHeader?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 22,
        padding: 22,
        gap: 12,
      }}
    >
      {showHeader && <SkeletonShimmer width="60%" height={20} borderRadius={6} />}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonShimmer
          key={i}
          width={i === lines - 1 ? "80%" : "100%"}
          height={16}
          borderRadius={4}
        />
      ))}
    </View>
  );
}

// ─── Grid Item with Shimmer ───────────────────────────────────────────────────
export function GridItemSkeletonShimmer() {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 16,
        gap: 12,
        alignItems: "center",
        flex: 1,
        minWidth: 100,
      }}
    >
      <SkeletonShimmerCircle size={56} />
      <SkeletonShimmer width="80%" height={16} borderRadius={4} />
      <SkeletonShimmer width="60%" height={12} borderRadius={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  shimmerContainer: {
    overflow: "hidden",
  },
});
