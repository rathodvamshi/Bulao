import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  ImageBackground, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { OTPWidget } from "@msg91comm/sendotp-react-native";
import { useAuth, completeLogin } from "../src/auth";

// MSG91 Widget Configuration from environment
const MSG91_WIDGET_ID = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID || "3669686e4b46393237373639";
const MSG91_TOKEN_AUTH = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH || "568607TBQ8oKK8IF6aa02237P1";

type OtpChallenge = { requestId: string; expiresIn: number; resendAfter: number; otpLength: number };

const COLORS = {
  green: "#176B58",
  greenDark: "#0F5041",
  greenSoft: "rgba(23,107,88,0.08)",
  cream: "#FAF8F2",
  white: "#FFFFFF",
  ink: "#1A2421",
  muted: "#6B7A6C",
  border: "#E6E4DC",
  error: "#C8553D",
  errorBg: "rgba(200,85,61,0.08)",
};

export default function Auth() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [focused, setFocused] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const sending = useRef(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const auth = useAuth();
  const router = useRouter();

  // Initialize MSG91 Widget on mount
  useEffect(() => {
    OTPWidget.initializeWidget(MSG91_WIDGET_ID, MSG91_TOKEN_AUTH)
      .then(() => console.log("MSG91 Widget initialized"))
      .catch((err) => console.error("Widget init error:", err));
  }, []);

  const validate = (n: string) => /^[6-9]\d{9}$/.test(n);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const transitionToOtp = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep("otp");
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 50 }),
      ]).start();
    });
  };

  const onContinue = async () => {
    if (sending.current) return;
    setError("");
    if (!validate(phone)) { setError("Please enter a valid Indian mobile number."); shake(); return; }
    sending.current = true;
    setLoading(true);

    try {
      console.log("MSG91: Sending OTP to +91" + phone);
      
      // Use MSG91 Widget to send OTP
      const identifier = "+91" + phone;
      const response = await OTPWidget.sendOTP({ identifier });
      
      console.log("MSG91: OTP sent response:", JSON.stringify(response));
      
      // SDK returns request ID in message field, not requestId
      const requestId = response.requestId || response.message;
      
      if (requestId && response.type === "success") {
        // Create challenge for backend tracking
        const backendChallenge: OtpChallenge = {
          requestId: requestId,
          expiresIn: 300, // 5 minutes
          resendAfter: 60,
          otpLength: 4,
        };
        setChallenge(backendChallenge);
        transitionToOtp();
      } else {
        throw new Error(response.message || "Failed to send OTP");
      }
    } catch (failure) {
      console.error("Send OTP error:", failure);
      setError(failure instanceof Error ? failure.message : "Could not send OTP. Please try again.");
      shake();
    } finally {
      sending.current = false;
      setLoading(false);
    }
  };

  const isValid = phone.length === 10 && validate(phone);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ImageBackground source={require("../assets/images/auth-bg.png")} style={styles.bg} resizeMode="cover">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kav}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={styles.content}>
            <Animated.View style={{ width: "100%", alignItems: "center", transform: [{ translateX: shakeAnim }, { translateY: slideAnim }], opacity: fadeAnim }}>
              {step === "phone" ? (
                <PhoneStep
                  phone={phone}
                  setPhone={(t: string) => { setPhone(t.replace(/\D/g, "")); setError(""); }}
                  error={error}
                  loading={loading}
                  focused={focused}
                  setFocused={setFocused}
                  isValid={isValid}
                  onContinue={onContinue}
                />
              ) : (
                <OtpStep phone={phone} challenge={challenge!} onChangePhone={() => { setChallenge(null); setStep("phone"); }} />
              )}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

function PhoneStep({ phone, setPhone, error, loading, focused, setFocused, isValid, onContinue }: any) {
  return (
    <View style={styles.authCard}>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused, error && styles.inputWrapError]}>
        <Pressable style={styles.country}>
          <Text style={styles.flag}>🇮🇳</Text>
          <Text style={styles.code}>+91</Text>
          <Text style={styles.chevron}>▾</Text>
        </Pressable>
        <View style={styles.divider} />
        <TextInput
          style={styles.input}
          placeholder="Enter mobile number"
          placeholderTextColor={COLORS.muted}
          keyboardType="phone-pad"
          editable={!loading}
          maxLength={10}
          value={phone}
          onChangeText={setPhone}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
        onPress={onContinue}
        disabled={loading || !isValid}
        style={[styles.btn, !isValid && styles.btnDisabled, loading && styles.btnLoading]}
      >
        {loading ? (
          <>
            <Text style={styles.btnText}>Sending OTP</Text>
            <ActivityIndicator color="#fff" size="small" style={{ marginLeft: 6 }} />
          </>
        ) : (
          <Text style={styles.btnText}>Continue</Text>
        )}
        {!loading && <Text style={styles.btnArrow}>→</Text>}
      </TouchableOpacity>

      <View style={styles.security}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.securityText}>We'll send you an OTP to verify your number</Text>
      </View>
    </View>
  );
}

