import { Stack } from "expo-router";

export default function PostWorkLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Keep stage changes immediate so the header and content stay aligned.
        animation: "none",
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="details" />
      <Stack.Screen name="location" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="pay" />
      <Stack.Screen name="review" />
    </Stack>
  );
}
