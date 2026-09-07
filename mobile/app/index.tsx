import { useEffect, useState } from "react";
import { router } from "expo-router";
import { View, Text, Button, ActivityIndicator } from "react-native";
import { SplashScreen } from "../src/components/SplashScreen";
import { useSession } from "../src/store/session";

export default function Index() {
  const [showSplash, setShowSplash] = useState(true);
  const session = useSession();
  useEffect(() => {
    if (!showSplash && session.ready && !session.restoreError) {
      router.replace(session.token ? "/(tabs)/profile" : "/auth");
    }
  }, [showSplash, session.ready, session.token, session.restoreError]);
  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;
  return <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#FAF8F2" }}>
    {session.restoreError ? <>
      <Text>{session.restoreError}</Text>
      <Button title="Retry" onPress={() => void session.hydrate()} />
    </> : <ActivityIndicator color="#176B58" />}
  </View>;
}
