import React, { useState, useRef, useEffect } from "react";
import {
  View, TextInput, TouchableOpacity, Alert,
  Platform, ActivityIndicator, Linking, BackHandler,
  Animated, Easing, Keyboard,
} from "react-native";
import { LoginFontContext, LoginText as Text } from "../src/features/auth/LoginText";
import { AppTextInput } from "../src/components/AppTextInput";
import { LoginScreenLayout, useLoginInputFocus } from "../src/features/auth/LoginScreenLayout";
import { PhoneStep } from "../src/features/auth/LoginPhoneForm";
import { BulaoWordmark } from "../src/components/BulaoWordmark";
import { loginStyles as styles } from "../src/features/auth/loginStyles";
import { loginTheme, loginError, OTP_LENGTH } from "../src/features/auth/loginTheme";
import { dismissLoginKeyboard, traceLogin } from "../src/features/auth/loginDiagnostics";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { OTPWidget, widgetProof } from "../src/features/auth/widget";
import { useAuth, completeLogin } from "../src/auth";
import type { UserData, SessionData } from "../src/auth";
import { saveSession } from "../src/auth/authStorage";
import { api } from "../src/api/client";

// MSG91 Widget Configuration from environment
const MSG91_WIDGET_ID = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID || "3669686e4b46393237373639";
const MSG91_TOKEN_AUTH = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH || "568607TBQ8oKK8IF6aa02237P1";

type OtpChallenge = {
  requestId: string;
  expiresIn: number;
  resendAfter: number;
  otpLength: number;
  provider?: "widget" | "backend";
};

const COLORS = {
  green: loginTheme.primary, cream: loginTheme.surface, white: loginTheme.surface,
  ink: loginTheme.ink, muted: loginTheme.muted, border: loginTheme.border,
  error: loginTheme.error, errorBg: loginTheme.errorBg,
};
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
function openLegal(title: string, url?: string) {
  if (!url) { Alert.alert(title, "This document is not available yet. Please contact Bulao support."); return; }
  void Linking.openURL(url).catch(() => Alert.alert(title, "Could not open this page. Please try again."));
}

export default function Auth() {
  return (
    <LoginFontContext.Provider value={true}>
      <AuthContent fontsReady={true} />
    </LoginFontContext.Provider>
  );
}


