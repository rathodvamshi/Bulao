import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { locationApi, type LocationSearchResult } from "../src/api/locationApi";
import { useLocation } from "../src/store/location";
import { colors } from "../src/components/ui";
import { useAuth } from "../src/auth";

export default function LocationSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { setLocation } = useLocation();
  const { session } = useAuth();

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await locationApi.searchLocation(query);
        setResults(res);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: LocationSearchResult) => {
    setLocation({
      area: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
    });
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by area or address"
          autoFocus
          style={{
            flex: 1,
            backgroundColor: colors.paper,
            padding: 12,
            borderRadius: 12,
            fontSize: 16,
            color: colors.ink,
          }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={20} color={colors.ink} style={{ opacity: 0.5 }} />
          </Pressable>
        )}
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator color={colors.green} />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.latitude}-${item.longitude}`}
            contentContainerStyle={{ paddingVertical: 16 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: "#fff",
                    marginHorizontal: 16,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.ink }}>
                      {item.name}
                    </Text>
                    <Text numberOfLines={2} style={{ fontSize: 12, color: colors.mutedLight, marginTop: 2 }}>
                      {item.address}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.paper,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="location" size={18} color={colors.ink} />
                  </View>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              query.length >= 3 ? (
                <View style={{ padding: 40, alignItems: "center" }}>
                  <Ionicons name="search-outline" size={48} color={colors.mutedLight} style={{ marginBottom: 16 }} />
                  <Text style={{ fontSize: 16, color: colors.ink, fontWeight: "600" }}>No results found</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 8 }}>
                    Try searching for a different area or address
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
