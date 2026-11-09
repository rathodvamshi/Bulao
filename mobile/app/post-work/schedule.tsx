import { router, Redirect } from "expo-router";
import React, { useState, useImperativeHandle } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/components/ui";
import {
  PostWorkHeader,
  StageProgressIndicator,
  PostWorkFooter,
  ExitModal,
  PostWorkAnimatedContent,
  POST_WORK_TYPOGRAPHY,
} from "../../src/components/PostWorkUI";
import {
  usePostWorkStore,
  Duration,
  Hours,
  ScheduleType,
} from "../../src/features/post-work/store";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_TIME_SLOT_PRESETS = [
  { label: "Morning", time: "8:00 AM – 12:00 PM", icon: "sunny-outline", start: "08:00", end: "12:00" },
  { label: "Afternoon", time: "12:00 PM – 4:00 PM", icon: "partly-sunny-outline", start: "12:00", end: "16:00" },
  { label: "Evening", time: "4:00 PM – 8:00 PM", icon: "moon-outline", start: "16:00", end: "20:00" },
  { label: "Full Day", time: "9:00 AM – 6:00 PM", icon: "time-outline", start: "09:00", end: "18:00" },
];

const TUITION_TIME_SLOT_PRESETS = [
  { label: "Morning Batch", time: "6:30 AM – 8:30 AM", icon: "sunny-outline", start: "06:30", end: "08:30" },
  { label: "Afternoon Class", time: "2:00 PM – 4:00 PM", icon: "partly-sunny-outline", start: "14:00", end: "16:00" },
  { label: "Evening Tuition", time: "5:00 PM – 7:30 PM", icon: "moon-outline", start: "17:00", end: "19:30" },
  { label: "Flexible Hours", time: "Any 2 Hours", icon: "time-outline", start: "09:00", end: "18:00" },
];

// Helper: 24h to 12h
function parse24to12(time24: string): { hour: number; minute: number; ampm: "AM" | "PM" } {
  const [hStr, mStr] = (time24 || "09:00").split(":");
  let h = parseInt(hStr || "9", 10);
  const m = parseInt(mStr || "0", 10);
  if (isNaN(h)) h = 9;
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return {
    hour: h12,
    minute: isNaN(m) ? 0 : m,
    ampm,
  };
}

// Helper: 12h to 24h
function format12to24(hour: number, minute: number, ampm: "AM" | "PM"): string {
  let h = Math.max(1, Math.min(12, hour || 12));
  let m = Math.max(0, Math.min(59, minute || 0));
  let h24 = h;
  if (ampm === "AM") {
    if (h24 === 12) h24 = 0;
  } else {
    if (h24 < 12) h24 += 12;
  }
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Calculate total hours duration string
function calculateDurationHours(startTime24: string, endTime24: string): string {
  const [shStr, smStr] = (startTime24 || "09:00").split(":");
  const [ehStr, emStr] = (endTime24 || "18:00").split(":");
  const sh = parseInt(shStr || "9", 10);
  const sm = parseInt(smStr || "0", 10);
  const eh = parseInt(ehStr || "18", 10);
  const em = parseInt(emStr || "0", 10);
  let startMinutes = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
  let endMinutes = (isNaN(eh) ? 18 : eh) * 60 + (isNaN(em) ? 0 : em);
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Next day
  }
  const diffMinutes = endMinutes - startMinutes;
  const hrs = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (hrs === 0 && mins === 0) return "0 hrs";
  if (mins === 0) return `${hrs} hrs`;
  return `${hrs}h ${mins}m`;
}

export interface PostWorkScheduleHandle {
  validateAndSave: () => boolean;
}

export interface PostWorkScheduleProps {
  embedded?: boolean;
}