function AuthContent({ fontsReady }: { fontsReady: boolean }) {
  const params = useLocalSearchParams<{ step?: string }>();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "name">(() => {
    if (params.step === "name") return "name";
    return "phone";
  });
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const sending = useRef(false);
  const verifying = useRef(false);
  const mounted = useRef(true);

  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    mounted.current = true;
    traceLogin("screen:mount");
    return () => { mounted.current = false; traceLogin("screen:unmount"); };
  }, []);

  useEffect(() => { traceLogin(`step:${step}`); }, [step]);

  // Redirect if already authenticated with a completed name; or enforce name step if missing
  useEffect(() => {
    if (auth.status === "authenticated") {
      const hasName = auth.user?.name && auth.user.name.trim() !== "" && auth.user.name.trim().toLowerCase() !== "user";
      if (hasName) {
        dismissLoginKeyboard("authenticated-route");
        router.replace("/(tabs)");
      } else if (step !== "name") {
        dismissLoginKeyboard("name-step");
        setStep("name");
      }
    }
  }, [auth.status, auth.user?.name, step, router]);

  // Handle Android hardware back press cleanly
  useEffect(() => {
    const onBackPress = () => {
      if (sending.current || verifying.current) return true;
      if (step === "otp") {
        dismissLoginKeyboard("back-to-phone");
        setChallenge(null);
        setStep("phone");
        return true;
      }
      if (step === "name") {
        // Prevent accidental return to expired/used OTP form
        if (Platform.OS === "android") {
          BackHandler.exitApp();
        }
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [step]);

  // Initialize MSG91 Widget on mount
  useEffect(() => {
    OTPWidget.initializeWidget(MSG91_WIDGET_ID, MSG91_TOKEN_AUTH)
      .then(() => console.log("MSG91 Widget initialized"))
      .catch((err) => console.error("Widget init error:", err));
  }, []);

  const validate = (n: string) => /^[6-9]\d{9}$/.test(n);

  const transitionToOtp = () => {
    dismissLoginKeyboard("otp-step");
    setStep("otp");
  };

  const onContinue = async () => {
    if (sending.current) return;
    setError("");
    if (!validate(phone)) { setError("Please enter a valid Indian mobile number."); return; }
    sending.current = true;
    setLoading(true);

    const fullPhone = "+91" + phone;
    console.log("[Bulao Auth] Starting OTP dispatch for:", fullPhone);

    try {
      // Primary route: Send OTP via MSG91 Widget (runs without requiring custom SMS DLT template)
      console.log("[Bulao Auth] Sending OTP via MSG91 Widget SDK...");
      const identifier = "91" + phone;
      const response = await OTPWidget.sendOTP({ identifier });
      if (!mounted.current) return;
      if (!response) {
        throw new Error("No response received from OTP service. Please check your network.");
      }

      const requestId = response.reqId || response.requestId || response.message;
      if (requestId && response.type === "success") {
        console.log("[Bulao Auth] MSG91 Widget OTP sent successfully! Request ID:", requestId);
        const widgetChallenge: OtpChallenge = {
          requestId: requestId,
          expiresIn: 300,
          resendAfter: 60,
          otpLength: OTP_LENGTH,
          provider: "widget",
        };
        setChallenge(widgetChallenge);
        transitionToOtp();
        return;
      } else {
        const errorMsg = response.message || (response.code ? `Error code: ${response.code}` : "Failed to send OTP via widget");
        console.warn("[Bulao Auth] Widget returned error, attempting backend fallback:", errorMsg);
        // Fallback to backend send-otp
        const res = await api<{
          requestId: string;
          expiresIn: number;
          resendAfter: number;
          otpLength: number;
        }>("/auth/send-otp", { phone: fullPhone });
        if (!mounted.current) return;
        const backendChallenge: OtpChallenge = {
          requestId: res.requestId,
          expiresIn: res.expiresIn || 300,
          resendAfter: res.resendAfter || 60,
          otpLength: res.otpLength || OTP_LENGTH,
          provider: "backend",
        };
        setChallenge(backendChallenge);
        transitionToOtp();
      }
    } catch (failure) {
      if (!mounted.current) return;
      console.error("[Bulao Auth] All OTP dispatch routes failed:", failure);
      setError(loginError(failure));
    } finally {
      sending.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  const isValid = validate(phone);

  const termsFooter = (
    <Text style={styles.footerNotice}>
      By continuing, you agree to our{" "}
      <Text
        style={styles.legalLinkText}
        onPress={() => openLegal("Terms of Service", TERMS_URL || "https://bulao.co/terms")}
      >
        Terms
      </Text>
      {" & "}
      <Text
        style={styles.legalLinkText}
        onPress={() => openLegal("Privacy Policy", PRIVACY_URL || "https://bulao.co/privacy")}
      >
        Privacy Policy
      </Text>
    </Text>
  );

  return (
    <LoginScreenLayout
      step={step}
      showHero={step === "phone" || step === "otp"}
      footer={step === "phone" ? termsFooter : null}
    >
      {step === "phone" ? (
        <PhoneStep phone={phone}
          setPhone={(value) => { setPhone(value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
          error={error} loading={loading} isValid={isValid} onContinue={onContinue} />
      ) : step === "otp" && challenge ? (
        <OtpStep fontsReady={fontsReady} phone={phone} challenge={challenge}
          onBusyChange={(busy) => { verifying.current = busy; }}
          onChangePhone={() => { dismissLoginKeyboard("change-phone"); setChallenge(null); setStep("phone"); }} />
      ) : <NameStep fontsReady={fontsReady} />}
    </LoginScreenLayout>
  );
}

function OtpStep({
  fontsReady,
  phone,
  challenge,
  onChangePhone,
  onBusyChange,
}: {
  fontsReady: boolean;
  phone: string;
  challenge: OtpChallenge;
  onChangePhone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [current, setCurrent] = useState(challenge);
  const [otp, setOtp] = useState<string[]>(() => Array(challenge.otpLength).fill(""));
  const [loading, setLoading] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [resendAt, setResendAt] = useState(() => Date.now() + challenge.resendAfter * 1000);
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + challenge.expiresIn * 1000);
  const inputs = useRef<Array<TextInput | null>>([]);
  const verifyButtonHeight = useRef(56);
  const revealInput = useLoginInputFocus();
  const busy = useRef(false);
  const mounted = useRef(true);
  const verifiedAccessToken = useRef<string | null>(null);
  const focusAfterResend = useRef(false);
  const [focused, setFocused] = useState(false);
  const otpHeaderAnim = useRef(new Animated.Value(1)).current;

  const auth = useAuth();

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setFocused(false);
      inputs.current.forEach((input) => input?.blur());
    });
    return () => hideSub.remove();
  }, []);

  useEffect(() => {
    Animated.timing(otpHeaderAnim, {
      toValue: focused ? 0 : 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const headerHeight = otpHeaderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 68],
  });
  const headerOpacity = otpHeaderAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.2, 1],
  });
  const headerTranslateY = otpHeaderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 0],
  });

  const resendSeconds = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  const expired = clock >= expiresAt;
  const hasProof = verifiedAccessToken.current !== null;

  useEffect(() => {
    if (loading === null && focusAfterResend.current) {
      focusAfterResend.current = false;
      inputs.current[0]?.focus();
    }
  }, [loading]);

  const showFailure = (failure: unknown) => {
    setError(loginError(failure));

  };

  // Verify OTP using Backend or MSG91 Widget and create session
  const onVerify = async (manualCode?: string) => {
    if (busy.current) return;
    const otpCode = manualCode || otp.join("");
    // A verified code's timer must not block retrying the session exchange.
    if (!verifiedAccessToken.current && (otpCode.length < current.otpLength || Date.now() >= expiresAt)) return;
    busy.current = true;
    onBusyChange(true);
    setLoading("verify");
    setError("");

    console.log("[Bulao Auth] Verifying OTP. Provider:", current.provider);

    try {
      // In staging QA, support test code 1234
      if (otpCode === "1234" && (__DEV__ || process.env.EXPO_PUBLIC_API_BASE_URL?.includes("staging"))) {
        try {
          const result = await api<{
            token: string;
            expiresAt: number;
            user: UserData;
            isNewUser: boolean;
          }>("/auth/verify-otp", {
            phone: "+91" + phone,
            requestId: current.requestId,
            otp: "1234",
          });
          if (!mounted.current) return;
          const session: SessionData = {
            token: result.token,
            expiresAt: result.expiresAt,
            userId: result.user.id,
          };
          await saveSession(session);
          auth.login({ ...result.user, phone: result.user.phone || ("+91" + phone) }, session);
          setOtp(Array(current.otpLength).fill(""));
          return;
        } catch (testErr) {
          console.warn("[Bulao Auth] Test code bypass did not match, continuing standard verification:", testErr);
        }
      }

      if (current.provider === "backend") {
        // Backend verification route
        const result = await api<{
          token: string;
          expiresAt: number;
          user: UserData;
          isNewUser: boolean;
        }>("/auth/verify-otp", {
          phone: "+91" + phone,
          requestId: current.requestId,
          otp: otpCode,
        });

        if (!mounted.current) return;
        console.log("[Bulao Auth] Backend OTP verified successfully, user ID:", result.user.id);

        const session: SessionData = {
          token: result.token,
          expiresAt: result.expiresAt,
          userId: result.user.id,
        };
        await saveSession(session);
        if (mounted.current) {
          auth.login({ ...result.user, phone: result.user.phone || ("+91" + phone) }, session);
          setOtp(Array(current.otpLength).fill(""));
        }
      } else {
        // Retain proof in memory if the session exchange needs a network retry.
        if (!verifiedAccessToken.current) {
          verifiedAccessToken.current = widgetProof(await OTPWidget.verifyOTP({
            reqId: current.requestId,
            otp: otpCode,
          }));
        }
        if (!mounted.current) return;
        const { user, session } = await completeLogin("91" + phone, verifiedAccessToken.current);
        if (mounted.current) {
          auth.login({ ...user, phone: user.phone || ("91" + phone) }, session);
          verifiedAccessToken.current = null;
          setOtp(Array(current.otpLength).fill(""));
          // AuthContent owns the name-step/route transition from auth state.
        }
      }
    } catch (failure) {
      if (mounted.current) showFailure(failure);
    } finally {
      busy.current = false;
      onBusyChange(false);
      if (mounted.current) setLoading(null);
    }
  };

  // Resend OTP using Backend or MSG91 Widget
  const onResend = async () => {
    if (busy.current || Date.now() < resendAt) return;
    busy.current = true;
    onBusyChange(true);
    setLoading("resend");
    setError("");

    try {
      console.log("[Bulao Auth] Resending OTP via provider:", current.provider);

      if (current.provider === "backend") {
        const res = await api<{
          requestId: string;
          expiresIn: number;
          resendAfter: number;
          otpLength: number;
        }>("/auth/resend-otp", {
          phone: "+91" + phone,
          requestId: current.requestId,
        });

        if (!mounted.current) return;
        console.log("[Bulao Auth] Backend OTP resent successfully:", res.requestId);
        verifiedAccessToken.current = null;
        setCurrent({
          ...current,
          requestId: res.requestId || current.requestId,
          expiresIn: res.expiresIn || current.expiresIn,
          resendAfter: res.resendAfter || current.resendAfter,
        });
        setOtp(Array(current.otpLength).fill(""));
        setExpiresAt(Date.now() + (res.expiresIn || current.expiresIn) * 1000);
        setResendAt(Date.now() + (res.resendAfter || current.resendAfter) * 1000);
        focusAfterResend.current = true;
      } else {
        const retryResponse = await OTPWidget.retryOTP({
          reqId: current.requestId,
          retryChannel: 11, // SMS
        });

        if (retryResponse?.type !== "success") {
          throw new Error(`MSG91: ${retryResponse?.message || "Could not resend OTP. Please try again."}`);
        }
        // Retry can keep the original reqId; its message may only be a status label.
        const retryRequestId = retryResponse.reqId || retryResponse.requestId || current.requestId;
        if (!mounted.current) return;
        verifiedAccessToken.current = null;
        setCurrent({ ...current, requestId: retryRequestId });
        setOtp(Array(current.otpLength).fill(""));
        setExpiresAt(Date.now() + current.expiresIn * 1000);
        setResendAt(Date.now() + current.resendAfter * 1000);
        // Focus after the loading state has made the native inputs editable.
        focusAfterResend.current = true;
      }
    } catch (failure) {
      if (mounted.current) showFailure(failure);
    } finally {
      busy.current = false;
      onBusyChange(false);
      if (mounted.current) setLoading(null);
    }
  };

  const onChange = (idx: number, value: string) => {
    if (busy.current || verifiedAccessToken.current) return;
    const digits = value.replace(/\D/g, "");
    const start = digits.length >= current.otpLength ? 0 : idx;
    setError("");
    let filledCode: string | null = null;
    setOtp((previous) => {
      const next = [...previous];
      if (!digits) next[idx] = "";
      else for (let offset = 0; offset < Math.min(digits.length, current.otpLength - start); offset++) next[start + offset] = digits[offset]!;
      if (next.every(Boolean)) {
        filledCode = next.join("");
      }
      return next;
    });
    if (filledCode) {
      const fullCode = filledCode;
      setTimeout(() => void onVerify(fullCode), 80);
    } else if (digits) {
      inputs.current[Math.min(current.otpLength - 1, start + digits.length)]?.focus();
    }
  };

  const canVerify = (hasProof || (otp.every(Boolean) && !expired)) && !loading;

  return (
    <View style={styles.otpCard}>
      <Animated.View
        style={{
          maxHeight: headerHeight,
          opacity: headerOpacity,
          transform: [{ translateY: headerTranslateY }],
          overflow: "hidden",
        }}
      >
        <Text style={styles.compactHeading}>Enter {current.otpLength}-digit OTP</Text>
        <Text style={styles.compactSub}>Sent to +91 ****** {phone.slice(-4)}</Text>
      </Animated.View>
      <View style={styles.otpRowCompact}>
        {otp.map((digit, index) => (
          <AppTextInput
            key={index}
            ref={(ref) => { inputs.current[index] = ref; }}
            style={[styles.otpBoxCompact, { fontWeight: "bold" }]}
            keyboardType="number-pad"
            maxLength={current.otpLength}
            value={digit}
            editable={!loading && !expired && !hasProof}
            selectTextOnFocus
            selection={{ start: 0, end: digit.length }}
            onFocus={() => {
              setFocused(true);
              revealInput(inputs.current[index] ?? null, { above: 12, below: verifyButtonHeight.current + 16 });
            }}
            onSelectionChange={({ nativeEvent }) => {
              // Typing replaces the selected digit instead of appending to it.
              if (digit && (nativeEvent.selection.start !== 0 || nativeEvent.selection.end !== digit.length)) {
                inputs.current[index]?.setSelection(0, digit.length);
              }
            }}
            onChangeText={(value) => onChange(index, value)}
            onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === "Backspace" && !digit && index > 0) inputs.current[index - 1]?.focus(); }}
            autoComplete={index === 0 ? "sms-otp" : "off"}
            textContentType={index === 0 ? "oneTimeCode" : "none"}
            accessibilityLabel={`OTP digit ${index + 1}`}
            selectionColor={COLORS.green}
            cursorColor={COLORS.green}
            textAlign="center"
          />
        ))}
      </View>
      <View style={styles.otpActionRow}>
        <TouchableOpacity disabled={!!loading || resendSeconds > 0} onPress={() => void onResend()}>
          <Text style={styles.resendCompact}>
            {loading === "resend" ? "Sending…" : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : expired ? "Send new OTP" : "Resend OTP"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!!loading} onPress={onChangePhone}>
          <Text style={styles.changePhoneText}>Change number</Text>
        </TouchableOpacity>
      </View>
      {(__DEV__ || process.env.EXPO_PUBLIC_API_BASE_URL?.includes("staging")) && (
        <Text style={[styles.compactSub, { color: COLORS.green, fontSize: 12, fontWeight: "600", marginVertical: 2 }]}>
          Test Code: 1234
        </Text>
      )}
      {expired && !hasProof && <Text style={styles.errorText}>Code expired. Request a new OTP.</Text>}
      {hasProof && <Text style={styles.compactSub}>Number verified. Retry to finish signing in.</Text>}
      {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
      <TouchableOpacity
        style={[styles.btnCompact, !canVerify && styles.btnDisabled]}
        onLayout={(event) => { verifyButtonHeight.current = event.nativeEvent.layout.height; }}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canVerify, busy: loading === "verify" }}
        activeOpacity={0.85}
        onPress={() => void onVerify()}
        disabled={!canVerify}
      >
        <Text style={styles.btnText}>{loading === "verify" ? "Signing in…" : hasProof ? "Retry sign-in" : "Verify OTP"}</Text>
        {loading === "verify" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnArrow}>→</Text>}
      </TouchableOpacity>
    </View>
  );
}

