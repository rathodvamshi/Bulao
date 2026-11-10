import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppImage as Image } from "../../../../components/AppImage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface FullScreenImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function FullScreenImageViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: FullScreenImageViewerProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  React.useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: currentIndex * screenWidth, y: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, currentIndex, screenWidth]);

  if (!images || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Top Controls Header */}
        <View style={[styles.headerRow, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {images.length}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close viewer"
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Swipeable Slides */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const offset = e.nativeEvent.contentOffset.x;
            const idx = Math.round(offset / screenWidth);
            setCurrentIndex(idx);
          }}
        >
          {images.map((uri, idx) => (
            <View key={`${uri}-${idx}`} style={[styles.slide, { width: screenWidth, height: screenHeight - insets.top - insets.bottom - 60 }]}>
              <Image
                source={{ uri }}
                style={[styles.fullImage, { width: screenWidth }]}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#000000",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  counterText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    height: "100%",
  },
});
