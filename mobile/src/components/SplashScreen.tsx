import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { BulaoWordmark, SIGNAL_RAY_CYCLE_MS } from './BulaoWordmark';

interface SplashScreenProps {
  isReady: boolean;
  onComplete: () => void;
}

const TITLE_FADE_MS = 560;
const EXIT_FADE_MS = 220;
const REQUIRED_SIGNAL_CYCLES = 2;
const MIN_SIGNAL_ANIMATION_MS = SIGNAL_RAY_CYCLE_MS * REQUIRED_SIGNAL_CYCLES;

/** Holds the lightweight brand screen until the first usable route is ready. */
export const SplashScreen: React.FC<SplashScreenProps> = ({ isReady, onComplete }) => {
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(12)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const [titleReady, setTitleReady] = useState(false);
  const [signalCyclesReady, setSignalCyclesReady] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: TITLE_FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(titleY, {
        toValue: 0,
        duration: TITLE_FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    entrance.start(({ finished }) => {
      if (finished) setTitleReady(true);
    });
    return () => entrance.stop();
  }, [titleOpacity, titleY]);

  useEffect(() => {
    const timer = setTimeout(() => setSignalCyclesReady(true), MIN_SIGNAL_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || !titleReady || !signalCyclesReady || isExiting) return;
    setIsExiting(true);
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: EXIT_FADE_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onCompleteRef.current();
    });
  }, [isReady, titleReady, signalCyclesReady, isExiting, screenOpacity]);

  return (
    <Animated.View style={[styles.screen, { opacity: screenOpacity }]}>
      <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
        <BulaoWordmark size={56} color="#15533F" signalColor="#15533F" withSignal animateSignal />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8F2',
    zIndex: 1000,
    elevation: 1000,
  },
});
