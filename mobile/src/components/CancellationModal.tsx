import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
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

  const handleClose = () => {
    if (loading) return;
    setSelectedReason("");
    setCustomDetail("");
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedReason) {
      setError("Please select a cancellation reason.");
      return;
    }
    const finalReason =
      selectedReason === "Other reason"
        ? customDetail.trim() || "Other reason"
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
      handleClose();
    } catch (err: any) {
      setError(err?.message || "Failed to cancel. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>A cancellation reason is required</Text>
            </View>
            <Pressable onPress={handleClose} disabled={loading} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          {/* Warning banner */}
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <Text style={styles.warningText}>
              Cancellations negatively affect your profile reliability rating and completion score.
              Please cancel only when strictly necessary.
            </Text>
          </View>

          {/* Reason options */}
          <ScrollView style={styles.reasonsList} showsVerticalScrollIndicator={false}>
            {reasons.map((r) => {
              const isSelected = selectedReason === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => {
                    setSelectedReason(r);
                    setError(null);
                  }}
                  style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                    {r}
                  </Text>
                </Pressable>
              );
            })}

            {/* Optional custom note */}
            <View style={styles.detailInputContainer}>
              <Text style={styles.inputLabel}>
                {selectedReason === "Other reason"
                  ? "Please specify your reason (Required):"
                  : "Additional details (Optional):"}
              </Text>
              <TextInput
                style={styles.detailInput}
                placeholder="Provide brief context..."
                placeholderTextColor="#94A3B8"
                value={customDetail}
                onChangeText={(t) => {
                  setCustomDetail(t);
                  if (error) setError(null);
                }}
                maxLength={300}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Actions */}
          <View style={styles.actionRow}>
            <Pressable
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Keep Active</Text>
            </Pressable>

            <Pressable
              style={[
                styles.confirmBtn,
                (!selectedReason || loading) && styles.confirmBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedReason || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Cancel</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  container: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  warningBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 17,
    fontWeight: "500",
  },
  reasonsList: {
    maxHeight: 280,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
    backgroundColor: "#FAFCFA",
  },
  reasonOptionSelected: {
    borderColor: colors.green,
    backgroundColor: "#F0FDF4",
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CBD5E1",
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
    fontSize: 14,
    color: colors.ink,
    flex: 1,
  },
  reasonTextSelected: {
    fontWeight: "600",
    color: colors.green,
  },
  detailInputContainer: {
    marginTop: 6,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 6,
  },
  detailInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: "#FAFCFA",
    textAlignVertical: "top",
    minHeight: 64,
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    marginVertical: 6,
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});