import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { dash } from "./palette";

const scenes = [
  { image: require("../../../assets/images/provider/bakery-hiring-story/01-need-temporary-worker.png"), label: "A bakery owner needs a temporary worker" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/02-provider-posts-job.png"), label: "The provider posts a packing job" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/03-worker-views-job.png"), label: "A worker views the shift and pay details" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/04-worker-applies.png"), label: "The worker sends an application" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/05-provider-accepts-application.png"), label: "The provider accepts the application" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/06-contact-and-share-location.png"), label: "They contact each other and share the work location" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/07-worker-follows-map.png"), label: "The worker follows the map to the bakery" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/08-worker-arrives.png"), label: "The worker arrives for the shift" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/09-provider-assigns-work.png"), label: "The provider explains the packing work" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/10-worker-does-work.png"), label: "The worker packs the orders" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/11-provider-checks-completed-work.png"), label: "The provider checks the completed work" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/12-provider-pays-worker.png"), label: "The provider pays the worker for the shift" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/13-provider-rates-worker.png"), label: "The provider rates the worker" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/14-worker-rates-provider.png"), label: "The worker rates the provider" },
  { image: require("../../../assets/images/provider/bakery-hiring-story/15-job-completed.png"), label: "Job completed. A happy provider and worker" },
] as const;

export function ProviderStoryHero({ width, height, headerHeight, visible }: {
  width: number; height: number; headerHeight: number; visible: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Stay still until the accessibility preference has loaded.
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const opacity = useRef(scenes.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const playing = !paused && !reduceMotion && foreground && focused && visible;
  const artWidth = Math.min(width, 440);
  const artHeight = artWidth * (1402 / 1122);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    const app = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    const animation = Animated.parallel(opacity.map((value, i) => Animated.timing(value, {
      toValue: i === index ? 1 : 0, duration: reduceMotion ? 0 : 650, useNativeDriver: true,
    })));
    animation.start();
    return () => animation.stop();
  }, [index, opacity, reduceMotion]);

  useEffect(() => {
    zoom.setValue(0);
    if (!playing || !loaded[index]) return;
    const animation = Animated.timing(zoom, { toValue: 1, duration: 5200, easing: Easing.linear, useNativeDriver: true });
    animation.start();
    const timer = setTimeout(() => setIndex(i => (i + 1) % scenes.length), 5200);
    return () => { clearTimeout(timer); animation.stop(); };
  }, [index, playing, loaded, zoom]);

  const step = (direction: number) => {
    setPaused(true);
    setIndex(i => (i + direction + scenes.length) % scenes.length);
  };

  return (
    <View style={[styles.hero, { height }]}>
      <View accessible accessibilityRole="image" accessibilityLabel={`Bulao story, scene ${index + 1} of ${scenes.length}. ${scenes[index]!.label}`} style={StyleSheet.absoluteFill}>
        {scenes.map((scene, i) => (
          <Animated.Image key={scene.label} source={scene.image} accessible={false}
            onLoad={() => setLoaded(old => old[i] ? old : { ...old, [i]: true })}
            resizeMode="contain"
            style={{ position: "absolute", width: artWidth, height: artHeight, left: (width - artWidth) / 2,
              top: headerHeight - artHeight * 0.25, opacity: opacity[i],
              transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) }] }} />
        ))}
      </View>
      <LinearGradient pointerEvents="none" colors={["transparent", dash.bg]} locations={[0.73, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous story scene" onPress={() => step(-1)} style={styles.control}>
          <Ionicons name="chevron-back" size={12} color="#4B5563" />
        </Pressable>
        {!reduceMotion && <Pressable accessibilityRole="button" accessibilityLabel={paused ? "Play story" : "Pause story"} onPress={() => setPaused(value => !value)} style={styles.control}>
          <Ionicons name={paused ? "play" : "pause"} size={11} color="#4B5563" />
        </Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Next story scene" onPress={() => step(1)} style={styles.control}>
          <Ionicons name="chevron-forward" size={12} color="#4B5563" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", overflow: "hidden", backgroundColor: "#D0E7D1" },
  controls: { position: "absolute", bottom: 70, alignSelf: "center", flexDirection: "row", alignItems: "center" },
  control: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
