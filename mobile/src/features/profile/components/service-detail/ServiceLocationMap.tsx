import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

export interface ServiceLocationMapProps {
  latitude?: number | null;
  longitude?: number | null;
  areaName: string;
  distanceAwayText?: string;
  serviceTitle: string;
}

export function ServiceLocationMap({
  latitude,
  longitude,
  areaName,
  distanceAwayText = "0.5 km away",
  serviceTitle,
}: ServiceLocationMapProps) {
  const mapRef = useRef<MapView>(null);
  const animatedRef = useRef<boolean>(false);

  // Validate coordinates: must be finite, non-zero, within physical latitude/longitude ranges
  const hasCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude !== 0 &&
    longitude !== 0 &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  const validLat = hasCoordinates ? (latitude as number) : 17.385;
  const validLng = hasCoordinates ? (longitude as number) : 78.4867;

  // Initial smooth camera focus without repeating on re-renders
  useEffect(() => {
    if (!animatedRef.current && hasCoordinates && mapRef.current) {
      animatedRef.current = true;
      const timer = setTimeout(() => {
        mapRef.current?.animateCamera(
          {
            center: { latitude: validLat, longitude: validLng },
            zoom: 16.5,
          },
          { duration: 800 }
        );
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [hasCoordinates, validLat, validLng]);

  const handleOpenDirections = () => {
    const label = encodeURIComponent(serviceTitle || areaName);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${validLat},${validLng}`,
      android: `geo:0,0?q=${validLat},${validLng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${validLat},${validLng}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${validLat},${validLng}`);
    });
  };

  return (
    <View style={styles.card}>
      {hasCoordinates ? (
        <View style={styles.mapArea}>
          {Platform.OS !== "web" ? (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: validLat,
                longitude: validLng,
                latitudeDelta: 0.0035,
                longitudeDelta: 0.0035,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              pointerEvents="none"
            >
              <Marker
                coordinate={{ latitude: validLat, longitude: validLng }}
                anchor={{ x: 0.5, y: 1.0 }}
              >
                <View style={styles.customMarkerContainer}>
                  <View style={styles.markerCircle}>
                    <Ionicons name="location" size={18} color="#047857" />
                  </View>
                  <View style={styles.markerTriangle} />
                  <View style={styles.markerDotShadow} />
                </View>
              </Marker>
            </MapView>
          ) : (
            <View style={styles.webFallbackBox}>
              <Ionicons name="map-outline" size={36} color="#047857" />
              <Text style={styles.webFallbackText}>{areaName}</Text>
            </View>
          )}

          {/* Floating Top-Left Area Pill */}
          <View style={styles.topLeftPill}>
            <Ionicons name="location-sharp" size={12} color="#047857" />
            <Text style={styles.topLeftText} numberOfLines={1}>
              {areaName}
            </Text>
          </View>

          {/* Floating Top-Right Distance Pill */}
          {Boolean(distanceAwayText) && (
            <View style={styles.topRightPill}>
              <Ionicons name="navigate-circle" size={12} color="#047857" />
              <Text style={styles.topRightText}>{distanceAwayText}</Text>
            </View>
          )}
        </View>
      ) : (
        /* Graceful Address Fallback when coordinates are missing/unavailable */
        <View style={styles.addressFallbackBox}>
          <View style={styles.fallbackIconHalo}>
            <Ionicons name="location" size={20} color="#047857" />
          </View>
          <View style={styles.fallbackTextCol}>
            <Text style={styles.fallbackTitleText}>{areaName}</Text>
            <Text style={styles.fallbackSubtext}>
              Registered provider service area in {areaName}
            </Text>
          </View>
        </View>
      )}

      {/* Full-Width Get Directions Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Get Directions on Google Maps"
        style={styles.directionsBtn}
        onPress={handleOpenDirections}
      >
        <Ionicons name="navigate" size={15} color="#FFFFFF" />
        <Text style={styles.directionsBtnText}>Get Directions</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  mapArea: {
    height: 130,
    width: "100%",
    backgroundColor: "#E2E8F0",
    position: "relative",
  },
  webFallbackBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F2FE",
    gap: 4,
  },
  webFallbackText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0369A1",
  },
  customMarkerContainer: {
    alignItems: "center",
    width: 36,
    height: 42,
  },
  markerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#047857",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  markerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#047857",
    marginTop: -1,
  },
  markerDotShadow: {
    width: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.25)",
    marginTop: 1,
  },
  topLeftPill: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    maxWidth: "50%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topLeftText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  topRightPill: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topRightText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
  },
  addressFallbackBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#F8FAFC",
  },
  fallbackIconHalo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  fallbackTextCol: {
    flex: 1,
    gap: 2,
  },
  fallbackTitleText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  fallbackSubtext: {
    fontSize: 12,
    color: "#64748B",
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#034E3B",
    paddingVertical: 11,
  },
  directionsBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});
