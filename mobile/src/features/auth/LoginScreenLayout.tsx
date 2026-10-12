import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, TouchableOpacity, TouchableWithoutFeedback, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LoginHero } from "./LoginHero";
import { loginStyles as styles } from "./loginStyles";
import { loginTheme } from "./loginTheme";
import { dismissLoginKeyboard } from "./loginDiagnostics";

type Props = { children: ReactNode; footer: ReactNode; showHero: boolean; step: "phone" | "otp" | "name" };
type RevealSpace = { above?: number; below?: number };
const InputVisibilityContext = createContext<(input: TextInput | null, space?: RevealSpace) => void>(() => {});
export const useLoginInputFocus = () => useContext(InputVisibilityContext);

export function LoginScreenLayout({ children, footer, showHero, step }: Props) {
  const insets = useSafeAreaInsets();
  // Width controls artwork size. Keyboard-induced window-height changes never
  // change the hero, typography, padding, or component tree.
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, loginTheme.maxWidth);
  const viewportRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const activeInput = useRef<TextInput | null>(null);
  const revealSpace = useRef<RevealSpace>({});
  const keyboardTop = useRef<number | null>(Keyboard.metrics()?.screenY ?? null);
  const scrollOffset = useRef(0);
  const insetRef = useRef(0);
  const pendingFrame = useRef<number | null>(null);
  const revealVersion = useRef(0);
  const requestedOffset = useRef<number | null>(null);
  const userScrolling = useRef(false);
  const manualScroll = useRef(false);
  const reduceMotion = useRef(false);
  const cardLift = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;
  const previousStep = useRef(step);
  const transitioning = useRef(false);
  const mounted = useRef(true);
  const [bottomInset, setBottomInset] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    // When keyboard is open on phone/otp steps (where hero is shown), slightly lift
    // the card so the Continue button is fully clear of the keyboard keypad.
    // On the name step (showHero is false), card stays completely stationary.
    const liftAmount = keyboardOpen && showHero ? -48 : 0;
    Animated.timing(cardLift, {
      toValue: liftAmount,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [keyboardOpen, showHero]);

  const revealInput = useCallback(() => {
    // Stationary: do not scroll or move the page up
  }, []);

  useLayoutEffect(() => {
    const from = previousStep.current;
    previousStep.current = step;
    cardSlide.stopAnimation();
    cardSlide.setValue(0);
    transitioning.current = false;
    const switchingCards = (from === "phone" && step === "otp") || (from === "otp" && step === "phone");
    if (!switchingCards || reduceMotion.current) return;

    ++revealVersion.current;
    transitioning.current = true;
    cardSlide.setValue(step === "otp" ? contentWidth : -contentWidth);
    const animation = Animated.timing(cardSlide, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      transitioning.current = false;
      if (finished) revealInput();
    });
    return () => { animation.stop(); transitioning.current = false; };
  }, [step, contentWidth, cardSlide, revealInput]);

  const onInputFocus = useCallback((input: TextInput | null, space: RevealSpace = {}) => {
    activeInput.current = input;
    revealSpace.current = space;
    requestedOffset.current = null;
    userScrolling.current = false;
    manualScroll.current = false;
    revealInput(); // A second input can be focused while the keyboard is open.
  }, [revealInput]);

  useEffect(() => { revealInput(); }, [bottomInset, revealInput]);

  useEffect(() => {
    let disposed = false;
    let preferenceChanged = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      preferenceChanged = true;
      reduceMotion.current = enabled;
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!disposed && !preferenceChanged) reduceMotion.current = enabled;
    }).catch(() => { /* Keep the non-animated fallback if the setting is unavailable. */ });
    return () => { disposed = true; subscription.remove(); };
  }, []);

  useEffect(() => {
    mounted.current = true;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOpen(true);
      keyboardTop.current = event.endCoordinates?.screenY ?? null;
      revealInput();
    });
    const change = Keyboard.addListener("keyboardDidChangeFrame", (event) => {
      if (keyboardTop.current === null || !Keyboard.isVisible()) return;
      keyboardTop.current = event.endCoordinates?.screenY ?? null;
      revealInput();
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardOpen(false);
      ++revealVersion.current;
      requestedOffset.current = null;
      userScrolling.current = false;
      manualScroll.current = false;
      keyboardTop.current = null;
      insetRef.current = 0;
      setBottomInset(0);
      scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion.current });
    });
    return () => {
      mounted.current = false;
      show.remove(); change.remove(); hide.remove();
      if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    };
  }, [revealInput]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} enabled={false}>
        <View ref={viewportRef} collapsable={false} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }}
          scrollEnabled={false}
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets={false} automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never" removeClippedSubviews={false}>
          <View style={styles.page}>
            {showHero && (
              <View style={styles.heroArea}>
                <TouchableWithoutFeedback accessible={false} onPress={() => dismissLoginKeyboard("hero-tap")}>
                  <View><LoginHero width={contentWidth} step={step} keyboardOpen={keyboardOpen} /></View>
                </TouchableWithoutFeedback>
              </View>
            )}
            <Animated.View
              style={[
                styles.content,
                showHero ? styles.phoneContent : styles.nameContent,
                { transform: [{ translateY: cardLift }] },
              ]}
            >
              <Animated.View style={{ transform: [{ translateX: cardSlide }] }}>
                <InputVisibilityContext.Provider value={onInputFocus}>{children}</InputVisibilityContext.Provider>
              </Animated.View>
              {footer ? <View style={[styles.footer, showHero && styles.phoneFooter]}>{footer}</View> : null}
            </Animated.View>
          </View>
        </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
