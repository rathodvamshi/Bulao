import { useContext } from "react";
import { AppFontsContext, appFontFamily } from "../../src/components/AppText";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator } from "react-native";
import { colors } from "../../src/components/ui";
import { useRequireAuth } from "../../src/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const fontsLoaded = useContext(AppFontsContext);
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading } = useRequireAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.paper,
        }}
      >
        <ActivityIndicator size="large" color="#03402D" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.marketplaceGreen,
        tabBarInactiveTintColor: colors.marketplaceMuted,
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(8, insets.bottom),
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5ECE7",
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: fontsLoaded ? "Bulao-SemiBold" : appFontFamily,
          fontSize: 11.5,
          fontWeight: fontsLoaded ? "normal" : "600",
          letterSpacing: -0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
          title: "Jobs",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "briefcase" : "briefcase-outline"}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          href: null,
          title: "Applications",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "document-text" : "document-text-outline"}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              color={color}
              size={22}
            />
          ),
        }}
      />
    </Tabs>
  );
}
