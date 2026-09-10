import { router } from "expo-router";
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors } from "../../src/components/ui";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  ExitModal,
} from "../../src/components/PostWorkUI";
import { usePostWorkStore, Duration, Hours } from "../../src/features/post-work/store";

export default function PostWorkScheduleScreen() {
  const { startDate, duration, endDate, hours, startTime, endTime, setSchedule, resetFlow } = usePostWorkStore();

  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localDuration, setLocalDuration] = useState<Duration>(duration);
  const [localEndDate, setLocalEndDate] = useState<Date | null>(endDate);
  const [localHours, setLocalHours] = useState<Hours>(hours);
  const [localStartTime, setLocalStartTime] = useState(startTime);
  const [localEndTime, setLocalEndTime] = useState(endTime);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const handleDurationChange = (dur: Duration) => {
    setLocalDuration(dur);
    if (dur === "one") setLocalEndDate(null);
    else if (dur === "few" && !localEndDate) {
      const defaultEnd = new Date(localStartDate);
      defaultEnd.setDate(defaultEnd.getDate() + 6);
      setLocalEndDate(defaultEnd);
    } else if (dur === "ongoing") setLocalEndDate(null);
  };

  const formatDate = (date: Date) => date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    if (!h || !m) return time;
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const handleNext = () => {
    if (localDuration === "few" && (!localEndDate || localEndDate <= localStartDate)) {
      Alert.alert("Invalid dates", "End date must be after start date.");
      return;
    }
    setSchedule(localStartDate, localDuration, localEndDate, localHours, localStartTime, localEndTime);
    router.push("/post-work/pay");
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    resetFlow();
    router.replace("/provider-home");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header with ← Exit */}
      <PostWorkHeader
        title="Schedule"
        currentStep={5}
        totalSteps={7}
        onExit={() => setShowExitModal(true)}
      />

      {/* Connected Stage Progress Indicator with smooth line & tick animation */}
      <StageProgressIndicator
        currentStep={5}
        onStepPress={(step) => {
          if (step === 1 || step === 2) router.push("/post-work");
          else if (step === 3) router.push("/post-work/details");
          else if (step === 4) router.push("/post-work/location");
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.stageTag}>STAGE 5 OF 7</Text>
        <Text style={styles.question}>When will the work happen?</Text>
        <Text style={styles.subtitle}>
          Pick the start date, how many days, and working hours.
        </Text>

        <View style={styles.quickDateRow}>
          <Pressable onPress={() => setLocalStartDate(today)} style={[styles.quickDateBtn, localStartDate.toDateString() === today.toDateString() && styles.quickDateBtnActive]}>
            <Text style={[styles.quickDateText, localStartDate.toDateString() === today.toDateString() && styles.quickDateTextActive]}>Today</Text>
          </Pressable>
          <Pressable onPress={() => setLocalStartDate(tomorrow)} style={[styles.quickDateBtn, localStartDate.toDateString() === tomorrow.toDateString() && styles.quickDateBtnActive]}>
            <Text style={[styles.quickDateText, localStartDate.toDateString() === tomorrow.toDateString() && styles.quickDateTextActive]}>Tomorrow</Text>
          </Pressable>
          <Pressable onPress={() => setShowStartPicker(true)} style={[styles.quickDateBtn, localStartDate.toDateString() !== today.toDateString() && localStartDate.toDateString() !== tomorrow.toDateString() && styles.quickDateBtnActive]}>
            <Text style={[styles.quickDateText, localStartDate.toDateString() !== today.toDateString() && localStartDate.toDateString() !== tomorrow.toDateString() && styles.quickDateTextActive]}>Pick Date</Text>
          </Pressable>
        </View>

        {showStartPicker && (
          <DateTimePicker value={localStartDate} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, date) => { setShowStartPicker(Platform.OS === "ios"); if (date) setLocalStartDate(date); }} minimumDate={today} />
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Duration</Text>
          <View style={styles.durationRow}>
            <Pressable onPress={() => handleDurationChange("one")} style={[styles.durationCard, localDuration === "one" && styles.durationCardActive]}>
              <Text style={styles.durationIcon}>📅</Text>
              <Text style={[styles.durationText, localDuration === "one" && styles.durationTextActive]}>One Day</Text>
            </Pressable>
            <Pressable onPress={() => handleDurationChange("few")} style={[styles.durationCard, localDuration === "few" && styles.durationCardActive]}>
              <Text style={styles.durationIcon}>📆</Text>
              <Text style={[styles.durationText, localDuration === "few" && styles.durationTextActive]}>Few Days</Text>
            </Pressable>
            <Pressable onPress={() => handleDurationChange("ongoing")} style={[styles.durationCard, localDuration === "ongoing" && styles.durationCardActive]}>
              <Text style={styles.durationIcon}>∞</Text>
              <Text style={[styles.durationText, localDuration === "ongoing" && styles.durationTextActive]}>Ongoing</Text>
            </Pressable>
          </View>
        </View>

        {localDuration === "few" && (
          <View style={styles.section}>
            <Text style={styles.label}>End Date</Text>
            <Pressable onPress={() => setShowEndPicker(true)} style={styles.datePickerBtn}>
              <Text style={styles.datePickerText}>{localEndDate ? formatDate(localEndDate) : "Select end date"}</Text>
            </Pressable>
            {showEndPicker && (
              <DateTimePicker value={localEndDate || new Date(localStartDate.getTime() + 86400000)} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, date) => { setShowEndPicker(Platform.OS === "ios"); if (date) setLocalEndDate(date); }} minimumDate={new Date(localStartDate.getTime() + 86400000)} />
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Working Hours</Text>
          <View style={styles.hoursRow}>
            <Pressable onPress={() => setLocalHours("full")} style={[styles.hoursCard, localHours === "full" && styles.hoursCardActive]}>
              <Text style={styles.hoursIcon}>☀️</Text>
              <Text style={[styles.hoursText, localHours === "full" && styles.hoursTextActive]}>Full Day</Text>
            </Pressable>
            <Pressable onPress={() => setLocalHours("custom")} style={[styles.hoursCard, localHours === "custom" && styles.hoursCardActive]}>
              <Text style={styles.hoursIcon}>🕐</Text>
              <Text style={[styles.hoursText, localHours === "custom" && styles.hoursTextActive]}>Custom</Text>
            </Pressable>
          </View>
        </View>

        {localHours === "custom" && (
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeLabel}>Start Time</Text>
              <Pressable onPress={() => setShowStartTimePicker(true)} style={styles.timeBtn}>
                <Text style={styles.timeText}>{formatTime(localStartTime)}</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeLabel}>End Time</Text>
              <Pressable onPress={() => setShowEndTimePicker(true)} style={styles.timeBtn}>
                <Text style={styles.timeText}>{formatTime(localEndTime)}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {showStartTimePicker && (
          <DateTimePicker value={new Date(`2000-01-01T${localStartTime}`)} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, date) => { setShowStartTimePicker(Platform.OS === "ios"); if (date) { const h = date.getHours().toString().padStart(2, "0"); const m = date.getMinutes().toString().padStart(2, "0"); setLocalStartTime(`${h}:${m}`); } }} />
        )}
        {showEndTimePicker && (
          <DateTimePicker value={new Date(`2000-01-01T${localEndTime}`)} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(event, date) => { setShowEndTimePicker(Platform.OS === "ios"); if (date) { const h = date.getHours().toString().padStart(2, "0"); const m = date.getMinutes().toString().padStart(2, "0"); setLocalEndTime(`${h}:${m}`); } }} />
        )}

        <View style={styles.summary}>
          <Text style={styles.summaryIcon}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryText}>{formatDate(localStartDate)} {localDuration === "few" && localEndDate ? `- ${formatDate(localEndDate)}` : localDuration === "ongoing" ? "(Ongoing)" : ""}</Text>
            <Text style={styles.summarySubtext}>{localHours === "full" ? "Full day" : `${formatTime(localStartTime)} - ${formatTime(localEndTime)}`}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Nav Buttons */}
      <PostWorkFooter
        onBack={() => router.back()}
        onNext={handleNext}
      />

      {/* Exit Confirmation Modal */}
      <ExitModal
        visible={showExitModal}
        onClose={() => setShowExitModal(false)}
        onExit={handleConfirmExit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 32, maxWidth: 640, width: "100%", alignSelf: "center" },
  stageTag: { fontSize: 11, fontWeight: "800", color: colors.green, letterSpacing: 1, marginBottom: 4 },
  question: { fontSize: 24, fontWeight: "800", color: colors.ink, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: "500", color: colors.muted, lineHeight: 20, marginBottom: 20 },
  quickDateRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  quickDateBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center" },
  quickDateBtnActive: { borderColor: colors.green, backgroundColor: colors.green },
  quickDateText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  quickDateTextActive: { color: colors.white },
  section: { marginBottom: 24 },
  label: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 12 },
  durationRow: { flexDirection: "row", gap: 10 },
  durationCard: { flex: 1, aspectRatio: 1, backgroundColor: colors.white, borderRadius: 16, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center", gap: 8 },
  durationCardActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  durationIcon: { fontSize: 28 },
  durationText: { fontSize: 13, fontWeight: "700", color: colors.ink, textAlign: "center" },
  durationTextActive: { color: colors.green },
  datePickerBtn: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 2, borderColor: colors.line, paddingVertical: 16, paddingHorizontal: 16 },
  datePickerText: { fontSize: 16, fontWeight: "600", color: colors.ink },
  hoursRow: { flexDirection: "row", gap: 10 },
  hoursCard: { flex: 1, backgroundColor: colors.white, borderRadius: 16, borderWidth: 2, borderColor: colors.line, paddingVertical: 20, alignItems: "center", gap: 8 },
  hoursCardActive: { borderColor: colors.green, backgroundColor: colors.greenLight },
  hoursIcon: { fontSize: 28 },
  hoursText: { fontSize: 14, fontWeight: "700", color: colors.ink },
  hoursTextActive: { color: colors.green },
  timeRow: { flexDirection: "row", gap: 12, marginTop: -8 },
  timeLabel: { fontSize: 12, fontWeight: "700", color: colors.mutedLight, textTransform: "uppercase", marginBottom: 8 },
  timeBtn: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 2, borderColor: colors.line, paddingVertical: 14, alignItems: "center" },
  timeText: { fontSize: 16, fontWeight: "600", color: colors.ink },
  summary: { flexDirection: "row", gap: 12, backgroundColor: colors.white, padding: 18, borderRadius: 16, borderWidth: 2, borderColor: colors.green, alignItems: "center" },
  summaryIcon: { fontSize: 28 },
  summaryText: { fontSize: 16, fontWeight: "700", color: colors.ink },
  summarySubtext: { fontSize: 13, fontWeight: "500", color: colors.muted, marginTop: 2 },
});
