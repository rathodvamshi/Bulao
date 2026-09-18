/**
 * LocationSheet — Swiggy-style location selection
 *
 * Uses React Native Modal so it always renders above everything,
 * no BottomSheet library issues in Expo Go.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Dimensions,
  Easing,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import { useLocation } from "../store/location";
import { locationApi } from "../api/locationApi";
import { useAuth } from "../auth";
import { colors } from "./ui";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.68;

export function LocationSheet() {
  const {
    savedLocations,
    setSavedLocations,
    setLocation,
    isLocationSheetVisible,
    setLocationSheetVisible,
  } = useLocation();

  const [isLocating, setIsLocating] = useState(false);
  const [mounted, setMounted] = useState(isLocationSheetVisible);
  const { status, session } = useAuth();

  // Animation values for smooth in-and-out flow
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  const animateIn = useCallback(() => {
    isClosingRef.current = false;
    setMounted(true);
    translateY.setValue(SHEET_HEIGHT);
    backdropOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        mass: 0.85,
        stiffness: 220,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const animateOut = useCallback(
    (onComplete?: () => void) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_HEIGHT,
          duration: 230,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setMounted(false);
          setLocationSheetVisible(false);
          isClosingRef.current = false;
          onComplete?.();
        }
      });
    },
    [translateY, backdropOpacity, setLocationSheetVisible]
  );

  // Animate open/close when visibility changes
  useEffect(() => {
    if (isLocationSheetVisible) {
      animateIn();
    } else if (mounted) {
      animateOut();
    }
  }, [isLocationSheetVisible, animateIn, animateOut, mounted]);

  // Auto-show sheet whenever the app opens and user is authenticated with no location set.
  // Because the location is persisted in secure storage via zustand, if they previously
  // chose a location it will be restored and this will NOT trigger.
  const locationFromStore = useLocation((s) => s.location);
  useEffect(() => {
    if (status === "authenticated" && !locationFromStore) {
      // Small delay so the home screen fully renders first
      const timer = setTimeout(() => {
        setLocationSheetVisible(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [status, locationFromStore, setLocationSheetVisible]);

  // Fetch saved locations after authentication
  useEffect(() => {
    if (status !== "authenticated" || !session?.token) return;
    locationApi
      .getSavedLocations(session.token)
      .then(setSavedLocations)
      .catch(() => {
        // Non-critical — silently ignore if endpoint not ready
      });
  }, [status, session?.token, setSavedLocations]);

  const dismiss = useCallback(
    (onComplete?: () => void) => {
      animateOut(onComplete);
    },
    [animateOut]
  );

  // PanResponder to allow dragging down to dismiss smoothly
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 4,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 240,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status: permStatus, canAskAgain } =
        await Location.requestForegroundPermissionsAsync();

      if (permStatus !== "granted") {
        if (!canAskAgain) {
          Alert.alert(
            "Permission Denied",
            "Location permissions are permanently denied. Please enable them in Settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert(
            "Permission Required",
            "Please grant location access to use your current location."
          );
        }
        setIsLocating(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      const area =
        geo?.district ||
        geo?.city ||
        geo?.subregion ||
        geo?.region ||
        "Current Location";

      setLocation({
        area,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      dismiss();
    } catch {
      Alert.alert(
        "Error",
        "Could not fetch your location. Make sure location services are on."
      );
    } finally {
      setIsLocating(false);
    }
  };

  if (!mounted && !isLocationSheetVisible) {
    return null;
  }

  return (
    <Modal
      visible={mounted || isLocationSheetVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => dismiss()}
    >
      {/* Animated Fade Backdrop */}
      <Animated.View style={[styles.backdropWrap, { opacity: backdropOpacity }]}>
        <Pressable style={styles.backdrop} onPress={() => dismiss()} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
        {/* Drag handle area with pan responder for fluid swipe-down dismissal */}
        <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
          <View style={styles.handle} />
        </View>

        {/* Title row with close icon at right corner beside the title */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Choose your work location</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => dismiss()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [
              styles.closeBtn,
              { opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
          >
            <Ionicons name="close" size={16} color="#000000" />
          </Pressable>
        </View>

        {/* Use current location */}
        <Pressable
          onPress={handleUseCurrentLocation}
          disabled={isLocating}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={[styles.pillContainer, { borderColor: colors.green, marginBottom: 12 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.optionTitle, { color: colors.green }]}>
                Use current location
              </Text>
              <Text style={styles.optionSub}>Auto-detect via GPS</Text>
            </View>
            <View style={[styles.iconRightBubble, { backgroundColor: colors.greenLight }]}>
              {isLocating ? (
                <ActivityIndicator color={colors.green} size="small" />
              ) : (
                <Ionicons name="locate" size={20} color={colors.green} />
              )}
            </View>
          </View>
        </Pressable>

        {/* Search manually */}
        <Pressable
          onPress={() => {
            dismiss(() => {
              router.push("/location-search");
            });
          }}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={[styles.pillContainer, { marginBottom: 16 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.optionTitle}>Search by area or address</Text>
              <Text style={styles.optionSub}>Find a specific location</Text>
            </View>
            <View style={styles.iconRightBubble}>
              <Ionicons name="search" size={20} color={colors.ink} />
            </View>
          </View>
        </Pressable>

        {/* Saved locations */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.sectionLabel}>SAVED LOCATIONS</Text>
          
          {savedLocations.length > 0 ? (
            savedLocations.slice(0, 3).map((loc) => (
              <Pressable
                key={loc.id}
                onPress={() => {
                  setLocation(loc);
                  dismiss();
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={[styles.pillContainer, { marginBottom: 10 }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.savedLabel}>{loc.label}</Text>
                    <Text style={styles.savedAddress} numberOfLines={1}>
                      {loc.address}
                    </Text>
                  </View>
                  <View style={styles.iconRightBubble}>
                    <Ionicons
                      name={
                        loc.label === "Home"
                          ? "home"
                          : loc.label === "Work"
                          ? "briefcase"
                          : "location"
                      }
                      size={18}
                      color={colors.ink}
                    />
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={styles.emptySaved}>
              <Text style={styles.emptySavedText}>No saved locations yet</Text>
            </View>
          )}

          {/* Add new location shortcut */}
          <Pressable
            onPress={() => {
              dismiss();
              router.push("/location-search");
            }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={[styles.pillContainer, { borderStyle: "dashed", marginTop: 4 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.savedLabel}>Add New Location</Text>
                <Text style={styles.optionSub}>Save a new preset</Text>
              </View>
              <View style={[styles.iconRightBubble, { backgroundColor: colors.paper }]}>
                <Ionicons name="add" size={20} color={colors.ink} />
              </View>
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  dragHandleArea: {
    width: "100%",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 44,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: colors.line,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
    flex: 1,
    flexShrink: 1,
    paddingRight: 10,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#000000",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pillContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16, // Cylindrical shape
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#fff",
  },
  iconRightBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  optionSub: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.mutedLight,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  savedLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  savedAddress: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 2,
  },
  emptySaved: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  emptySavedText: {
    fontSize: 14,
    color: colors.mutedLight,
    fontStyle: "italic",
  },
});
