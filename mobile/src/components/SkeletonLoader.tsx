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

// ─── Activity / Provider Jobs Listing Skeleton ──────────────────────────────
export function ActivityJobSkeleton() {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        gap: 14,
      }}
    >
      {/* Top Header Row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
          <Skeleton width={44} height={44} borderRadius={12} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Skeleton width="55%" height={16} borderRadius={6} />
              <Skeleton width={64} height={20} borderRadius={10} />
            </View>
            <Skeleton width="40%" height={12} borderRadius={4} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Skeleton width={56} height={26} borderRadius={13} />
          <Skeleton width={26} height={26} borderRadius={13} />
        </View>
      </View>

      {/* Grid Specs Row */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#F9FAFB",
          borderRadius: 12,
          padding: 12,
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width={50} height={10} borderRadius={3} />
          <Skeleton width={80} height={16} borderRadius={4} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width={70} height={10} borderRadius={3} />
          <Skeleton width={90} height={16} borderRadius={4} />
        </View>
      </View>

      {/* Footer Action Bar */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
        <Skeleton width={110} height={28} borderRadius={14} />
        <Skeleton width={90} height={32} borderRadius={8} />
      </View>
    </View>
  );
}

// ─── Job Detail Screen Skeleton ─────────────────────────────────────────────
export function JobDetailSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: "#F4F7F5" }}>
      {/* Top Header Placeholder */}
      <View style={{ height: 180, backgroundColor: "#075B43", padding: 20, justifyContent: "flex-end" }}>
        <View style={{ gap: 8, opacity: 0.85 }}>
          <Skeleton width={90} height={18} borderRadius={9} style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
          <Skeleton width="75%" height={26} borderRadius={6} style={{ backgroundColor: "rgba(255,255,255,0.3)" }} />
          <Skeleton width="45%" height={16} borderRadius={4} style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
        </View>
      </View>

      {/* Content Container */}
      <View style={{ padding: 16, gap: 16, marginTop: -20 }}>
        {/* Main Details Card */}
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 18,
            padding: 18,
            gap: 14,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ gap: 6 }}>
              <Skeleton width={70} height={12} borderRadius={4} />
              <Skeleton width={120} height={22} borderRadius={6} />
            </View>
            <Skeleton width={100} height={36} borderRadius={18} />
          </View>
          <View style={{ height: 1, backgroundColor: "#EEF2F0", marginVertical: 4 }} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Skeleton width="48%" height={40} borderRadius={8} />
            <Skeleton width="48%" height={40} borderRadius={8} />
          </View>
        </View>

        {/* Map / Location Placeholder */}
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 18,
            padding: 16,
            gap: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Skeleton width={140} height={18} borderRadius={4} />
          <Skeleton width="100%" height={130} borderRadius={12} />
        </View>

        {/* Requirements Card */}
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: 18,
            padding: 16,
            gap: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Skeleton width={120} height={16} borderRadius={4} />
          <Skeleton width="90%" height={14} borderRadius={4} />
          <Skeleton width="80%" height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

// ─── Provider Profile Screen Skeleton ───────────────────────────────────────
export function ProfileScreenSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingHorizontal: 16 }}>
      {/* Identity Card Placeholder */}
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 20,
          padding: 20,
          marginTop: 16,
          alignItems: "center",
          gap: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <SkeletonCircle size={84} />
        <Skeleton width={160} height={22} borderRadius={6} />
        <Skeleton width={120} height={14} borderRadius={4} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <Skeleton width={100} height={24} borderRadius={12} />
          <Skeleton width={90} height={24} borderRadius={12} />
        </View>
      </View>

      {/* Stats Quad Placeholder */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 16,
          gap: 8,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: colors.white,
              borderRadius: 14,
              padding: 12,
              alignItems: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Skeleton width={28} height={22} borderRadius={6} />
            <Skeleton width="80%" height={10} borderRadius={3} />
          </View>
        ))}
      </View>

      {/* Trust & Badges Card Placeholder */}
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 18,
          padding: 16,
          marginTop: 16,
          gap: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <Skeleton width={140} height={18} borderRadius={4} />
        <Skeleton width="100%" height={56} borderRadius={12} />
        <Skeleton width="100%" height={56} borderRadius={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: "hidden",
  },
});
