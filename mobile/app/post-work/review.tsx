import { router } from "expo-router";
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../src/components/ui";
import { PostWorkHeader, PostWorkProgress } from "../../src/components/PostWorkUI";
import { usePostWorkStore } from "../../src/features/post-work/store";
import { api } from "../../src/api/client";

export default function PostWorkReviewScreen() {
  const store = usePostWorkStore();
  const [posting, setPosting] = useState(false);

  const formatDate = (date: Date) => date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    if (!h || !m) return time;
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const handlePost = async () => {
    setPosting(true);
    try {
      // Convert pay amount from rupees to paise
      const payPaise = Math.round(parseFloat(store.payAmount) * 100);
      
      // Convert start date to Unix timestamp
      const startsAt = Math.floor(store.startDate.getTime() / 1000);
      
      // Convert end date to Unix timestamp if applicable
      const endsAt = store.endDate ? Math.floor(store.endDate.getTime() / 1000) : null;
      
      // Create submission key to prevent duplicates
      const submissionKey = `${store.category}-${store.role}-${Date.now()}`;
      
      const jobData = {
        categoryId: store.category,
        roleId: store.role,
        title: store.title,
        workers: store.workers,
        experience: store.experience,
        latitude: store.latitude,
        longitude: store.longitude,
        area: store.locality,
        address: store.address,
        startsAt,
        duration: store.duration,
        endsAt,
        hours: store.hours,
        startTime: store.startTime,
        endTime: store.endTime,
        payPaise,
        payUnit: store.payUnit,
        paidWhen: store.payWhen,
        extras: [...store.extras, ...store.benefits],
        details: store.description,
        submissionKey,
      };
      
      await api("/jobs", jobData, "POST");
      
      Alert.alert("Success! 🎉", "Your job has been posted.", [
        { text: "OK", onPress: () => {
          store.resetFlow();
          router.replace("/provider-home");
        }}
      ]);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not post the job.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PostWorkHeader title="Review" step={6} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Review & Post</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{store.title}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowIcon}>👷</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Workers</Text>
              <Text style={styles.rowValue}>{store.workers} {store.workers === 1 ? "person" : "people"} • {store.experience}</Text>
            </View>
            <Pressable onPress={() => router.push("/post-work/details")}><Text style={styles.editBtn}>✏️</Text></Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowIcon}>📍</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Location</Text>
              <Text style={styles.rowValue}>{store.locality}</Text>
              {store.address && <Text style={styles.rowSubtext}>{store.address}</Text>}
            </View>
            <Pressable onPress={() => router.push("/post-work/location")}><Text style={styles.editBtn}>✏️</Text></Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowIcon}>📅</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Schedule</Text>
              <Text style={styles.rowValue}>
                {formatDate(store.startDate)} {store.duration === "few" && store.endDate ? `- ${formatDate(store.endDate)}` : store.duration === "ongoing" ? "(Ongoing)" : ""}
              </Text>
              <Text style={styles.rowSubtext}>{store.hours === "full" ? "Full day" : `${formatTime(store.startTime)} - ${formatTime(store.endTime)}`}</Text>
            </View>
            <Pressable onPress={() => router.push("/post-work/schedule")}><Text style={styles.editBtn}>✏️</Text></Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowIcon}>💰</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Payment</Text>
              <Text style={styles.rowValue}>₹{store.payAmount} per {store.payUnit}</Text>
              <Text style={styles.rowSubtext}>Paid {store.payWhen === "after" ? "after work" : store.payWhen}</Text>
            </View>
            <Pressable onPress={() => router.push("/post-work/pay")}><Text style={styles.editBtn}>✏️</Text></Pressable>
          </View>

          {store.description && (
            <>
              <View style={styles.divider} />
              <View style={styles.descSection}>
                <Text style={styles.descLabel}>Details</Text>
                <Text style={styles.descText}>{store.description}</Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.note}>💡 You can edit or close this job anytime after posting</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handlePost} disabled={posting} style={[styles.postButton, posting && styles.postButtonDisabled]}>
          {posting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.postButtonText}>Post Job</Text>}
        </Pressable>
      </View>

      <PostWorkProgress currentStep={6} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, padding: 20 },
  heading: { fontSize: 22, fontWeight: "800", color: colors.ink, marginBottom: 20 },
  card: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 2, borderColor: colors.green, padding: 20, gap: 16 },
  cardHeader: { marginBottom: 8 },
  cardTitle: { fontSize: 20, fontWeight: "700", color: colors.ink },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  rowIcon: { fontSize: 24, marginTop: 2 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 12, fontWeight: "700", color: colors.mutedLight, textTransform: "uppercase", marginBottom: 4 },
  rowValue: { fontSize: 16, fontWeight: "600", color: colors.ink },
  rowSubtext: { fontSize: 14, fontWeight: "500", color: colors.muted, marginTop: 2 },
  editBtn: { fontSize: 20, color: colors.green },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  descSection: { gap: 8 },
  descLabel: { fontSize: 12, fontWeight: "700", color: colors.mutedLight, textTransform: "uppercase" },
  descText: { fontSize: 14, fontWeight: "500", color: colors.ink, lineHeight: 20 },
  note: { fontSize: 14, fontWeight: "500", color: colors.muted, textAlign: "center", marginTop: 16, paddingHorizontal: 20, lineHeight: 20 },
  footer: { padding: 20, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  postButton: { backgroundColor: colors.green, borderRadius: 16, paddingVertical: 18, alignItems: "center" },
  postButtonDisabled: { opacity: 0.6 },
  postButtonText: { fontSize: 18, fontWeight: "700", color: colors.white },
});
