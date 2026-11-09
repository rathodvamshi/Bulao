import { AppText as Text } from "./AppText";
import { AppPressable as Pressable } from "./AppPressable";
import { AppTextInput as TextInput } from "./AppTextInput";
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";

export interface CancellationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title?: string;
  isProvider?: boolean;
}

const SEEKER_REASONS = [
  "Personal emergency",
  "Schedule conflict / timing issue",
  "Location too far / Transport issue",
  "Accepted another job opportunity",
  "Health / Medical reason",
  "Other reason",
];

const PROVIDER_REASONS = [
  "Job requirement changed or postponed",
  "Already hired another candidate",
  "Work schedule or timings changed",
  "Candidate unavailable or unreachable",
  "Budget or operational changes",
  "Other reason",
];

export function CancellationModal({
  visible,
  onClose,
  onConfirm,
  title = "Cancel Application",
  isProvider = false,
}: CancellationModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customDetail, setCustomDetail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasons = isProvider ? PROVIDER_REASONS : SEEKER_REASONS;
  const requiresDetail = selectedReason === "Other reason";
  const canConfirm = Boolean(selectedReason) && (!requiresDetail || customDetail.trim().length >= 3) && !loading;

  useEffect(() => {
    if (!visible) return;
    setSelectedReason("");
    setCustomDetail("");
    setError(null);
    setLoading(false);
  }, [visible, title, isProvider]);

  const handleClose = () => {
    if (loading) return;
    setSelectedReason("");
    setCustomDetail("");
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedReason || (requiresDetail && customDetail.trim().length < 3)) {
      setError(requiresDetail ? "Add a short reason to continue." : "Choose a reason to continue.");
      return;
    }
    const finalReason =
      selectedReason === "Other reason"
        ? customDetail.trim()
        : customDetail.trim()
          ? `${selectedReason} - ${customDetail.trim()}`
          : selectedReason;

    if (finalReason.length < 3) {
      setError("Please provide a reason with at least 3 characters.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onConfirm(finalReason);
      setSelectedReason("");
      setCustomDetail("");
      setError(null);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to cancel. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Dismiss cancellation" />
        <View style={styles.container}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="close-circle-outline" size={21} color="#B5473A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{title}</Text>
              <Text style={styles.subtitle}>{isProvider
                ? "Choose a reason. The seeker will be notified and this spot will reopen."
                : "Choose a reason. The provider will be notified."}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close cancellation"
              onPress={handleClose}
              disabled={loading}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Reason for cancellation</Text>
          <ScrollView
            style={styles.reasonsList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {reasons.map((r) => {
              const isSelected = selectedReason === r;
              return (
                <Pressable
                  key={r}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    setSelectedReason(r);
                    setError(null);
                  }}
                  style={[
                  styles.reasonOption,
                    isSelected && styles.reasonOptionSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text
                    style={[
                      styles.reasonText,
                      isSelected && styles.reasonTextSelected,
                    ]}
                  >
                    {r}
                  </Text>
                </Pressable>
              );
            })}

            {requiresDetail ? <View style={styles.detailInputContainer}>
              <Text style={styles.inputLabel}>Briefly tell us why</Text>
              <TextInput
                style={styles.detailInput}
                placeholder="Your reason"
                placeholderTextColor="#94A3B8"
                value={customDetail}
                onChangeText={(t) => {
                  setCustomDetail(t);
                  if (error) setError(null);
                }}
                maxLength={300}
                multiline
                numberOfLines={2}
              />
            </View> : null}
          </ScrollView>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Actions */}
          <View style={styles.actionRow}>
            <Pressable
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>{isProvider ? "Keep hire" : "Keep application"}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.confirmBtn,
                !canConfirm && styles.confirmBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!canConfirm}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>{isProvider ? "Cancel hire" : "Cancel application"}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(13, 27, 21, 0.42)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  container: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "88%",
    shadowColor: "#10251B",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#D8E0DA",
    marginBottom: 17,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 18,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FFF1EF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 3,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F6F3",
  },
  sectionLabel: { color: colors.ink, fontSize: 13, fontWeight: "700", marginBottom: 9 },
  reasonsList: {
    maxHeight: 300,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E7ECE8",
    marginBottom: 7,
    backgroundColor: "#FFFFFF",
  },
  reasonOptionSelected: {
    borderColor: "#1C7657",
    backgroundColor: "#F0F8F3",
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#C7D3CB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioCircleSelected: {
    borderColor: colors.green,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
    flex: 1,
  },
  reasonTextSelected: {
    fontWeight: "600",
    color: colors.green,
  },
  detailInputContainer: {
    marginTop: 5,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#394B40",
    marginBottom: 6,
  },
  detailInput: {
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: "#FAFCFA",
    textAlignVertical: "top",
    minHeight: 58,
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    marginTop: 6,
    marginBottom: 0,
    textAlign: "left",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D5E0D8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#244738",
  },
  confirmBtn: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B5473A",
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
