import { AppText as Text } from "./AppText";
import { AppPressable as Pressable } from "./AppPressable";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppImage } from "./AppImage";

export interface JobThumbnailCarouselProps {
  images?: string[] | null;
  categoryId?: string | null;
  categoryName?: string | null;
  roleIcon?: string | null;
  size?: number;
  onPress?: () => void;
}

export function getCategoryVisual(
  categoryId?: string | null,
  categoryName?: string | null,
) {
  const key = String(categoryId || categoryName || "").toLowerCase();

  if (
    key.includes("tuition") ||
    key.includes("tutor") ||
    key.includes("math")
  ) {
    return {
      bg: "#E0F2FE", // Soft pastel sky blue
      color: "#0284C7",
      icon: "school-outline" as const,
      label: "Tuition",
    };
  }
  if (
    key.includes("education") ||
    key.includes("train") ||
    key.includes("learn")
  ) {
    return {
      bg: "#FCE7F3", // Soft pastel pink
      color: "#DB2777",
      icon: "book-outline" as const,
      label: "Education",
    };
  }
  if (
    key.includes("house") ||
    key.includes("maid") ||
    key.includes("clean") ||
    key.includes("electric") ||
    key.includes("plumb") ||
    key.includes("repair") ||
    key.includes("service")
  ) {
    return {
      bg: "#DCFCE7", // Soft pastel mint
      color: "#16A34A",
      icon: "construct-outline" as const,
      label: "Home Services",
    };
  }
  if (
    key.includes("construct") ||
    key.includes("build") ||
    key.includes("mason")
  ) {
    return {
      bg: "#FFEDD5", // Soft pastel peach / orange
      color: "#EA580C",
      icon: "hammer-outline" as const,
      label: "Construction",
    };
  }
  if (
    key.includes("shop") ||
    key.includes("business") ||
    key.includes("help") ||
    key.includes("general")
  ) {
    return {
      bg: "#FEF3C7", // Soft pastel amber
      color: "#D97706",
      icon: "person-outline" as const,
      label: "General Help",
    };
  }
  if (key.includes("food") || key.includes("kitchen") || key.includes("cook")) {
    return {
      bg: "#FEE2E2", // Soft pastel red
      color: "#DC2626",
      icon: "restaurant-outline" as const,
      label: "Food & Kitchen",
    };
  }
  if (key.includes("event") || key.includes("party")) {
    return {
      bg: "#F3E8FF", // Soft pastel purple
      color: "#9333EA",
      icon: "calendar-outline" as const,
      label: "Events",
    };
  }

  return {
    bg: "#E8F5EE", // Soft Bulao pale green
    color: "#0F6B48",
    icon: "briefcase-outline" as const,
    label: "Work",
  };
}

export function JobThumbnailCarousel({
  images,
  categoryId,
  categoryName,
  roleIcon,
  size = 76,
  onPress,
}: JobThumbnailCarouselProps) {
  const [index, setIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  // Filter valid image URLs
  const validImages = Array.isArray(images)
    ? images.filter(
        (img) =>
          typeof img === "string" &&
          img.trim().length > 0 &&
          !failedImages.includes(img),
      )
    : [];

  const total = validImages.length;
  useEffect(() => {
    setFailedImages([]);
  }, [images?.join(",")]);

  // Reset index when images array changes
  useEffect(() => {
    setIndex(0);
    setHasError(false);
  }, [validImages.join(",")]);

  const handlePrev = useCallback(
    (e?: GestureResponderEvent) => {
      e?.stopPropagation?.();
      setIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
    },
    [total],
  );

  const handleNext = useCallback(
    (e?: GestureResponderEvent) => {
      e?.stopPropagation?.();
      setIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
    },
    [total],
  );

  // Horizontal swipe responder for thumbnail
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (
      _,
      gestureState: PanResponderGestureState,
    ) => {
      return (
        total > 1 &&
        Math.abs(gestureState.dx) > 12 &&
        Math.abs(gestureState.dy) < 15
      );
    },
    onPanResponderRelease: (_, gestureState: PanResponderGestureState) => {
      if (gestureState.dx < -20) {
        handleNext();
      } else if (gestureState.dx > 20) {
        handlePrev();
      }
    },
  });

  const visual = getCategoryVisual(categoryId, categoryName);

  // Case 1: No images or loading error -> Render category work icon on soft pastel background
  if (total === 0 || hasError) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.container,
          { width: size, height: size, backgroundColor: visual.bg },
        ]}
        accessibilityRole="image"
        accessibilityLabel={`${categoryName || visual.label} work icon`}
      >
        <Ionicons
          name={visual.icon}
          size={Math.round(size * 0.44)}
          color={visual.color}
        />
      </Pressable>
    );
  }

  // Case 2: One uploaded job image -> Fixed thumbnail, no carousel controls
  if (total === 1) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.container, { width: size, height: size }]}
        accessibilityRole="image"
        accessibilityLabel="Job image thumbnail"
      >
        <AppImage
          source={{ uri: validImages[0] }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setHasError(true)}
        />
        {loading && (
          <View style={styles.centerOverlay}>
            <ActivityIndicator size="small" color="#03402D" />
          </View>
        )}
      </Pressable>
    );
  }

  // Case 3: Multiple uploaded images -> Swipeable thumbnail with compact "< 1/3 >" overlay
  const currentImage = validImages[index] || validImages[0];

  return (
    <View
      {...panResponder.panHandlers}
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={`Job image ${index + 1} of ${total}`}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
        <AppImage
          source={{ uri: currentImage }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            if (currentImage)
              setFailedImages((failed) => [...failed, currentImage]);
          }}
        />
      </Pressable>

      {loading && (
        <View style={styles.centerOverlay}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}

      {/* Subtle compact bottom overlay pill: < 1/3 > */}
      <View style={styles.counterPill}>
        <Pressable
          hitSlop={6}
          onPress={handlePrev}
          style={styles.pillArrow}
          accessibilityLabel="Previous image"
        >
          <Ionicons name="chevron-back" size={11} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.counterText}>
          {index + 1}/{total}
        </Text>

        <Pressable
          hitSlop={6}
          onPress={handleNext}
          style={styles.pillArrow}
          accessibilityLabel="Next image"
        >
          <Ionicons name="chevron-forward" size={11} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F5F4",
    borderWidth: 1,
    borderColor: "#E5EBE7",
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  counterPill: {
    position: "absolute",
    bottom: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(13, 35, 24, 0.75)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  pillArrow: {
    padding: 1,
  },
  counterText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
});