function OtpStep({ phone, challenge, onChangePhone }: { phone: string; challenge: OtpChallenge; onChangePhone: () => void }) {
  const [current, setCurrent] = useState(challenge);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [resendAt, setResendAt] = useState(() => Date.now() + challenge.resendAfter * 1000);
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + challenge.expiresIn * 1000);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const inputs = useRef<Array<TextInput | null>>([]);
  const busy = useRef(false);
  const mounted = useRef(true);
  
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);

  const resendSeconds = Math.max(0, Math.ceil((Math.max(resendAt, blockedUntil) - clock) / 1000));
  const expired = clock >= expiresAt;
  const blocked = clock < blockedUntil;

  const showFailure = (failure: unknown) => {
    setError(failure instanceof Error ? failure.message : "Please try again.");
    if (failure instanceof Error && failure.message.includes("retry")) {
      setBlockedUntil(Date.now() + 600 * 1000); // 10 min block
    }
  };

  // Verify OTP using MSG91 Widget and create session
  const onVerify = async () => {
    if (busy.current || otp.some((digit) => !digit) || expired || blocked) return;
    busy.current = true;
    setLoading("verify");
    setError("");

    try {
      console.log("MSG91: Verifying OTP:", otp.join(""));
      
      // Verify with MSG91 Widget
      const verifyResponse = await OTPWidget.verifyOTP({
        reqId: current.requestId,
        otp: otp.join(""),
      });

      console.log("MSG91: Verify response:", JSON.stringify(verifyResponse));

      // Check if OTP verification succeeded
      if (verifyResponse.type === "success") {
        // Now create session with our backend using the new auth service
        const identifier = "+91" + phone;
        
        const { user, session } = await completeLogin(identifier, current.requestId);
        
        if (mounted.current) {
          // Login successful - update auth context
          auth.login(user, session);
          
          // Clear OTP input
          setOtp(["", "", "", ""]);
          
          // Navigate to home (will be handled by navigation in index.tsx)
          router.replace("/(tabs)/profile");
        }
      } else {
        throw new Error(verifyResponse.message || "Invalid OTP");
      }
    } catch (failure) {
      if (mounted.current) showFailure(failure);
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(null);
    }
  };

  // Resend OTP using MSG91 Widget
  const onResend = async () => {
    if (busy.current || resendSeconds > 0) return;
    busy.current = true;
    setLoading("resend");
    setError("");

    try {
      console.log("MSG91: Resending OTP");

      const retryResponse = await OTPWidget.retryOTP({
        reqId: current.requestId,
        retryChannel: 11, // SMS
      });

      console.log("MSG91: Retry response:", JSON.stringify(retryResponse));

      // SDK returns request ID in message field, not requestId
      const retryRequestId = retryResponse.requestId || retryResponse.message;

      if (retryRequestId && retryResponse.type === "success") {
        const newChallenge: OtpChallenge = {
          requestId: retryRequestId,
          expiresIn: 300,
          resendAfter: 60,
          otpLength: 4,
        };
        
        if (!mounted.current) return;
        setCurrent(newChallenge);
        setOtp(["", "", "", ""]);
        setExpiresAt(Date.now() + newChallenge.expiresIn * 1000);
        setResendAt(Date.now() + newChallenge.resendAfter * 1000);
        inputs.current[0]?.focus();
      } else {
        // If retry doesn't return new requestId, send fresh OTP
        const identifier = "+91" + phone;
        const sendResponse = await OTPWidget.sendOTP({ identifier });
        
        const sendRequestId = sendResponse.requestId || sendResponse.message;
        if (sendRequestId && sendResponse.type === "success") {
          const newChallenge: OtpChallenge = {
            requestId: sendRequestId,
            expiresIn: 300,
            resendAfter: 60,
            otpLength: 4,
          };
          
          if (!mounted.current) return;
          setCurrent(newChallenge);
          setOtp(["", "", "", ""]);
          setExpiresAt(Date.now() + newChallenge.expiresIn * 1000);
          setResendAt(Date.now() + newChallenge.resendAfter * 1000);
          inputs.current[0]?.focus();
        } else {
          throw new Error(sendResponse.message || "Failed to resend OTP");
        }
      }
    } catch (failure) {
      if (mounted.current) showFailure(failure);
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(null);
    }
  };

  const onChange = (idx: number, value: string) => {
    const digits = value.replace(/\D/g, "");
    setError("");
    setOtp((previous) => {
      const next = [...previous];
      if (!digits) next[idx] = "";
      else for (let offset = 0; offset < Math.min(digits.length, 4 - idx); offset++) next[idx + offset] = digits[offset]!;
      return next;
    });
    if (digits) inputs.current[Math.min(3, idx + digits.length)]?.focus();
  };

  const canVerify = otp.every(Boolean) && !expired && !blocked && !loading;

  return (
    <View style={styles.otpCard}>
      <Text style={styles.heading}>Enter the 4-digit OTP</Text>
      <View style={styles.otpRow}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => { inputs.current[index] = ref; }}
            style={styles.otpBox}
            keyboardType="number-pad"
            maxLength={4}
            value={digit}
            editable={!loading && !expired && !blocked}
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
      <Text style={styles.sub}>OTP requested for +91 ****** {phone.slice(-4)}</Text>
      {expired && <Text style={styles.errorText}>Code expired. Request a new OTP.</Text>}
      {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
      <TouchableOpacity
        style={[styles.btn, !canVerify && styles.btnDisabled]}
        activeOpacity={0.85}
        onPress={() => void onVerify()}
        disabled={!canVerify}
      >
        <Text style={styles.btnText}>{loading === "verify" ? "Verifying OTP" : "Verify OTP"}</Text>
        {loading === "verify" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnArrow}>→</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.security} disabled={!!loading || resendSeconds > 0} onPress={() => void onResend()}>
        <Text style={styles.resend}>
          {loading === "resend" ? "Sending OTP…" : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : expired ? "Send a new OTP" : "Resend OTP"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.security} disabled={!!loading} onPress={onChangePhone}>
        <Text style={styles.securityText}>Change mobile number</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  bg: { flex: 1 },
  kav: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 275,
  },
  authCard: { width: "100%", maxWidth: 360, marginTop: -20 },
  otpCard: { width: "100%", maxWidth: 360, marginTop: -20 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1.5,
    borderColor: "rgba(230,228,220,0.9)",
    borderRadius: 20,
    height: 68,
    paddingHorizontal: 16,
    shadowColor: COLORS.green,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  inputWrapFocused: {
    borderColor: COLORS.green,
    backgroundColor: "#fff",
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  inputWrapError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorBg,
  },
  country: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 4 },
  flag: { fontSize: 20 },
  code: { fontWeight: "700", color: COLORS.green, fontSize: 16 },
  chevron: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  divider: { width: 1, height: 26, backgroundColor: COLORS.border, marginHorizontal: 12 },
  input: { flex: 1, fontSize: 17, color: COLORS.ink, fontWeight: "500", letterSpacing: 0.2 },
  errorWrap: { minHeight: 16, justifyContent: "center", marginTop: 0 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorIcon: { fontSize: 13, color: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 13, fontWeight: "500" },
  btn: {
    width: "100%",
    maxWidth: 340,
    marginTop: 2,
    height: 50,
    borderRadius: 18,
    backgroundColor: COLORS.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: COLORS.green,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  btnDisabled: { opacity: 0.45 },
  btnLoading: { opacity: 0.85 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  btnArrow: { color: "#fff", fontSize: 16, fontWeight: "600" },
  security: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  lockIcon: { fontSize: 11 },
  securityText: { color: COLORS.muted, fontSize: 12, fontWeight: "500" },
  heading: { fontSize: 17, fontWeight: "700", color: COLORS.green, textAlign: "center", marginBottom: 12, marginTop: -4 },
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 8 },
  otpBox: {
    width: 52,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(230,228,220,0.9)",
    backgroundColor: "rgba(255,255,255,0.94)",
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.green,
  },
  sub: { textAlign: "center", color: COLORS.muted, fontSize: 13, marginBottom: 14, fontWeight: "500" },
  resend: { color: COLORS.green, fontWeight: "700" },
});