export const PostWorkScheduleScreen = React.forwardRef<PostWorkScheduleHandle, PostWorkScheduleProps>(
  function PostWorkScheduleScreen({ embedded = false }, ref) {
  const {
    startDate,
    duration,
    endDate,
    hours,
    startTime,
    endTime,
    scheduleType: storeScheduleType,
    selectedDays: storeSelectedDays,
    timeSlotPreset: storeTimeSlotPreset,
    category,
    categoryName,
    roleName,
    setSchedule,
    setAdaptiveSchedule,
    resetFlow,
  } = usePostWorkStore();

  const isEducation =
    (category || "").toLowerCase().includes("edu") ||
    (categoryName || "").toLowerCase().includes("edu") ||
    (roleName || "").toLowerCase().includes("tutor") ||
    (roleName || "").toLowerCase().includes("teach");

  const slotPresets = isEducation ? TUITION_TIME_SLOT_PRESETS : DEFAULT_TIME_SLOT_PRESETS;

  // Simple, distinct schedule type: "one_time" | "regular"
  const [workFormat, setWorkFormat] = useState<"one_time" | "regular">(
    storeScheduleType === "one_time" ? "one_time" : "regular"
  );

  const [hasEndDate, setHasEndDate] = useState<boolean>(
    storeScheduleType === "fixed_duration" && !!endDate
  );

  const [localStartDate, setLocalStartDate] = useState(startDate || new Date());
  const [localEndDate, setLocalEndDate] = useState<Date | null>(endDate);
  const [localDays, setLocalDays] = useState<string[]>(
    storeSelectedDays && storeSelectedDays.length > 0
      ? storeSelectedDays
      : ["Mon", "Tue", "Wed", "Thu", "Fri"]
  );
  const [localHours, setLocalHours] = useState<Hours>(hours || "custom");
  const [localStartTime, setLocalStartTime] = useState(startTime || "09:00");
  const [localEndTime, setLocalEndTime] = useState(endTime || "18:00");
  const [activeSlotPreset, setActiveSlotPreset] = useState<string>(
    storeTimeSlotPreset || "Full Day"
  );

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const today = new Date();

  // Parse current times for digital alarm UI
  const startParsed = parse24to12(localStartTime);
  const endParsed = parse24to12(localEndTime);

  // Digital Clock Adjustment Handlers
  const adjustHour = (target: "start" | "end", delta: number) => {
    const cur = target === "start" ? startParsed : endParsed;
    let newH = cur.hour + delta;
    if (newH > 12) newH = 1;
    if (newH < 1) newH = 12;
    const new24 = format12to24(newH, cur.minute, cur.ampm);
    if (target === "start") setLocalStartTime(new24);
    else setLocalEndTime(new24);
    setActiveSlotPreset("Custom Hours");
    setLocalHours("custom");
  };

  const adjustMinute = (target: "start" | "end", delta: number) => {
    const cur = target === "start" ? startParsed : endParsed;
    let newM = cur.minute + delta;
    if (newM >= 60) newM = 0;
    if (newM < 0) newM = 45;
    const new24 = format12to24(cur.hour, newM, cur.ampm);
    if (target === "start") setLocalStartTime(new24);
    else setLocalEndTime(new24);
    setActiveSlotPreset("Custom Hours");
    setLocalHours("custom");
  };

  const toggleAmPm = (target: "start" | "end", newAmPm: "AM" | "PM") => {
    const cur = target === "start" ? startParsed : endParsed;
    const new24 = format12to24(cur.hour, cur.minute, newAmPm);
    if (target === "start") setLocalStartTime(new24);
    else setLocalEndTime(new24);
    setActiveSlotPreset("Custom Hours");
    setLocalHours("custom");
  };

  const handleDirectHourInput = (target: "start" | "end", text: string) => {
    const num = parseInt(text.replace(/[^0-9]/g, ""), 10);
    const cur = target === "start" ? startParsed : endParsed;
    if (!isNaN(num) && num >= 1 && num <= 12) {
      const new24 = format12to24(num, cur.minute, cur.ampm);
      if (target === "start") setLocalStartTime(new24);
      else setLocalEndTime(new24);
      setActiveSlotPreset("Custom Hours");
      setLocalHours("custom");
    }
  };

  const handleDirectMinuteInput = (target: "start" | "end", text: string) => {
    const num = parseInt(text.replace(/[^0-9]/g, ""), 10);
    const cur = target === "start" ? startParsed : endParsed;
    if (!isNaN(num) && num >= 0 && num <= 59) {
      const new24 = format12to24(cur.hour, num, cur.ampm);
      if (target === "start") setLocalStartTime(new24);
      else setLocalEndTime(new24);
      setActiveSlotPreset("Custom Hours");
      setLocalHours("custom");
    }
  };

  // Toggle single day
  const handleToggleDay = (day: string) => {
    setLocalDays((prev) => {
      if (prev.includes(day)) {
        return prev.length > 1 ? prev.filter((d) => d !== day) : prev;
      }
      return [...prev, day];
    });
  };

  // Slot preset selection
  const handleSelectSlotPreset = (preset: { label: string; time: string; start: string; end: string }) => {
    setActiveSlotPreset(preset.label);
    setLocalHours("custom");
    setLocalStartTime(preset.start);
    setLocalEndTime(preset.end);
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    if (!h || !m) return time;
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const validateAndSave = (): boolean => {
    if (workFormat === "regular" && hasEndDate && (!localEndDate || localEndDate <= localStartDate)) {
      Alert.alert("Invalid End Date", "The contract end date must be after the start date.");
      return false;
    }

    if (workFormat === "regular" && localDays.length === 0) {
      Alert.alert("Working Days Required", "Please select at least one working day.");
      return false;
    }

    const finalScheduleType: ScheduleType =
      workFormat === "one_time"
        ? "one_time"
        : hasEndDate
        ? "fixed_duration"
        : "recurring";

    const durationVal: Duration =
      workFormat === "one_time" ? "one" : hasEndDate ? "few" : "ongoing";

    const finalHours: Hours = localHours || "custom";
    const finalStartTime = localStartTime || "09:00";
    const finalEndTime = localEndTime || "18:00";
    const timingLabel =
      activeSlotPreset && activeSlotPreset !== "Custom Hours"
        ? activeSlotPreset
        : `${formatTime(finalStartTime)} – ${formatTime(finalEndTime)}`;

    setAdaptiveSchedule({
      scheduleType: finalScheduleType,
      startDate: localStartDate,
      endDate: hasEndDate ? localEndDate : null,
      selectedDays: workFormat === "one_time" ? [] : localDays,
      timeSlotPreset: timingLabel,
      hours: finalHours,
      startTime: finalStartTime,
      endTime: finalEndTime,
    });

    setSchedule(
      localStartDate,
      durationVal,
      hasEndDate ? localEndDate : null,
      finalHours,
      finalStartTime,
      finalEndTime
    );

    // Sync preferred timing into dynamic answers so review screen displays it cleanly
    const currentDynamic = usePostWorkStore.getState().dynamicAnswers || {};
    usePostWorkStore.getState().setDynamicAnswers({
      ...currentDynamic,
      preferredTiming: timingLabel,
      exactStartTime: formatTime(finalStartTime),
      exactEndTime: formatTime(finalEndTime),
    });

    return true;
  };

  useImperativeHandle(ref, () => ({
    validateAndSave,
  }));

  const handleNext = () => {
    if (!validateAndSave()) return;
    router.push("/post-work/pay");
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    resetFlow();
    router.replace("/provider-home");
  };

  const durationText = calculateDurationHours(localStartTime, localEndTime);
  const ContainerComp = embedded ? View : SafeAreaView;

  return (
    <ContainerComp style={styles.container} {...(!embedded ? { edges: ["top" as const] } : {})}>
      {!embedded && (
        <>
          {/* Header */}
          <PostWorkHeader
            title="Schedule"
            currentStep={5}
            totalSteps={7}
            onBack={() => router.push("/post-work/location")}
            onExit={() => setShowExitModal(true)}
          />

          {/* Progress Indicator */}
          <StageProgressIndicator
            currentStep={5}
            onStepPress={(step) => {
              if (step <= 2) {
                router.push({
                  pathname: "/post-work",
                  params: { stage: String(step), preserveDraft: "1" },
                });
              }
              else if (step === 3) router.push("/post-work/details");
              else if (step === 4) router.push("/post-work/location");
            }}
          />
        </>
      )}

      <PostWorkAnimatedContent>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.question}>When will the work happen?</Text>

        {/* 1. WORK SCHEDULE FORMAT (Clean 2 Choices, Simple Words, Zero Duplicates) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Work Schedule Format</Text>

          <View style={styles.formatRow}>
            {/* One-Time Work Card */}
            <Pressable
              onPress={() => setWorkFormat("one_time")}
              style={[
                styles.formatCard,
                workFormat === "one_time" && styles.formatCardActive,
              ]}
            >
              <View style={styles.formatCardTop}>
                <View
                  style={[
                    styles.formatIconCircle,
                    workFormat === "one_time" && styles.formatIconCircleActive,
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={workFormat === "one_time" ? "#FFFFFF" : "#03402D"}
                  />
                </View>
                {workFormat === "one_time" && (
                  <Ionicons name="checkmark-circle" size={20} color="#03402D" />
                )}
              </View>
              <Text
                style={[
                  styles.formatTitle,
                  workFormat === "one_time" && styles.formatTitleActive,
                ]}
              >
                One-Time Work
              </Text>
              <Text style={styles.formatSub}>Single visit or 1-day task</Text>
            </Pressable>

            {/* Regular Work Card */}
            <Pressable
              onPress={() => setWorkFormat("regular")}
              style={[
                styles.formatCard,
                workFormat === "regular" && styles.formatCardActive,
              ]}
            >
              <View style={styles.formatCardTop}>
                <View
                  style={[
                    styles.formatIconCircle,
                    workFormat === "regular" && styles.formatIconCircleActive,
                  ]}
                >
                  <Ionicons
                    name="repeat"
                    size={20}
                    color={workFormat === "regular" ? "#FFFFFF" : "#03402D"}
                  />
                </View>
                {workFormat === "regular" && (
                  <Ionicons name="checkmark-circle" size={20} color="#03402D" />
                )}
              </View>
              <Text
                style={[
                  styles.formatTitle,
                  workFormat === "regular" && styles.formatTitleActive,
                ]}
              >
                Regular Work
              </Text>
              <Text style={styles.formatSub}>Weekly or recurring schedule</Text>
            </Pressable>
          </View>
        </View>

        {/* 2. WORK DATES (Spacious, Clean, No Today/Tomorrow) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {workFormat === "one_time" ? "2. Work Date" : "2. Work Dates"}
          </Text>

          {/* Start and end dates share a row when an end date is enabled. */}
          <View style={[styles.dateFieldsRow, workFormat === "regular" && hasEndDate && styles.dateFieldsRowSplit]}>
            <Pressable
              onPress={() => setShowStartPicker(true)}
              style={[
                styles.dateActionCard,
                styles.dateActionCardCompact,
                workFormat === "regular" && !hasEndDate && styles.dateActionCardSolo,
                workFormat === "regular" && hasEndDate && styles.dateActionCardGrid,
              ]}
            >
              <View style={styles.dateCardMeta}>
                <View style={[styles.dateIconBox, styles.dateIconBoxCompact]}>
                  <Ionicons name="calendar" size={17} color="#03402D" />
                </View>
                <Text style={styles.dateFieldTag}>
                  {workFormat === "one_time" ? "WORK DATE" : "START DATE"}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    styles.dateMainValueCompact,
                    workFormat === "regular" && !hasEndDate && styles.dateMainValueSolo,
                  ]}
                  numberOfLines={1}
                >
                  {formatDate(localStartDate)}
                </Text>
              </View>
              <View style={styles.dateCardChange}>
                <Text style={styles.dateCardChangeText}>Change date</Text>
                <Ionicons name="chevron-forward" size={12} color="#03402D" />
              </View>
            </Pressable>

          {workFormat === "regular" && hasEndDate && (
            <Pressable
              onPress={() => setShowEndPicker(true)}
              style={[styles.dateActionCard, styles.dateActionCardCompact, styles.dateActionCardGrid]}
            >
              <View style={styles.dateCardMeta}>
                <View style={[styles.dateIconBox, styles.dateIconBoxCompact]}>
                  <Ionicons name="calendar-outline" size={17} color="#03402D" />
                </View>
                <Text style={styles.dateFieldTag}>END DATE</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.dateMainValueCompact} numberOfLines={1}>
                  {localEndDate ? formatDate(localEndDate) : "Select date"}
                </Text>
              </View>
              <View style={styles.dateCardChange}>
                <Text style={styles.dateCardChangeText}>Change date</Text>
                <Ionicons name="chevron-forward" size={12} color="#03402D" />
              </View>
            </Pressable>
          )}
          </View>

          {/* Regular Work: End Date Toggle & Card */}
          {workFormat === "regular" && (
            <View style={styles.endDateContainer}>
              <View style={styles.endDateToggleRow}>
                <Pressable
                  onPress={() => {
                    setHasEndDate(false);
                    setLocalEndDate(null);
                  }}
                  style={[
                    styles.durationToggleChip,
                    styles.ongoingToggleChip,
                    !hasEndDate && styles.durationToggleChipActive,
                  ]}
                >
                  <Ionicons
                    name="infinite-outline"
                    size={16}
                    color={!hasEndDate ? "#FFFFFF" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.durationToggleText,
                      !hasEndDate && styles.durationToggleTextActive,
                    ]}
                  >
                    Ongoing (No End Date)
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setHasEndDate(true);
                    if (!localEndDate) {
                      const nextMonth = new Date(localStartDate);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      setLocalEndDate(nextMonth);
                    }
                  }}
                  style={[
                    styles.durationToggleChip,
                    styles.endToggleChip,
                    hasEndDate && styles.durationToggleChipActive,
                  ]}
                >
                  <Ionicons
                    name="flag-outline"
                    size={16}
                    color={hasEndDate ? "#FFFFFF" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.durationToggleText,
                      hasEndDate && styles.durationToggleTextActive,
                    ]}
                  >
                    Set End Date
                  </Text>
                </Pressable>
              </View>

            </View>
          )}

          {showStartPicker && (
            <DateTimePicker
              value={localStartDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, date) => {
                setShowStartPicker(Platform.OS === "ios");
                if (date) setLocalStartDate(date);
              }}
              minimumDate={today}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={localEndDate || new Date(localStartDate.getTime() + 86400000)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, date) => {
                setShowEndPicker(Platform.OS === "ios");
                if (date) setLocalEndDate(date);
              }}
              minimumDate={new Date(localStartDate.getTime() + 86400000)}
            />
          )}
        </View>

        {/* 3. WORKING DAYS (Only shown for Regular Work, Mon-Fri/Weekends/All presets REMOVED) */}
        {workFormat === "regular" && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>3. Working Days</Text>

            <View style={styles.daySelectorRow}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = localDays.includes(day);
                return (
                  <Pressable
                    key={day}
                    onPress={() => handleToggleDay(day)}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        isSelected && styles.dayButtonTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* 4. WORK TIMING (Quick Presets + Spacious Digital Alarm Setter) */}
        <View style={styles.sectionCard}>
          <View style={styles.timeSectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>
                {workFormat === "regular" ? "4. Work Timings" : "3. Work Timings"}
              </Text>
            </View>
            <View style={styles.durationBadge}>
              <Ionicons name="time-outline" size={13} color="#03402D" />
              <Text style={styles.durationBadgeText}>{durationText} / shift</Text>
            </View>
          </View>

          {/* Quick Presets (Spacious 2x2 Grid) */}
          <View style={styles.presetGrid}>
            {slotPresets.map((slot) => {
              const isSelected =
                activeSlotPreset === slot.label ||
                (localStartTime === slot.start && localEndTime === slot.end);
              return (
                <Pressable
                  key={slot.label}
                  onPress={() => handleSelectSlotPreset(slot)}
                  style={[styles.presetCard, isSelected && styles.presetCardActive]}
                >
                  <View style={styles.presetCardLeft}>
                    <Ionicons
                      name={slot.icon as any}
                      size={18}
                      color={isSelected ? "#03402D" : "#64748B"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.presetLabel,
                          isSelected && styles.presetLabelActive,
                        ]}
                      >
                        {slot.label}
                      </Text>
                      <Text style={styles.presetTime}>{slot.time}</Text>
                    </View>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={16} color="#03402D" />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Dedicated Digital Alarm Clock Cards for Start Time & End Time */}
          <View style={styles.digitalAlarmContainer}>
            {/* Start Time Alarm Clock Card */}
            <View style={styles.alarmClockBlock}>
              <View style={styles.alarmBlockHeader}>
                <Ionicons name="sunny" size={15} color="#03402D" />
                <Text style={styles.alarmBlockTitle}>START TIME</Text>
                <Text style={styles.alarmBlockValue}>
                  {formatTime(localStartTime)}
                </Text>
              </View>

              <View style={styles.digitalDialRow}>
                {/* Hours Box & Steppers */}
                <View style={styles.dialCol}>
                  <Pressable
                    onPress={() => adjustHour("start", 1)}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="chevron-up" size={18} color="#03402D" />
                  </Pressable>
                  <View style={styles.dialBox}>
                    <TextInput
                      value={String(startParsed.hour).padStart(2, "0")}
                      onChangeText={(v) => handleDirectHourInput("start", v)}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={styles.dialNumberText}
                      selectTextOnFocus
                    />
                  </View>
                  <Pressable
                    onPress={() => adjustHour("start", -1)}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="chevron-down" size={18} color="#03402D" />
                  </Pressable>
                  <Text style={styles.dialColLabel}>HOURS</Text>
                </View>

                <Text style={styles.digitalColon}>:</Text>

                {/* Minutes Box & Steppers */}
                <View style={styles.dialCol}>
                  <Pressable
                    onPress={() => adjustMinute("start", 15)}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="chevron-up" size={18} color="#03402D" />
                  </Pressable>
                  <View style={styles.dialBox}>
                    <TextInput
                      value={String(startParsed.minute).padStart(2, "0")}
                      onChangeText={(v) => handleDirectMinuteInput("start", v)}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={styles.dialNumberText}
                      selectTextOnFocus
                    />
                  </View>
                  <Pressable
                    onPress={() => adjustMinute("start", -15)}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="chevron-down" size={18} color="#03402D" />
                  </Pressable>
                  <Text style={styles.dialColLabel}>MINS</Text>
                </View>

                {/* AM / PM Segmented Switch */}
                <View style={styles.ampmSelector}>
                  <Pressable
                    onPress={() => toggleAmPm("start", "AM")}
                    style={[
                      styles.ampmButton,
                      startParsed.ampm === "AM" && styles.ampmButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ampmButtonText,
                        startParsed.ampm === "AM" && styles.ampmButtonTextActive,
                      ]}
                    >
                      AM
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleAmPm("start", "PM")}
                    style={[
                      styles.ampmButton,
                      startParsed.ampm === "PM" && styles.ampmButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ampmButtonText,
                        startParsed.ampm === "PM" && styles.ampmButtonTextActive,
                      ]}
                    >
                      PM
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* End Time Alarm Clock Card */}
            <View style={[styles.alarmClockBlock, { marginTop: 12 }]}>
              <View style={styles.alarmBlockHeader}>
                <Ionicons name="moon" size={15} color="#03402D" />
                <Text style={styles.alarmBlockTitle}>END TIME</Text>
                <Text style={styles.alarmBlockValue}>
                  {formatTime(localEndTime)}
                </Text>
              </View>

              <View style={styles.digitalDialRow}>
                {/* Hours Box & Steppers */}
                <View style={styles.dialCol}>
                  <Pressable
                    onPress={() => adjustHour("end", 1)}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="chevron-up" size={18} color="#03402D" />
                  </Pressable>
                  <View style={styles.dialBox}>
                    <TextInput
                      value={String(endParsed.hour).padStart(2, "0")}
                      onChangeText={(v) => handleDirectHourInput("end", v)}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={styles.dialNumberText}
                      selectTextOnFocus
                    />
                  </View>
                  <Pressable
                    onPress={() => adjustHour("end", -1)}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="chevron-down" size={18} color="#03402D" />
                  </Pressable>
                  <Text style={styles.dialColLabel}>HOURS</Text>
                </View>

                <Text style={styles.digitalColon}>:</Text>

                {/* Minutes Box & Steppers */}
                <View style={styles.dialCol}>
                  <Pressable
                    onPress={() => adjustMinute("end", 15)}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="chevron-up" size={18} color="#03402D" />
                  </Pressable>
                  <View style={styles.dialBox}>
                    <TextInput
                      value={String(endParsed.minute).padStart(2, "0")}
                      onChangeText={(v) => handleDirectMinuteInput("end", v)}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={styles.dialNumberText}
                      selectTextOnFocus
                    />
                  </View>
                  <Pressable
                    onPress={() => adjustMinute("end", -15)}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="chevron-down" size={18} color="#03402D" />
                  </Pressable>
                  <Text style={styles.dialColLabel}>MINS</Text>
                </View>

                {/* AM / PM Segmented Switch */}
                <View style={styles.ampmSelector}>
                  <Pressable
                    onPress={() => toggleAmPm("end", "AM")}
                    style={[
                      styles.ampmButton,
                      endParsed.ampm === "AM" && styles.ampmButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ampmButtonText,
                        endParsed.ampm === "AM" && styles.ampmButtonTextActive,
                      ]}
                    >
                      AM
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleAmPm("end", "PM")}
                    style={[
                      styles.ampmButton,
                      endParsed.ampm === "PM" && styles.ampmButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ampmButtonText,
                        endParsed.ampm === "PM" && styles.ampmButtonTextActive,
                      ]}
                    >
                      PM
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 5. LIVE SCHEDULE SUMMARY (Clean, Informative) */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconBox}>
            <Ionicons name="calendar-sharp" size={22} color="#03402D" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryHeading}>
              {workFormat === "one_time"
                ? `One-Time • ${formatDate(localStartDate)}`
                : hasEndDate && localEndDate
                ? `${formatDate(localStartDate)} to ${formatDate(localEndDate)}`
                : `Regular (${localDays.join(", ")})`}
            </Text>
            <Text style={styles.summarySubtext}>
              {formatTime(localStartTime)} – {formatTime(localEndTime)} ({durationText} / shift)
            </Text>
          </View>
        </View>

        <View style={{ height: 36 }} />
      </ScrollView>
      </PostWorkAnimatedContent>

      {!embedded && (
        <>
          {/* Persistent Footer */}
          <PostWorkFooter
            onBack={() => router.push("/post-work/location")}
            onNext={handleNext}
            nextLabel="Next"
          />

          {/* Exit Confirmation Modal */}
          <ExitModal
            visible={showExitModal}
            onClose={() => setShowExitModal(false)}
            onExit={handleConfirmExit}
          />
        </>
      )}
    </ContainerComp>
  );
});

