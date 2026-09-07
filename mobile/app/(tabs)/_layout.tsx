import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../../src/i18n/en";
import { colors } from "../../src/components/ui";
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 78,
          paddingTop: 9,
          paddingBottom: 15,
          backgroundColor: "#FAFAF5",
        },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t("explore"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: t("activity"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="layers-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
