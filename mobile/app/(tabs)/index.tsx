import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Screen, Copy, colors, Card, s } from "../../src/components/ui";
import { t } from "../../src/i18n/en";
import { useLocation } from "../../src/store/location";
const choices = [
  {
    title: "findWork",
    hint: "workHint",
    icon: "briefcase-outline",
    color: "#E9F1C4",
    path: "/find-work",
  },
  {
    title: "hire",
    hint: "hireHint",
    icon: "people-outline",
    color: "#FAE6CC",
    path: "/provider-home",
  },
  {
    title: "findService",
    hint: "serviceHint",
    icon: "construct-outline",
    color: "#DCEBE5",
    path: "/explore?kind=service",
  },
] as const;
export default function Home() {
  const location = useLocation((x) => x.location);
  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontSize: 34,
            fontWeight: "900",
            letterSpacing: -2,
            color: colors.green,
          }}
        >
          {t("brand")}
          <Text style={{ color: "#B3CF5C" }}> ●</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => useLocation.getState().setLocationSheetVisible(true)}
          style={{
            flexDirection: "row",
            gap: 6,
            minHeight: 48,
            alignItems: "center",
            maxWidth: "65%",
          }}
        >
          <Ionicons name="location-outline" size={18} color={colors.green} />
          <Text style={[s.link, { flexShrink: 1 }]} numberOfLines={1}>
            {location?.area ?? t("location")}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.green} />
        </Pressable>
      </View>
      <View style={{ paddingTop: 4, gap: 6 }}>
        <Copy>{t("greeting")}</Copy>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 36,
            lineHeight: 42,
            fontWeight: "700",
            letterSpacing: -1.5,
            color: colors.ink,
          }}
        >
          {t("question")}
        </Text>
      </View>
      <View style={{ gap: 14, marginTop: 16 }}>
        {choices.map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            onPress={() => router.push(item.path)}
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
                backgroundColor: item.color,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: colors.ink }}>
                  {t(item.title)}
                </Text>
                <Text style={{ fontSize: 13, color: colors.ink, opacity: 0.7, marginTop: 4 }}>
                  {t(item.hint)}
                </Text>
              </View>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={item.icon} size={22} color={colors.ink} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
      <Card>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Ionicons name="leaf-outline" size={26} color={colors.green} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.label}>{t("tagline")}</Text>
            <Copy small>{t("accountHint")}</Copy>
          </View>
        </View>
      </Card>
    </Screen>
  );
}
