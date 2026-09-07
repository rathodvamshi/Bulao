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
    path: "/explore?kind=job",
  },
  {
    title: "hire",
    hint: "hireHint",
    icon: "people-outline",
    color: "#FAE6CC",
    path: "/jobs/new",
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
          onPress={() => router.push("/location")}
          style={{
            flexDirection: "row",
            gap: 6,
            minHeight: 48,
            alignItems: "center",
            maxWidth: "65%",
          }}
        >
          <Ionicons name="location-outline" size={18} color={colors.green} />
          <Text style={[s.link, { flexShrink: 1 }]}>
            {location?.area ?? t("location")}⌄
          </Text>
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
      <View style={{ gap: 14, marginTop: 8 }}>
        {choices.map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            onPress={() => router.push(item.path)}
            style={({ pressed }) => ({
              backgroundColor: item.color,
              borderRadius: 24,
              padding: 18,
              gap: 10,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Ionicons name={item.icon} size={26} color={colors.ink} />
              <Ionicons name="arrow-forward" size={23} color={colors.ink} />
            </View>
            <View style={{ gap: 5 }}>
              <Text
                style={{ fontSize: 23, fontWeight: "700", color: colors.ink }}
              >
                {t(item.title)}
              </Text>
              <Copy small>{t(item.hint)}</Copy>
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
