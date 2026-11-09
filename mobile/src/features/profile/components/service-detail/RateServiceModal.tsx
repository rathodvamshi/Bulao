import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { AppImage as Image } from "../../../../components/AppImage";
import { uploadServicePhoto } from "../../../../api/servicePhotos";

export interface RateServiceModalProps {
  visible: boolean;
  serviceId: string;
  serviceTitle: string;
  onClose: () => void;
  onSubmit: (stars: number, feedback: string, images: string[]) => Promise<void>;
}

const STAR_LABELS: Record<number, string> = {
  1: "1 - Poor",
  2: "2 - Fair",
  3: "3 - Good",
  4: "4 - Very Good",
  5: "5 - Excellent",
};

export function RateServiceModal({
  visible,
  serviceTitle,
  onClose,
  onSubmit,
}: RateServiceModalProps) {
  const [stars, setStars] = useState<number>(5);
  const [feedback, setFeedback] = useState<string>("");
  const [workImages, setWorkImages] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setStars(5);
    setFeedback("");
    setWorkImages([]);
    setValidationError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handlePickPhotos = async () => {
    try {
      setValidationError(null);
      const remainingSlots = Math.max(1, 5 - workImages.length);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingPhoto(true);
        const uploadedUrls: string[] = [];
        for (const asset of result.assets) {
          try {
            const url = await uploadServicePhoto(asset);
            if (url) uploadedUrls.push(url);
          } catch (uploadErr) {
            console.error("Work image upload error:", uploadErr);
          }
        }
        setWorkImages((prev) => [...prev, ...uploadedUrls].slice(0, 5));
      }
    } catch (err: any) {
      Alert.alert(
        "Photo Upload",
        err?.message || "Could not upload photo. Please try again."
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setWorkImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!stars || stars < 1 || stars > 5) {
      setValidationError("Please select a star rating (1 to 5).");
      return;
    }

    if (workImages.length > 0 && !feedback.trim()) {
      setValidationError("Please add written feedback when uploading photos.");
      return;
    }

    setValidationError(null);
    setSubmitting(true);
    try {
      await onSubmit(stars, feedback.trim(), workImages);
      resetForm();
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || "Failed to submit rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.headerTitle}>Rate Our Service</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {serviceTitle}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            {/* 1. Star Rating Selector */}
            <View style={styles.sectionBox}>
              <Text style={styles.fieldLabel}>1. Select your rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => {
                      setStars(s);
                      setValidationError(null);
                    }}
                    style={styles.starBtn}
                    hitSlop={6}
                  >
                    <Ionicons
                      name={s <= stars ? "star" : "star-outline"}
                      size={32}
                      color={s <= stars ? "#F59E0B" : "#CBD5E1"}
                    />
                  </Pressable>
                ))}
              </View>
              <Text style={styles.starLabelText}>
                {STAR_LABELS[stars] || "Select a rating"}
              </Text>
            </View>

            {/* 2. Written Feedback (Optional unless photos attached) */}
            <View style={styles.sectionBox}>
              <Text style={styles.fieldLabel}>2. Your feedback (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Share your experience with this service..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={feedback}
                onChangeText={(t) => {
                  setFeedback(t);
                  if (validationError) setValidationError(null);
                }}
                textAlignVertical="top"
              />
            </View>

            {/* 3. Work Photos (Optional) */}
            <View style={styles.sectionBox}>
              <View style={styles.photosHeaderRow}>
                <Text style={styles.fieldLabel}>3. Add photos (optional)</Text>
                <Text style={styles.photosCountNotice}>{workImages.length}/5</Text>
              </View>

              <View style={styles.photosGrid}>
                {workImages.map((uri, idx) => (
                  <View key={`${uri}-${idx}`} style={styles.photoThumbItem}>
                    <Image source={{ uri }} style={styles.photoThumbImg} />
                    <Pressable
                      style={styles.removePhotoBtn}
                      onPress={() => handleRemovePhoto(idx)}
                      hitSlop={6}
                    >
                      <Ionicons name="close" size={11} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}

                {workImages.length < 5 && (
                  <Pressable
                    style={styles.addPhotoBtn}
                    onPress={handlePickPhotos}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color="#047857" />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={20} color="#047857" />
                        <Text style={styles.addPhotoText}>+ Photo</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>

            {/* Error Message */}
            {Boolean(validationError) && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color="#DC2626" />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            )}
          </ScrollView>

          {/* Submit Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit Rating"
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Rating</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
    maxHeight: "85%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBox: {
    gap: 6,
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 6,
  },
  starBtn: {
    padding: 3,
  },
  starLabelText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
    textAlign: "center",
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 80,
  },
  photosHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  photosCountNotice: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  photoThumbItem: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  photoThumbImg: {
    width: "100%",
    height: "100%",
  },
  removePhotoBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoBtn: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#047857",
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  addPhotoText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECDD3",
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
    flex: 1,
  },
  submitBtn: {
    backgroundColor: "#034E3B",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
