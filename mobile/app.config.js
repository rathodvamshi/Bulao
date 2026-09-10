export default {
  expo: {
    name: "Bulao",
    slug: "bulao",
    scheme: "bulao",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Bulao uses your location to find nearby work and services."
        }
      ]
    ],
    android: {
      package: "in.bulao.app"
    },
    ios: {
      bundleIdentifier: "in.bulao.app",
      supportsTablet: true
    },
    web: {
      bundler: "metro"
    },
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      msg91WidgetId: process.env.EXPO_PUBLIC_MSG91_WIDGET_ID,
      msg91TokenAuth: process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH,
    },
  },
};

if (process.env.EXPO_PUBLIC_API_BASE_URL) {
  console.log("STAGING_API=", process.env.EXPO_PUBLIC_API_BASE_URL);
}