function NameStep({ fontsReady }: { fontsReady: boolean }) {
  const inputRef = useRef<TextInput>(null);
  const revealInput = useLoginInputFocus();
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const auth = useAuth();

  const sanitize = (val: string) => val.trim().replace(/\s+/g, " ");
  const cleaned = sanitize(name);
  const isValid = cleaned.length >= 2 && cleaned.length <= 60;

  const onSubmit = async () => {
    if (submitting) return;
    setError("");

    if (cleaned.length < 2) {
      setError("Please enter at least 2 characters.");
      return;
    }
    if (cleaned.length > 60) {
      setError("Name cannot exceed 60 characters.");
      return;
    }
    // Unicode letter validation with spaces, dots, and hyphens (supports all Indian & international scripts)
    if (!/^[\p{L}\s.'-]+$/u.test(cleaned)) {
      setError("Please enter a valid name (letters only).");
      return;
    }

    setSubmitting(true);

    try {
      await api("/users/me", { name: cleaned }, "PATCH");
      auth.updateUser({ name: cleaned });
    } catch (err: any) {
      console.error("Save name error:", err);
      setError(err?.message || "Could not save your name. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.authCard}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Text style={[styles.heading, { marginBottom: 0 }]}>Welcome to </Text>
        <BulaoWordmark size={24} color={styles.heading.color} />
        <Text style={[styles.heading, { marginBottom: 0 }]}>!</Text>
      </View>
      <Text style={styles.sub}>What should we call you?</Text>

      <View style={[styles.nameInputWrap, focused && styles.inputWrapFocused, !!error && styles.inputWrapError]}>
        <AppTextInput
          style={styles.nameInput}
          placeholder="Enter your full name"
          ref={inputRef}
          placeholderTextColor={COLORS.muted}
          value={name}
          onChangeText={(t) => { setName(t); setError(""); }}
          onFocus={() => { setFocused(true); revealInput(inputRef.current); }}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          returnKeyType="done"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={60}
          editable={!submitting}
          selectionColor={COLORS.green}
          cursorColor={COLORS.green}
        />
      </View>

      <View style={styles.errorWrap}>
        {error ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onSubmit}
        disabled={submitting || !isValid}
        style={[styles.btn, (!isValid || submitting) && styles.btnDisabled, submitting && styles.btnLoading]}
      >
        {submitting ? (
          <>
            <Text style={styles.btnText}>Saving Name</Text>
            <ActivityIndicator color="#fff" size="small" style={{ marginLeft: 6 }} />
          </>
        ) : (
          <Text style={styles.btnText}>Continue</Text>
        )}
        {!submitting && <Text style={styles.btnArrow}>→</Text>}
      </TouchableOpacity>

      <View style={styles.security}>
        <Text style={styles.lockIcon}>✨</Text>
        <Text style={styles.securityText}>This is how other members will see you</Text>
      </View>
    </View>
  );
}
