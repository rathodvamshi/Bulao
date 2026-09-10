import { router } from "expo-router";
import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, Alert, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../src/components/ui";
import { usePostWorkStore } from "../../src/features/post-work/store";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth";

type SavedPlace = {
  id: string;
  label: string;
  icon: string;
  latitude: number;
  longitude: number;
  locality: string;
  address: string;
};

export default function PostWorkLocationScreen() {
  const { latitude, longitude, locality, address, setLocation } = usePostWorkStore();
  const auth = useAuth();
  const userId = auth.session?.userId;

  const [loading, setLoading] = useState(false);
  const [localLocality, setLocalLocality] = useState(locality);
  const [localAddress, setLocalAddress] = useState(address);
  const [localLat, setLocalLat] = useState<number | null>(latitude);
  const [localLng, setLocalLng] = useState<number | null>(longitude);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);

  const { data: savedPlaces, isLoading: placesLoading, isError: placesError } = useQuery<SavedPlace[]>({
    queryKey: ["saved-places", userId],
    queryFn: () => api<SavedPlace[]>("/saved-places"),
    enabled: !!userId,
    retry: 0, // Don't retry if fails - not critical for this screen
    staleTime: 300000, // 5 minutes
  });

  const places = savedPlaces || [];

  const handleUseCurrentLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Please allow location access.");
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = location.coords;
      const [place] = await Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude });
      const localityName = (place?.district || place?.city || "Unknown") as string;

      setLocalLat(coords.latitude);
      setLocalLng(coords.longitude);
      setLocalLocality(localityName);
      setSelectedPlace(null);
    } catch (error) {
      Alert.alert("Error", "Could not fetch location.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSavedPlace = (place: SavedPlace) => {
    setLocalLat(place.latitude);
    setLocalLng(place.longitude);
    setLocalLocality(place.locality);
    setLocalAddress(place.address);
    setSelectedPlace(place.id);
  };

  const handleNext = () => {
    if (!localLat || !localLng || !localLocality) {
      Alert.alert("Location required", "Please select a location.");
      return;
    }
    setLocation(localLat, localLng, localLocality, localAddress, selectedPlace || undefined);
    router.push("/post-work/schedule");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Location</Text>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>Step 3/6</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>Where is the work?</Text>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.green} />
            <Text style={{ marginTop: 16, fontSize: 14, color: colors.muted }}>
              Getting your location...
            </Text>
          </View>
        ) : (
          <>
            <Pressable onPress={handleUseCurrentLocation} style={[styles.optionCard, !selectedPlace && localLat ? styles.optionCardActive : null]}>
              <View style={styles.optionIcon}><Text style={styles.optionIconText}>📍</Text></View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Current Location</Text>
                <Text style={styles.optionSubtitle}>Use GPS</Text>
              </View>
              {!selectedPlace && localLat && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>

            {places.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>⭐ Saved Places</Text>
                <View style={styles.savedGrid}>
                  {places.slice(0, 3).map((place) => (
                    <Pressable
                      key={place.id}
                      onPress={() => handleSelectSavedPlace(place)}
                      style={[styles.savedCard, selectedPlace === place.id && styles.savedCardActive]}
                    >
                      <Text style={styles.savedIcon}>{place.icon}</Text>
                      <Text style={styles.savedLabel}>{place.label}</Text>
                      {selectedPlace === place.id && <Text style={styles.checkmarkSmall}>✓</Text>}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {localLocality && (
              <View style={styles.selectedBox}>
                <Text style={styles.selectedLabel}>Selected Location</Text>
                <Text style={styles.selectedText}>{localLocality}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Landmark / Building (Optional)</Text>
              <TextInput
                value={localAddress}
                onChangeText={setLocalAddress}
                placeholder="e.g. Near XYZ mall"
                placeholderTextColor={colors.mutedLight}
                style={styles.input}
              />
            </View>

            {localLocality && (
              <View style={styles.summary}>
                <Text style={styles.summaryIcon}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryText}>{localLocality}</Text>
                  {localAddress && <Text style={styles.summarySubtext}>{localAddress}</Text>}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handleNext} style={styles.nextButton}>
          <Text style={styles.nextButtonText}>Continue</Text>
        </Pressable>
      </View>

      <View style={styles.progressBar}>
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <View key={step} style={[styles.progressDot, step <= 3 && styles.progressDotActive]} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  backText: { fontSize: 24, color: colors.green },
  title: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.ink, marginLeft: 8 },
  stepIndicator: { backgroundColor: colors.greenLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  stepText: { fontSize: 12, fontWeight: "600", color: colors.green },
  content: { flex: 1, padding: 20 },
  question: { fontSize: 18, fontWeight: "600", color: colors.ink, marginBottom: 20 },
  optionCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.white, borderRadius: 16, borderWidth: 2, borderColor: colors.line, padding: 16, marginBottom: 12 },
  optionCardActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  optionIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.greenLight, alignItems: "center", justifyContent: "center" },
  optionIconText: { fontSize: 28 },
  optionContent: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  optionSubtitle: { fontSize: 13, fontWeight: "500", color: colors.muted, marginTop: 2 },
  checkmark: { fontSize: 24, color: colors.green, fontWeight: "700" },
  section: { marginTop: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 12 },
  savedGrid: { flexDirection: "row", gap: 10 },
  savedCard: { flex: 1, aspectRatio: 1, backgroundColor: colors.white, borderRadius: 16, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center", gap: 6, position: "relative" },
  savedCardActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  savedIcon: { fontSize: 32 },
  savedLabel: { fontSize: 13, fontWeight: "700", color: colors.ink },
  checkmarkSmall: { position: "absolute", top: 8, right: 8, fontSize: 16, color: colors.green, fontWeight: "700" },
  selectedBox: { backgroundColor: colors.white, padding: 16, borderRadius: 14, borderWidth: 2, borderColor: colors.green, marginBottom: 16 },
  selectedLabel: { fontSize: 12, fontWeight: "700", color: colors.mutedLight, textTransform: "uppercase", marginBottom: 6 },
  selectedText: { fontSize: 16, fontWeight: "600", color: colors.ink },
  label: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 12 },
  input: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: "500", color: colors.ink },
  summary: { flexDirection: "row", gap: 12, backgroundColor: colors.white, padding: 18, borderRadius: 16, borderWidth: 2, borderColor: colors.green, alignItems: "center", marginTop: 12 },
  summaryIcon: { fontSize: 28 },
  summaryText: { fontSize: 16, fontWeight: "700", color: colors.ink },
  summarySubtext: { fontSize: 13, fontWeight: "500", color: colors.muted, marginTop: 2 },
  footer: { padding: 20, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  nextButton: { backgroundColor: colors.green, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  nextButtonText: { fontSize: 17, fontWeight: "700", color: colors.white },
  progressBar: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12, backgroundColor: colors.white },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  progressDotActive: { backgroundColor: colors.green, width: 24 },
});
