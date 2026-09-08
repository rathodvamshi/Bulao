export default {
  expo: {
    name: "Bulao",
    slug: "bulao",
    version: "1.0.0",
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
