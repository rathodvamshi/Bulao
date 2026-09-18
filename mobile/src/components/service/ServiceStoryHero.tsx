import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { dash } from "./palette";

const scenes = [
  { image: require("../../../assets/images/provider/kitchen-rescue-story/01-kitchen-leak.png"), label: "A leaking sink right before family lunch" },
  { image: require("../../../assets/images/provider/kitchen-rescue-story/02-neighbor-suggests.png"), label: "A neighbor suggests finding a plumber on Bulao" },
  { image: require("../../../assets/images/provider/kitchen-rescue-story/03-download-bulao.png"), label: "Downloading Bulao to find help" },
  { image: require("../../../assets/images/provider/kitchen-rescue-story/04-find-plumber.png"), label: "Selecting a nearby verified plumber" },
  { image: require("../../../assets/images/provider/kitchen-rescue-story/05-plumber-accepts.png"), label: "The plumber accepts the service request" },
  { image: require("../../../assets/images/provider/kitchen-rescue-story/06-plumber-arrives.png"), label: "The plumber arrives on time with tools" },
  { image: require("../../../assets/images/provider/kitchen-rescue-story/07-repair-in-progress.png"), label: "The plumber finds and fixes the leaking pipe" },
  { image: require("../../../assets/images/provider/kitchen-rescue-story/08-repair-checked.png"), label: "The repair is checked and dry — no more leaks" },
  { image: require("../../../assets/images/provider/kitchen-rescue-story/09-worker-paid.png"), label: "The homeowner pays the plumber for the service" },
  { image: require("../../../assets/images/provider/kitchen-rescue-story/10-family-lunch-recommendation.png"), label: "Family lunch saved! Recommending Bulao to guests" },
] as const;

export function ServiceStoryHero({ width, height, headerHeight, visible }: {
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
