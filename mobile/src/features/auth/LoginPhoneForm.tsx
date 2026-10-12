import React, { useContext, useEffect, useRef, useState } from "react";
import { View, TextInput, TouchableOpacity, ActivityIndicator, Animated, Easing, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LoginFontContext, LoginText as Text } from "./LoginText";
import { AppTextInput } from "../../components/AppTextInput";
import { loginTheme, OTP_LENGTH } from "./loginTheme";
import { loginStyles as styles } from "./loginStyles";
import { traceLogin } from "./loginDiagnostics";
import { useLoginInputFocus } from "./LoginScreenLayout";
import { BulaoWordmark } from "../../components/BulaoWordmark";
const COLORS = { green: loginTheme.primary, ink: loginTheme.ink };
type PhoneStepProps = {
  phone: string; setPhone: (value: string) => void; error: string; loading: boolean;
  isValid: boolean; onContinue: () => Promise<void>;
};
export function PhoneStep({ phone, setPhone, error, loading, isValid, onContinue }: PhoneStepProps) {
  const fontsReady = useContext(LoginFontContext);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const revealInput = useLoginInputFocus();
  const welcomeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    traceLogin("phone:mount");
    return () => traceLogin("phone:unmount");
  }, []);

  useEffect(() => {
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setFocused(false);
      inputRef.current?.blur();
    });
    return () => hideSub.remove();
  }, []);

  useEffect(() => {
    Animated.timing(welcomeAnim, {
      toValue: focused ? 0 : 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const headerHeight = welcomeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 76],
  });
  const headerOpacity = welcomeAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.2, 1],
  });
  const headerTranslateY = welcomeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  return (
    <View style={styles.authCard}>
      <Animated.View
        style={{
          maxHeight: headerHeight,
          opacity: headerOpacity,
          transform: [{ translateY: headerTranslateY }],
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.35} style={styles.welcomeCompact}>Welcome to </Text>
          <BulaoWordmark size={24} color={styles.welcomeCompact.color} align="flex-start" />
        </View>
        <Text style={styles.introCompact}>Enter your mobile number to get started</Text>
      </Animated.View>
      <View style={[styles.phoneFieldCompact, focused && styles.inputWrapFocused, !!error && styles.inputWrapError]}>
        <View accessible accessibilityLabel="India, country code plus 91" style={styles.country}>
          <Text style={styles.flag}>🇮🇳</Text><Text style={styles.code}>+91</Text>
        </View>
        <View style={styles.divider} />
        <AppTextInput ref={inputRef} placeholder="Enter 10-digit number" placeholderTextColor="#718099"
          accessibilityLabel="Indian mobile number, 10 digits" accessibilityHint="Country code +91"
          keyboardType="number-pad" autoComplete="tel-national"
          textContentType="telephoneNumber" returnKeyType="done" autoCorrect={false}
          submitBehavior="submit"
          importantForAutofill="yes" maxLength={10} value={phone} onChangeText={setPhone}
          editable={!loading}
          onFocus={() => { traceLogin("phone:focus"); setFocused(true); revealInput(inputRef.current); }}
          onBlur={() => { traceLogin("phone:blur"); setFocused(false); }}
          onSubmitEditing={() => { void onContinue(); }}
          style={styles.input} selectionColor={COLORS.green} cursorColor={COLORS.green} />
      </View>
      <View style={styles.errorWrap}>
        {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text>}
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={loading ? "Sending code" : "Continue"}
        accessibilityState={{ disabled: !isValid || loading, busy: loading }}
        activeOpacity={0.85} disabled={!isValid || loading} onPress={() => { void onContinue(); }}
        style={[styles.primaryButtonCompact, !isValid && styles.primaryButtonInactive, loading && { opacity: 0.8 }]}>
        <Text style={styles.continueText}>{loading ? "Sending code…" : "Continue"}</Text>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />}
      </TouchableOpacity>
      <Text style={styles.otpHint}>We will send a {OTP_LENGTH}-digit OTP to verify</Text>
    </View>
  );
}
