import { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client";
import { colors } from "../../../components/ui";
import { useLocation } from "../../../store/location";
import { useAuth } from "../../../auth";
import type { CommonProfileData } from "../types";

export function formatPhoneNumber(phone?: string) {
  if (!phone) return "No mobile number";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    const core = digits.slice(2);
    return `+91 ${core.slice(0, 5)} ${core.slice(5)}`;
  }
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  }
  return phone;
}

function formatMemberSince(createdAt?: number) {
  if (!createdAt) return "Active Member";
  const date = new Date(createdAt > 1e11 ? createdAt : createdAt * 1000);
  if (isNaN(date.getTime())) return "Active Member";
  const month = date.toLocaleString("default", { month: "short" });
  const year = date.getFullYear();
  return `Member since ${month} ${year}`;
}

export function CommonIdentityCard({
  profile,
}: {
  profile: CommonProfileData;
}) {
  const client = useQueryClient();
  const location = useLocation((x) => x.location);
  const auth = useAuth();

  const activePhone = profile.phone || auth.user?.phone || "";

  // Edit Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name || "");
  const [currentPhone, setCurrentPhone] = useState(activePhone);

  useEffect(() => {
    if (activePhone && (!currentPhone || currentPhone !== activePhone)) {
      setCurrentPhone(activePhone);
    }
  }, [activePhone]);

  // Phone Change & OTP Flow State
  const [isChangingPhone, setIsChangingPhone] = useState(false);
  const [newPhoneInput, setNewPhoneInput] = useState("");
  const [otpStep, setOtpStep] = useState<"idle" | "otp_sent">("idle");
  const [requestId, setRequestId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>();

  const displayArea = location?.area || profile.area || "Indiranagar, Bangalore";

  const initials = (profile.name || "U")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  // Upload Avatar
  const uploadAvatar = useMutation({
    mutationFn: async () => {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (picked.canceled) return false;
      const photo = picked.assets[0];
      if (!photo) return false;

      const bytes = photo.fileSize || 1024 * 1024;
      const mimeType = photo.mimeType ?? "image/jpeg";

      const signed = await api<{ url: string; fields: Record<string, string> }>(
        "/images/authorize",
        { mimeType, bytes },
      );

      const body = new FormData();
      for (const [key, value] of Object.entries(signed.fields)) {
        body.append(key, value);
      }
      body.append("file", {
        uri: photo.uri,
        name: photo.fileName ?? "avatar.jpg",
        type: mimeType,
      } as unknown as Blob);

      const result = await fetch(signed.url, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(60000),
      });
      if (!result.ok) throw new Error("Failed to upload avatar");

      await api("/images/confirm", { assetId: signed.fields.public_id });
      return true;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["me"] });
    },
  });

  // Save Name & Profile Details
  const saveName = useMutation({
    mutationFn: async () => {
      if (nameInput.trim() !== profile.name) {
        await api(
          "/users/me",
          {
            name: nameInput.trim(),
            area: displayArea,
          },
          "PATCH",
        );
      }
    },
    onSuccess: () => {
      setIsEditModalVisible(false);
      void client.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err: any) => {
      setOtpError(err?.message || "Failed to save profile changes.");
    },
  });

  // Send OTP for new mobile number
  const handleSendOtp = async () => {
    setOtpError("");
    setOtpSuccess("");
    const cleaned = newPhoneInput.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      setOtpError("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setIsSendingOtp(true);
      const res = await api<{
        requestId: string;
        newPhone: string;
        message: string;
        devOtp?: string;
      }>("/users/phone/send-otp", { newPhone: cleaned }, "POST");

      setRequestId(res.requestId);
      setDevOtp(res.devOtp);
      setOtpStep("otp_sent");
      setOtpSuccess(`OTP sent to +91 ${cleaned}`);
    } catch (err: any) {
      setOtpError(err?.message || "Failed to send verification code. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify OTP and update mobile number in database & local state
  const handleVerifyOtp = async () => {
    setOtpError("");
    setOtpSuccess("");
    if (otpCode.trim().length < 4) {
      setOtpError("Please enter the 6-digit OTP received.");
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const res = await api<{
        success: boolean;
        phone: string;
        message: string;
      }>("/users/phone/verify-otp", { requestId, otp: otpCode.trim() }, "POST");

      const updatedPhone = res.phone || newPhoneInput.replace(/\D/g, "");
      setCurrentPhone(updatedPhone);
      setIsChangingPhone(false);
      setNewPhoneInput("");
      setOtpStep("idle");
      setOtpCode("");
      setDevOtp(undefined);
      setOtpSuccess(`Mobile number updated to +91 ${updatedPhone} successfully!`);
      void client.invalidateQueries({ queryKey: ["me"] });
    } catch (err: any) {
      setOtpError(err?.message || "Invalid OTP code. Please check and re-enter.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* ── Top Row: Avatar + Info + Top-Right Edit Button ── */}
      <View style={styles.topRow}>
        {/* Avatar with Camera Button */}
        <View style={styles.avatarWrap}>
          {profile.photoUrl ? (
            <Image
              source={{ uri: profile.photoUrl }}
              style={styles.avatar}
              accessibilityLabel={profile.name}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={styles.cameraBtn}
            disabled={uploadAvatar.isPending}
            onPress={() => uploadAvatar.mutate()}
          >
            {uploadAvatar.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="camera" size={13} color="#FFFFFF" />
            )}
          </Pressable>
        </View>

        {/* User Details Column */}
        <View style={styles.detailsCol}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {profile.name || "Add Your Name"}
            </Text>
            <View style={styles.verifiedShield}>
              <Ionicons name="shield-checkmark" size={12} color="#075B43" />
            </View>
          </View>

          {/* Phone Row */}
          <View style={styles.phoneRow}>
            <Ionicons name="call" size={13} color="#075B43" />
            <Text style={styles.phoneText}>
              {formatPhoneNumber(activePhone || currentPhone || profile.phone)}
            </Text>
            {Boolean(profile.phoneVerified ?? true) && (
              <View style={styles.verifiedChip}>
                <Ionicons name="checkmark-circle" size={11} color="#075B43" />
                <Text style={styles.verifiedChipText}>Verified</Text>
              </View>
            )}
          </View>

          {/* Location Picker Row */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change location"
            onPress={() => useLocation.getState().setLocationSheetVisible(true)}
            style={styles.locationPill}
          >
            <Ionicons name="location" size={12} color="#075B43" />
            <Text style={styles.locationText} numberOfLines={1}>
              {displayArea}
            </Text>
            <Ionicons name="chevron-down" size={11} color="#075B43" />
          </Pressable>
        </View>

        {/* ── Edit Option at Top-Right Corner ── */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile details"
          onPress={() => {
            setNameInput(profile.name || "");
            setCurrentPhone(activePhone || currentPhone || profile.phone || "");
            setIsChangingPhone(false);
            setNewPhoneInput("");
            setOtpStep("idle");
            setOtpCode("");
            setOtpError("");
            setOtpSuccess("");
            setDevOtp(undefined);
            setIsEditModalVisible(true);
          }}
          style={styles.editCornerBtn}
        >
          <Ionicons name="pencil" size={13} color="#075B43" />
          <Text style={styles.editCornerBtnText}>Edit</Text>
        </Pressable>
      </View>

      {/* ── Clean Essential Trust Baseline (5.0 ★) ── */}
      <View style={styles.cleanTrustRow}>
        <View style={styles.trustPill}>
          <Ionicons name="star" size={13} color="#F5B928" />
          <Text style={styles.trustPillScore}>
            {(profile.rating ?? 5.0).toFixed(1)}
          </Text>
          <Text style={styles.trustPillDivider}>·</Text>
          <Text style={styles.trustPillText}>
            {profile.phoneVerified ? "KYC Confirmed" : "Verified Account"}
          </Text>
        </View>
        <Text style={styles.memberSinceText}>
          {formatMemberSince(profile.createdAt)}
        </Text>
      </View>

      {/* ── Edit Profile & Mobile Number Modal ── */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <Text style={styles.modalSubtitle}>Update your name and mobile number</Text>
              </View>
              <Pressable
                onPress={() => setIsEditModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {/* Field 1: User Full Name */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>User Name</Text>
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  maxLength={50}
                />
              </View>

              {/* Field 2: Current Mobile Number with Right-Corner [ Change ] Button */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Mobile Number</Text>
                
                <View style={styles.phoneDisplayCard}>
                  <View style={styles.phoneDisplayLeft}>
                    <View style={styles.phoneIconCircle}>
                      <Ionicons name="call" size={15} color="#075B43" />
                    </View>
                    <View>
                      <Text style={styles.currentPhoneValue}>
                        {formatPhoneNumber(currentPhone || activePhone || profile.phone)}
                      </Text>
                      <Text style={styles.phoneStatusSub}>
                        {profile.phoneVerified ? "Registered Sign-in Number · Verified" : "Registered Sign-in Number"}
                      </Text>
                    </View>
                  </View>

                  {/* Change Button on Right Corner */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Change mobile number"
                    onPress={() => {
                      setIsChangingPhone(!isChangingPhone);
                      setNewPhoneInput("");
                      setOtpStep("idle");
                      setOtpCode("");
                      setOtpError("");
                      setOtpSuccess("");
                      setDevOtp(undefined);
                    }}
                    style={[
                      styles.changePhoneCornerBtn,
                      isChangingPhone && styles.changePhoneCornerBtnActive,
                    ]}
                  >
                    <Ionicons
                      name={isChangingPhone ? "close" : "swap-horizontal"}
                      size={13}
                      color={isChangingPhone ? "#DC2626" : "#075B43"}
                    />
                    <Text
                      style={[
                        styles.changePhoneCornerBtnText,
                        isChangingPhone && { color: "#DC2626" },
                      ]}
                    >
                      {isChangingPhone ? "Cancel" : "Change"}
                    </Text>
                  </Pressable>
                </View>

                {/* When [ Change ] is pressed: Ask New Mobile Number */}
                {isChangingPhone && (
                  <View style={styles.changePhoneBox}>
                    <View style={styles.changePhoneHeader}>
                      <Ionicons name="shield-checkmark" size={15} color="#075B43" />
                      <Text style={styles.changePhoneTitle}>New Mobile Verification</Text>
                    </View>
                    <Text style={styles.changePhoneSubtitle}>
                      Enter your new 10-digit mobile number. We will send an SMS OTP to confirm before updating.
                    </Text>

                    {/* New Phone Number Input */}
                    <View style={styles.phoneInputRow}>
                      <View style={styles.countryCodeBox}>
                        <Text style={styles.countryCodeText}>+91</Text>
                      </View>
                      <TextInput
                        value={newPhoneInput}
                        onChangeText={(val) => {
                          const digits = val.replace(/\D/g, "").slice(0, 10);
                          setNewPhoneInput(digits);
                          if (otpStep !== "idle") setOtpStep("idle");
                          setOtpError("");
                          setOtpSuccess("");
                        }}
                        style={styles.newPhoneField}
                        placeholder="Enter 10-digit new number"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                        maxLength={10}
                        editable={otpStep !== "otp_sent"}
                      />
                    </View>

                    {/* Step 1: Send OTP Button (Only enabled after full 10 digits entered) */}
                    {otpStep === "idle" && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Send OTP"
                        onPress={handleSendOtp}
                        disabled={isSendingOtp || newPhoneInput.length !== 10}
                        style={[
                          styles.sendOtpBtn,
                          newPhoneInput.length !== 10 && styles.sendOtpBtnDisabled,
                        ]}
                      >
                        {isSendingOtp ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="paper-plane" size={14} color="#FFFFFF" />
                            <Text style={styles.sendOtpBtnText}>
                              {newPhoneInput.length === 10
                                ? "Send OTP"
                                : `Send OTP (${newPhoneInput.length}/10 digits)`}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    )}

                    {/* Step 2: OTP Entry & Verification */}
                    {otpStep === "otp_sent" && (
                      <View style={styles.otpVerifyContainer}>
                        <Text style={styles.otpInstructions}>
                          Enter 6-digit OTP sent to +91 {newPhoneInput}:
                        </Text>
                        {devOtp && (
                          <View style={styles.devOtpBadge}>
                            <Ionicons name="key" size={13} color="#075B43" />
                            <Text style={styles.devOtpHint}>
                              Test OTP: <Text style={{ fontWeight: "900" }}>{devOtp}</Text>
                            </Text>
                          </View>
                        )}
                        <TextInput
                          value={otpCode}
                          onChangeText={setOtpCode}
                          style={styles.otpInput}
                          placeholder="• • • • • •"
                          placeholderTextColor="#A0AEC0"
                          keyboardType="number-pad"
                          maxLength={6}
                          autoFocus
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Confirm OTP and Update Mobile Number"
                          onPress={handleVerifyOtp}
                          disabled={isVerifyingOtp || otpCode.trim().length < 4}
                          style={[
                            styles.verifyOtpBtn,
                            otpCode.trim().length < 4 && styles.sendOtpBtnDisabled,
                          ]}
                        >
                          {isVerifyingOtp ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.verifyOtpBtnText}>
                              Confirm OTP &amp; Update Mobile Number
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}

                {/* Feedback Alerts */}
                {otpSuccess ? (
                  <View style={styles.successBox}>
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    <Text style={styles.successBoxText}>{otpSuccess}</Text>
                  </View>
                ) : null}

                {otpError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.errorBoxText}>{otpError}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => saveName.mutate()}
                disabled={
                  saveName.isPending ||
                  nameInput.trim().length < 2 ||
                  (isChangingPhone && otpStep === "otp_sent")
                }
                style={[
                  styles.modalSaveBtn,
                  (nameInput.trim().length < 2 ||
                    (isChangingPhone && otpStep === "otp_sent")) &&
                    styles.modalSaveBtnDisabled,
                ]}
              >
                {saveName.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6ECE8",
    shadowColor: "#0D2318",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E9F8EF",
    borderWidth: 2,
    borderColor: "#D2E8DA",
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#D2E8DA",
  },
  initialsText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#075B43",
  },
  cameraBtn: {
    position: "absolute",
    right: -2,
    bottom: -2,
    backgroundColor: "#075B43",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 2,
  },
  detailsCol: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nameText: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  verifiedShield: {
    backgroundColor: "#E9F8EF",
    padding: 2,
    borderRadius: 6,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 1,
  },
  phoneText: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#E9F8EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#075B43",
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F4F7F4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 2,
    maxWidth: "100%",
  },
  locationText: {
    fontSize: 11,
    color: colors.ink,
    fontWeight: "700",
    flexShrink: 1,
  },
  editCornerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E9F8EF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  editCornerBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#075B43",
  },
  cleanTrustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF3EF",
  },
  trustPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FAFBF9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EAEFEA",
  },
  trustPillScore: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.ink,
  },
  trustPillDivider: {
    fontSize: 12,
    color: colors.mutedLight,
  },
  trustPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#075B43",
  },
  memberSinceText: {
    fontSize: 11,
    color: colors.mutedLight,
    fontWeight: "600",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(13, 35, 24, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3EF",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.ink,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    gap: 16,
    paddingBottom: 16,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
  },
  verifiedMiniChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#E9F8EF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedMiniText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#075B43",
  },
  textInput: {
    height: 48,
    backgroundColor: "#FAFBF9",
    borderWidth: 1,
    borderColor: "#DDE5DF",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  phoneDisplayCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAFBF9",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE5DF",
  },
  phoneDisplayLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  phoneIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E9F8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  currentPhoneValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.ink,
  },
  phoneStatusSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#075B43",
    marginTop: 1,
  },
  changePhoneCornerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E9F8EF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D2E8DA",
  },
  changePhoneCornerBtnActive: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  changePhoneCornerBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#075B43",
  },
  changePhoneBox: {
    backgroundColor: "#F0F7F3",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CDE5D6",
    marginTop: 8,
    gap: 8,
  },
  changePhoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  changePhoneTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#075B43",
  },
  changePhoneSubtitle: {
    fontSize: 11,
    color: colors.mutedLight,
    lineHeight: 15,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#075B43",
    overflow: "hidden",
    marginTop: 4,
  },
  countryCodeBox: {
    backgroundColor: "#E9F8EF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: "#D2E8DA",
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#075B43",
  },
  newPhoneField: {
    flex: 1,
    height: 46,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  devOtpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E9F8EF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D2E8DA",
  },
  otpNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FAF4",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D2E8DA",
    marginTop: 4,
  },
  otpNoticeText: {
    fontSize: 11,
    color: "#075B43",
    fontWeight: "600",
    flex: 1,
  },
  sendOtpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#075B43",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  sendOtpBtnDisabled: {
    opacity: 0.5,
  },
  sendOtpBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  otpVerifyContainer: {
    backgroundColor: "#F7FAF8",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE5DF",
    marginTop: 8,
    gap: 10,
  },
  otpInstructions: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
  },
  devOtpHint: {
    fontSize: 11,
    color: "#075B43",
    backgroundColor: "#E9F8EF",
    padding: 6,
    borderRadius: 6,
  },
  otpInput: {
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#075B43",
    borderRadius: 12,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 8,
    color: colors.ink,
  },
  verifyOtpBtn: {
    backgroundColor: "#075B43",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyOtpBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginTop: 4,
  },
  successBoxText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
    flex: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginTop: 4,
  },
  errorBoxText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
    flex: 1,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F1F5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  modalSaveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#075B43",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveBtnDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
