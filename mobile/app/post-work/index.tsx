import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../src/components/ui";
import { usePostWorkStore } from "../../src/features/post-work/store";
import { api } from "../../src/api/client";

type Category = {
  id: string;
  kind: string;
  name: string;
  icon: string;
};

type Role = {
  id: string;
  categoryId: string;
  name: string;
};

type CatalogResponse = {
  categories: Category[];
  roles: Role[];
  locations: any[];
  version: number;
};

export default function PostWorkCategoryScreen() {
  const { resetFlow, setCategory, setRole, category, role, categoryName, roleName } = usePostWorkStore();
  const [roles, setRoles] = useState<Role[]>([]);

  const { data: catalog, isLoading, isError, error } = useQuery<CatalogResponse>({
    queryKey: ["categories"],
    queryFn: () => api<CatalogResponse>("/categories"),
    staleTime: 86400000, // 24 hours
  });

  useEffect(() => {
    resetFlow();
  }, []);

  useEffect(() => {
    if (catalog && category) {
      const categoryRoles = catalog.roles.filter(r => r.categoryId === category);
      setRoles(categoryRoles);
    }
  }, [category, catalog]);

  const handleCategorySelect = (catId: string, catName: string) => {
    setCategory(catId, catName);
    if (catalog) {
      const categoryRoles = catalog.roles.filter(r => r.categoryId === catId);
      setRoles(categoryRoles);
    }
  };

  const handleRoleSelect = (roleId: string, roleName: string) => {
    setRole(roleId, roleName);
    router.push("/post-work/details");
  };

  const jobCategories = catalog?.categories.filter(c => c.kind === "job") || [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Post Work</Text>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>Step 1/6</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>What kind of work do you need?</Text>

        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.green} />
            <Text style={{ marginTop: 16, fontSize: 14, color: colors.muted }}>
              Loading categories...
            </Text>
          </View>
        ) : isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : "Could not load categories"}
            </Text>
            <Pressable onPress={() => window.location.reload()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.categoryGrid}>
              {jobCategories.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => handleCategorySelect(cat.id, cat.name)}
                  style={[styles.categoryCard, category === cat.id && styles.categoryCardActive]}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={styles.categoryLabel}>{cat.name}</Text>
                  {category === cat.id && <View style={styles.checkmark}><Text style={styles.checkmarkText}>✓</Text></View>}
                </Pressable>
              ))}
            </View>

            {category && roles.length > 0 && (
              <View style={styles.roleSection}>
                <Text style={styles.roleTitle}>Select specific role</Text>
                <View style={styles.roleGrid}>
                  {roles.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => handleRoleSelect(r.id, r.name)}
                      style={[styles.roleChip, role === r.id && styles.roleChipActive]}
                    >
                      <Text style={[styles.roleChipText, role === r.id && styles.roleChipTextActive]}>
                        {r.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {category && role && (
              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>Selected</Text>
                <Text style={styles.summaryText}>{categoryName} → {roleName}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.progressBar}>
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <View key={step} style={[styles.progressDot, step === 1 && styles.progressDotActive]} />
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
  question: { fontSize: 18, fontWeight: "600", color: colors.ink, marginBottom: 24 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  categoryCard: { width: "48%", aspectRatio: 1.2, backgroundColor: colors.white, borderRadius: 16, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center", gap: 8, position: "relative" },
  categoryCardActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  categoryIcon: { fontSize: 40 },
  categoryLabel: { fontSize: 15, fontWeight: "700", color: colors.ink },
  checkmark: { position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  checkmarkText: { fontSize: 14, color: colors.white, fontWeight: "700" },
  roleSection: { marginBottom: 24 },
  roleTitle: { fontSize: 16, fontWeight: "600", color: colors.ink, marginBottom: 12 },
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  roleChip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white },
  roleChipActive: { borderColor: colors.green, backgroundColor: colors.green },
  roleChipText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  roleChipTextActive: { color: colors.white },
  summary: { backgroundColor: colors.white, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.green },
  summaryLabel: { fontSize: 12, fontWeight: "700", color: colors.mutedLight, textTransform: "uppercase", marginBottom: 6 },
  summaryText: { fontSize: 16, fontWeight: "600", color: colors.ink },
  progressBar: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 16, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  progressDotActive: { backgroundColor: colors.green, width: 24 },
  errorBox: { backgroundColor: colors.errorBg, borderRadius: 16, padding: 24, alignItems: "center", gap: 12 },
  errorText: { fontSize: 14, fontWeight: "500", color: colors.error, textAlign: "center" },
  retryButton: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.error },
  retryText: { fontSize: 14, fontWeight: "600", color: colors.error },
});
