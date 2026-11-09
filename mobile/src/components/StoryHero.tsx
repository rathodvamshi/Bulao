import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { cachedStory, fetchStory, type StoryCollection, type StoryId } from '../api/stories';

export type StoryHeroProps = {
  width: number;
  height: number;
  headerHeight: number;
  visible: boolean;
};

type Props = StoryHeroProps & {
  collection: StoryId;
  fallbackLabel: string;
  backgroundColor: string;
  fallbackOffset: number;
};

export function StoryHero(props: Props) {
  const [story, setStory] = useState<StoryCollection | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const cached = await cachedStory(props.collection);
      if (active && cached) setStory(cached);
      try {
        const fresh = await fetchStory(props.collection);
        if (active) setStory(fresh);
      } catch {
        /* Cached manifest remains usable; the plain background needs no network. */
      }
    })();
    return () => {
      active = false;
    };
  }, [props.collection]);

  return <StoryPlayer key={story?.revision ?? props.collection} {...props} story={story} />;
}

function StoryPlayer({
  width,
  height,
  headerHeight,
  visible,
  fallbackLabel,
  backgroundColor,
  fallbackOffset,
  story,
}: Props & { story: StoryCollection | null }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const scrollRef = useRef<ScrollView>(null);
  const extendedIndexRef = useRef(1);
  const isUserDragging = useRef(false);
  const autoPlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoom = useRef(new Animated.Value(0)).current;

  const scenes = story?.scenes ?? [];
  const count = scenes.length;

  // Build extended array for infinite looping: [Last, Scene_0, Scene_1, ..., Scene_N-1, First]
  const extendedScenes = useMemo(() => {
    if (count === 0) return [];
    if (count === 1) {
      const first = scenes[0];
      return first ? [{ ...first, _key: `single-${first.id || 0}` }] : [];
    }
    const last = scenes[count - 1];
    const first = scenes[0];
    if (!last || !first) return [];
    return [
      { ...last, _key: `clone-last-${last.id}` },
      ...scenes.map((s, idx) => ({ ...s, _key: `real-${s.id}-${idx}` })),
      { ...first, _key: `clone-first-${first.id}` },
    ];
  }, [scenes, count]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (active) setReduceMotion(v);
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => {
      active = false;
      motion.remove();
      app.remove();
    };
  }, []);

  // Pre-fetch all story scene images into memory-disk cache immediately
  useEffect(() => {
    if (!scenes.length) return;
    scenes.forEach((scene) => {
      if (scene.url) {
        void Image.prefetch(scene.url, { cachePolicy: 'memory-disk' }).catch(() => {});
      }
    });
  }, [scenes]);

  // Initial scroll positioning at index 1 (real first slide)
  useEffect(() => {
    if (count > 1) {
      extendedIndexRef.current = activeIndex + 1;
      scrollRef.current?.scrollTo({ x: (activeIndex + 1) * width, animated: false });
    }
  }, [count, width]);

  const playing = !reduceMotion && foreground && focused && visible && count > 1;

  // Snappy Ken Burns scale animation on active slide
  useEffect(() => {
    zoom.setValue(0);
    if (!playing) return;
    const animation = Animated.timing(zoom, {
      toValue: 1,
      duration: 3400,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [activeIndex, playing, zoom]);

  // Fast & smooth auto-advance (3.4s cycle)
  useEffect(() => {
    if (autoPlayTimer.current) {
      clearTimeout(autoPlayTimer.current);
      autoPlayTimer.current = null;
    }

    if (!playing || count <= 1) return;

    autoPlayTimer.current = setTimeout(() => {
      if (isUserDragging.current) return;
      const curExt = extendedIndexRef.current;
      const nextExt = curExt + 1;
      extendedIndexRef.current = nextExt;

      scrollRef.current?.scrollTo({ x: nextExt * width, animated: true });

      if (nextExt >= count + 1) {
        // Scrolled to clone of first slide -> update dot to 0 right away
        setActiveIndex(0);
        // After animated scroll settles, silently snap back to real first slide (index 1)
        if (snapTimer.current) clearTimeout(snapTimer.current);
        snapTimer.current = setTimeout(() => {
          if (isUserDragging.current) return;
          scrollRef.current?.scrollTo({ x: 1 * width, animated: false });
          extendedIndexRef.current = 1;
        }, 360);
      } else {
        setActiveIndex(nextExt - 1);
      }
    }, 3400);

    return () => {
      if (autoPlayTimer.current) {
        clearTimeout(autoPlayTimer.current);
      }
      if (snapTimer.current) {
        clearTimeout(snapTimer.current);
      }
    };
  }, [activeIndex, playing, count, width]);

  // Infinite loop boundary handler: silently jumps between clones and real slides
  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (count <= 1) return;
    const offsetX = e.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / width);

    if (page <= 0) {
      // Swiped backwards past first slide -> silently jump to real last slide
      scrollRef.current?.scrollTo({ x: count * width, animated: false });
      extendedIndexRef.current = count;
      setActiveIndex(count - 1);
    } else if (page >= count + 1) {
      // Swiped forwards past last slide -> silently jump to real first slide
      scrollRef.current?.scrollTo({ x: 1 * width, animated: false });
      extendedIndexRef.current = 1;
      setActiveIndex(0);
    } else {
      extendedIndexRef.current = page;
      setActiveIndex(page - 1);
    }
    isUserDragging.current = false;
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isUserDragging.current || count <= 1) return;
    const offsetX = e.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / width);
    let dot = 0;
    if (page <= 0) dot = count - 1;
    else if (page >= count + 1) dot = 0;
    else dot = page - 1;

    if (dot >= 0 && dot < count && dot !== activeIndex) {
      setActiveIndex(dot);
    }
  };

  return (
    <View style={[styles.hero, { height, backgroundColor }]}>
      {count > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          contentOffset={count > 1 ? { x: width, y: 0 } : undefined}
          onScrollBeginDrag={() => {
            isUserDragging.current = true;
            if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
            if (snapTimer.current) clearTimeout(snapTimer.current);
          }}
          onScroll={handleScroll}
          onScrollEndDrag={() => {
            setTimeout(() => {
              isUserDragging.current = false;
            }, 1200);
          }}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          style={StyleSheet.absoluteFill}
        >
          {extendedScenes.map((scene, i) => {
            const isFailed = !!failed[scene.id];
            const showRemote = !isFailed;
            const artWidth = Math.min(width, 440);
            const artHeight = artWidth * (showRemote ? scene.height / scene.width : 1402 / 1122);
            const sceneWidth = artWidth * (showRemote ? scene.scale : 1);
            const isCurrent =
              count > 1
                ? i === activeIndex + 1 ||
                  (i === 0 && activeIndex === count - 1) ||
                  (i === count + 1 && activeIndex === 0)
                : true;

            return (
              <View key={scene._key || i} style={{ width, height, overflow: 'hidden' }}>
                <Animated.View
                  style={{
                    position: 'absolute',
                    width: sceneWidth,
                    height: artHeight,
                    left: (width - sceneWidth) / 2,
                    top: headerHeight - artHeight * (showRemote ? scene.offset : fallbackOffset),
                    transform: [
                      {
                        scale: isCurrent
                          ? zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] })
                          : 1,
                      },
                    ],
                  }}
                >
                  <Image
                    source={showRemote ? { uri: scene.url } : null}
                    priority={i === 1 || i === 0 ? 'high' : 'normal'}
                    style={StyleSheet.absoluteFill}
                    cachePolicy="memory-disk"
                    contentFit={showRemote ? scene.fit : 'contain'}
                    transition={reduceMotion ? 0 : 250}
                    accessibilityLabel={showRemote ? scene.label : fallbackLabel}
                    accessible
                    onError={() => {
                      if (showRemote) {
                        setFailed((old) => ({ ...old, [scene.id]: true }));
                      }
                    }}
                  />
                </Animated.View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ width, height, overflow: 'hidden' }}>
          <View
            style={{
              position: 'absolute',
              width: Math.min(width, 440),
              height: Math.min(width, 440) * (1402 / 1122),
              left: (width - Math.min(width, 440)) / 2,
              top: headerHeight - Math.min(width, 440) * (1402 / 1122) * fallbackOffset,
            }}
          >
            <Image
              priority="high"
              style={StyleSheet.absoluteFill}
              cachePolicy="memory-disk"
              contentFit="contain"
              accessibilityLabel={fallbackLabel}
              accessible
            />
          </View>
        </View>
      )}

      {/* Top and Bottom gradient overlays to blend artwork seamlessly into page */}
      <LinearGradient
        pointerEvents="none"
        colors={[backgroundColor, 'transparent']}
        locations={[0, 0.28]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', backgroundColor]}
        locations={[0.73, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    overflow: 'hidden',
  },
});
