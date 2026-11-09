import { useEffect, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";

export function useRotatingSearchHint(area?: string) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const hints = useMemo(() => {
    const nearbyArea = area?.trim() || "your area";
    return [
      "Search for a service near you",
      "Find a trusted plumber",
      "Search for a home cook",
      `Find workers near ${nearbyArea}`,
      "Looking for a home cleaner?",
      "Find an AC repair expert",
    ];
  }, [area]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    const timer = setInterval(() => {
      animation = Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (!finished) return;
        setIndex((current) => (current + 1) % hints.length);
        animation = Animated.timing(opacity, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        });
        animation.start();
      });
    }, 3400);

    return () => {
      clearInterval(timer);
      animation?.stop();
    };
  }, [hints.length, opacity]);

  return { hint: hints[index] || hints[0], opacity };
}