export default function PostWorkScheduleRoute() {
  return <Redirect href={{ pathname: "/post-work", params: { stage: "5" } }} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  stageTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#03402D",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  question: {
    fontSize: POST_WORK_TYPOGRAPHY.screenHeading,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  // Section Cards
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 10,
  },

  // 1. Work Format Type Row (2 Simple Cards)
  formatRow: {
    flexDirection: "row",
    gap: 8,
  },
  formatCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 9,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  formatCardActive: {
    borderColor: "#03402D",
    backgroundColor: "#F0FDF4",
  },
  formatCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  formatIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  formatIconCircleActive: {
    backgroundColor: "#03402D",
  },
  formatTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  formatTitleActive: {
    color: "#03402D",
  },
  formatSub: {
    fontSize: 10.5,
    color: "#64748B",
    lineHeight: 14,
  },

  // 2. Date Selection
  dateFieldsRow: {
    flexDirection: "column",
    gap: 8,
  },
  dateFieldsRowSplit: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
  },
  dateActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 9,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  dateActionCardCompact: {
    width: "100%",
    minWidth: 0,
    minHeight: 96,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dateActionCardSolo: {
    minHeight: 102,
  },
  dateActionCardGrid: {
    width: "48%",
  },
  dateCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  dateIconBoxCompact: {
    width: 27,
    height: 27,
    borderRadius: 8,
  },
  dateFieldTag: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  dateMainValue: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 16,
  },
  dateCardChange: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: "auto",
    paddingTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "#ECFDF5",
    alignSelf: "flex-end",
  },
  dateCardChangeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#03402D",
  },
  dateMainValueCompact: {
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: "800",
    color: "#0F172A",
    includeFontPadding: false,
  },
  dateMainValueSolo: {
    fontSize: 16,
    lineHeight: 20,
  },
  changePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changePillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#03402D",
  },

  // End Date Controls for Regular Work
  endDateContainer: {
    marginTop: 8,
  },
  endDateToggleRow: {
    flexDirection: "row",
    gap: 6,
  },
  durationToggleChip: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 7,
    borderRadius: 9,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  durationToggleChipActive: {
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  ongoingToggleChip: {
    flex: 1.5,
    justifyContent: "flex-start",
    gap: 5,
  },
  endToggleChip: {
    flex: 0.8,
  },
  durationToggleText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#475569",
    flexShrink: 0,
    includeFontPadding: false,
  },
  durationToggleTextActive: {
    color: "#FFFFFF",
  },

  // 3. Working Days Selector (Presets REMOVED)
  daySelectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayButton: {
    flex: 1,
    height: 44,
    minWidth: 0,
    borderRadius: 9,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  dayButtonActive: {
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  dayButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  dayButtonTextActive: {
    color: "#FFFFFF",
  },

  // 4. Timings
  timeSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#03402D",
  },

  // Quick Preset Chips (2x2 Grid)
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  presetCard: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
    justifyContent: "space-between",
  },
  presetCardActive: {
    borderColor: "#03402D",
    backgroundColor: "#F0FDF4",
  },
  presetCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  presetLabelActive: {
    color: "#03402D",
  },
  presetTime: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
  },

  // Dedicated Digital Alarm Blocks
  digitalAlarmContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E2E8F0",
  },
  alarmClockBlock: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  alarmBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  alarmBlockTitle: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#03402D",
    letterSpacing: 0.5,
    flex: 1,
  },
  alarmBlockValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
  },
  digitalDialRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dialCol: {
    alignItems: "center",
  },
  stepBtn: {
    width: 44,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
  },
  dialBox: {
    width: 44,
    height: 44,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  dialNumberText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    padding: 0,
  },
  dialColLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  digitalColon: {
    fontSize: 22,
    fontWeight: "900",
    color: "#03402D",
    marginBottom: 14,
  },
  ampmSelector: {
    marginLeft: 12,
    gap: 4,
    marginBottom: 12,
  },
  ampmButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  ampmButtonActive: {
    backgroundColor: "#03402D",
    borderColor: "#03402D",
  },
  ampmButtonText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
  },
  ampmButtonTextActive: {
    color: "#FFFFFF",
  },

  // 5. Summary Card
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
  },
  summaryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  summaryHeading: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  summarySubtext: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginTop: 2,
  },
});
