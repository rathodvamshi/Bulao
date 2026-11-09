export default {
  expo: {
    name: "Bulao",
    slug: "bulao",
    scheme: "bulao",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "light",
    splash: {
      backgroundColor: "#FAF8F2",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Bulao uses your location to find nearby work and services.",
        },
      ],
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/Inter-Regular.ttf",
            "./assets/fonts/Inter-SemiBold.ttf",
            "./assets/fonts/Inter-Bold.ttf",
          ],
        },
      ],
      [
        "expo-notifications",
        {
          defaultChannel: "updates",
          color: "#075B43",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Bulao needs access to your photos to upload profile and work images.",
        },
      ],
    ],
    android: {
      package: "in.bulao.app",
      versionCode: 1,
      softwareKeyboardLayoutMode: "resize",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#074433",
      },
    },
    ios: {
      bundleIdentifier: "in.bulao.app",
      supportsTablet: true,
    },
    web: {
      bundler: "metro",
      favicon: "./assets/images/favicon.png",
    },
    extra: {
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "a50c7b67-2355-4fc9-bc4b-0e4eb8b948ac",
      },
      apiUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "https://bulao-api-staging.codecheck369.workers.dev/api/v1",
      msg91WidgetId: process.env.EXPO_PUBLIC_MSG91_WIDGET_ID,
      msg91TokenAuth: process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH,
    },
  },
};
