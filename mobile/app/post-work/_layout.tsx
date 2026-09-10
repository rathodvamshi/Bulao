import { Stack } from "expo-router";

export default function PostWorkLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
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
