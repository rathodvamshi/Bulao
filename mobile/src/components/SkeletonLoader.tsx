import { View, StyleSheet, Animated, Easing } from "react-native";
import { useEffect, useRef } from "react";
import { colors } from "./ui";

// ─── Base Skeleton Component ──────────────────────────────────────────────────
export function Skeleton({
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
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnimation]);

  const opacity = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.line,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── Skeleton Circle (for avatars, icons) ─────────────────────────────────────
export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
}

// ─── Provider Stats Skeleton ──────────────────────────────────────────────────
export function YourHiringsSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      {/* Section Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Skeleton width={130} height={24} borderRadius={6} />
        <Skeleton width={80} height={20} borderRadius={6} />
      </View>

      {/* Stats Cards */}
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
            <Skeleton width={32} height={28} borderRadius={6} />
            <Skeleton width="70%" height={12} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Recent Jobs Skeleton ─────────────────────────────────────────────────────
export function RecentJobsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 32 }}>
      {/* Section Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Skeleton width={130} height={24} borderRadius={6} />
        <Skeleton width={80} height={20} borderRadius={6} />
      </View>

      {/* Job Cards */}
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
            {/* Icon Placeholder */}
            <SkeletonCircle size={70} />

            {/* Content */}
            <View style={{ flex: 1, justifyContent: "space-between", gap: 8 }}>
              {/* Title */}
              <Skeleton width="80%" height={18} borderRadius={4} />

              {/* Location */}
              <Skeleton width="60%" height={14} borderRadius={4} />

              {/* Tags Row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Skeleton width={80} height={24} borderRadius={12} />
                <Skeleton width={60} height={24} borderRadius={12} />
              </View>
            </View>

            {/* Arrow Placeholder */}
            <View style={{ justifyContent: "center" }}>
              <SkeletonCircle size={20} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Job List Item Skeleton (reusable) ────────────────────────────────────────
export function JobCardSkeleton() {
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
      <SkeletonCircle size={70} />
      <View style={{ flex: 1, justifyContent: "space-between", gap: 8 }}>
        <Skeleton width="80%" height={18} borderRadius={4} />
        <Skeleton width="60%" height={14} borderRadius={4} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Skeleton width={80} height={24} borderRadius={12} />
          <Skeleton width={60} height={24} borderRadius={12} />
        </View>
      </View>
      <SkeletonCircle size={20} />
    </View>
  );
}

// ─── Profile Header Skeleton ──────────────────────────────────────────────────
export function ProfileHeaderSkeleton() {
  return (
    <View style={{ alignItems: "center", gap: 16, paddingVertical: 24 }}>
      <SkeletonCircle size={100} />
      <View style={{ alignItems: "center", gap: 8 }}>
        <Skeleton width={150} height={24} borderRadius={6} />
        <Skeleton width={200} height={16} borderRadius={4} />
      </View>
    </View>
  );
}

// ─── List Item Skeleton (generic) ─────────────────────────────────────────────
export function ListItemSkeleton() {
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
      <SkeletonCircle size={48} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="70%" height={18} borderRadius={4} />
        <Skeleton width="50%" height={14} borderRadius={4} />
      </View>
      <SkeletonCircle size={20} />
    </View>
  );
}

// ─── Form Field Skeleton ──────────────────────────────────────────────────────
export function FormFieldSkeleton() {
  return (
    <View style={{ gap: 8 }}>
      <Skeleton width={100} height={16} borderRadius={4} />
      <Skeleton width="100%" height={54} borderRadius={14} />
    </View>
  );
}

// ─── Card Content Skeleton ────────────────────────────────────────────────────
export function CardSkeleton({
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
      {showHeader && <Skeleton width="60%" height={20} borderRadius={6} />}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? "80%" : "100%"}
          height={16}
          borderRadius={4}
        />
      ))}
    </View>
  );
}

// ─── Search Bar Skeleton ──────────────────────────────────────────────────────
export function SearchBarSkeleton() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
      }}
    >
      <Skeleton width="100%" height={54} borderRadius={27} />
    </View>
  );
}

// ─── Grid Item Skeleton (for categories, services) ────────────────────────────
export function GridItemSkeleton() {
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
      <SkeletonCircle size={56} />
      <Skeleton width="80%" height={16} borderRadius={4} />
      <Skeleton width="60%" height={12} borderRadius={4} />
    </View>
  );
}

// ─── Hero Section Skeleton ────────────────────────────────────────────────────
export function HeroSkeleton() {
  return (
    <View style={{ width: "100%", marginTop: 0 }}>
      <Skeleton
        width="100%"
        height={200}
        borderRadius={16}
        style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
      />
    </View>
  );
}

// ─── Full Screen Skeleton (for entire loading states) ────────────────────────
export function FullScreenSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, padding: 16 }}>
      <View style={{ gap: 24 }}>
        <Skeleton width="60%" height={32} borderRadius={8} />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
        <View style={{ gap: 12 }}>
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: "hidden",
  },
});
