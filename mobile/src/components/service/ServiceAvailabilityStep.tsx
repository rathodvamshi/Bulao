import React, { useState, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dash } from "./palette";

// ── Design Tokens ──
const GREEN = "#15803D";
const GREEN_DARK = "#14532D";
const GREEN_SOFT = "#DCFCE7";
const GREEN_BG = "#F0FDF4";
const GREEN_BORDER = "#BBF7D0";
const TEXT_PRIMARY = "#0F172A";
const TEXT_SECONDARY = "#64748B";
const BORDER = "#E2E8F0";
const WHITE = "#FFFFFF";

export type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const DAYS_LIST: { key: DayKey; label: string; fullLabel: string }[] = [
  { key: "Mon", label: "Mon", fullLabel: "Monday" },
  { key: "Tue", label: "Tue", fullLabel: "Tuesday" },
  { key: "Wed", label: "Wed", fullLabel: "Wednesday" },
  { key: "Thu", label: "Thu", fullLabel: "Thursday" },
  { key: "Fri", label: "Fri", fullLabel: "Friday" },
  { key: "Sat", label: "Sat", fullLabel: "Saturday" },
  { key: "Sun", label: "Sun", fullLabel: "Sunday" },
];

export const STANDARD_TIMES = [
  "06:00 AM",
  "07:00 AM",
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
  "08:00 PM",
  "09:00 PM",
  "10:00 PM",
  "11:00 PM",
];

export interface TimeSlot {
  from: string;
  to: string;
}

export interface DaySchedule {
  closed: boolean;
  slots: TimeSlot[];
}

export interface ServiceAvailabilityStepProps {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  serviceId: string;
  serviceName?: string;
  is24x7: boolean;
  onIs24x7Change: (val: boolean) => void;
  selectedDays: DayKey[];
  onSelectedDaysChange: (days: DayKey[]) => void;
  hoursMode: "same" | "different";
  onHoursModeChange: (mode: "same" | "different") => void;
  sameFromTime: string;
  onSameFromTimeChange: (time: string) => void;
  sameToTime: string;
  onSameToTimeChange: (time: string) => void;
  hasBreakSlot: boolean;
  onHasBreakSlotChange: (val: boolean) => void;
  breakFromTime: string;
  onBreakFromTimeChange: (time: string) => void;
  breakToTime: string;
  onBreakToTimeChange: (time: string) => void;
  daySchedules: Record<DayKey, DaySchedule>;
  onDaySchedulesChange: (schedules: Record<DayKey, DaySchedule>) => void;
  onOperatingHoursSummaryChange: (summary: string) => void;
  onNext: () => void;
  onBack: () => void;
  onChangeService?: () => void;
  onChangeCategory?: () => void;
}

// ── Time Normalization Helpers ──
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(" ");
  if (parts.length < 2) return 0;
  const time = parts[0] || "";
  const period = parts[1] || "";
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr || "0", 10);
  const m = parseInt(mStr || "0", 10) || 0;
  if (period.toUpperCase() === "PM" && h < 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

export function validateTimeRange(fromStr: string, toStr: string): boolean {
  const fromMin = timeToMinutes(fromStr);
  const toMin = timeToMinutes(toStr);
  return toMin > fromMin;
}

export function formatAvailabilitySummary(
  is24x7: boolean,
  selectedDays: DayKey[],
  hoursMode: "same" | "different",
  sameFromTime: string,
  sameToTime: string,
  hasBreakSlot: boolean,
  breakFromTime: string,
  breakToTime: string,
  daySchedules: Record<DayKey, DaySchedule>
): string {
  if (is24x7) {
    return "Available 24/7";
  }

  if (selectedDays.length === 0) {
    return "No availability configured";
  }

  if (hoursMode === "same") {
    let dayStr = "";
    if (selectedDays.length === 7) {
      dayStr = "All Days";
    } else if (
      selectedDays.length === 5 &&
      ["Mon", "Tue", "Wed", "Thu", "Fri"].every((d) => selectedDays.includes(d as DayKey))
    ) {
      dayStr = "Mon – Fri";
    } else if (
      selectedDays.length === 6 &&
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].every((d) => selectedDays.includes(d as DayKey))
    ) {
      dayStr = "Mon – Sat";
    } else {
      dayStr = selectedDays.join(", ");
    }

    let timeStr = `${sameFromTime} – ${sameToTime}`;
    if (hasBreakSlot) {
      timeStr += ` & ${breakFromTime} – ${breakToTime}`;
    }

    const unselected = DAYS_LIST.map((d) => d.key).filter((d) => !selectedDays.includes(d));
    let closedStr = "";
    if (unselected.length > 0) {
      closedStr = ` (Closed: ${unselected.join(", ")})`;
    }

    return `${dayStr}: ${timeStr}${closedStr}`;
  }

  // Different Hours mode summary
  const summaryParts: string[] = [];
  DAYS_LIST.forEach((d) => {
    const sched = daySchedules[d.key];
    if (!selectedDays.includes(d.key) || sched?.closed) {
      summaryParts.push(`${d.key}: Closed`);
    } else if (sched?.slots && sched.slots.length > 0) {
      const slotsStr = sched.slots.map((s) => `${s.from}-${s.to}`).join(" & ");
      summaryParts.push(`${d.key}: ${slotsStr}`);
    }
  });

  return summaryParts.join(", ");
}

export function ServiceAvailabilityStep({
  categoryId,
  categoryName,
  categoryIcon,
  serviceId,
  serviceName,
  is24x7,
  onIs24x7Change,
  selectedDays,
  onSelectedDaysChange,
  hoursMode,
  onHoursModeChange,
  sameFromTime,
  onSameFromTimeChange,
  sameToTime,
  onSameToTimeChange,
  hasBreakSlot,
  onHasBreakSlotChange,
  breakFromTime,
  onBreakFromTimeChange,
  breakToTime,
  onBreakToTimeChange,
  daySchedules,
  onDaySchedulesChange,
  onOperatingHoursSummaryChange,
  onNext,
  onBack,
  onChangeService,
  onChangeCategory,
}: ServiceAvailabilityStepProps) {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  // Time picker modal state
  const [timePickerTarget, setTimePickerTarget] = useState<{
    type: "sameFrom" | "sameTo" | "breakFrom" | "breakTo" | "daySlotFrom" | "daySlotTo";
    dayKey?: DayKey;
    slotIndex?: number;
  } | null>(null);

  const [validationError, setValidationError] = useState<string>("");

  // Live formatted schedule summary
  const liveSummary = useMemo(() => {
    return formatAvailabilitySummary(
      is24x7,
      selectedDays,
      hoursMode,
      sameFromTime,
      sameToTime,
      hasBreakSlot,
      breakFromTime,
      breakToTime,
      daySchedules
    );
  }, [
    is24x7,
    selectedDays,
    hoursMode,
    sameFromTime,
    sameToTime,
    hasBreakSlot,
    breakFromTime,
    breakToTime,
    daySchedules,
  ]);

  // Keep parent summary updated
  useEffect(() => {
    onOperatingHoursSummaryChange(liveSummary);
  }, [liveSummary]);

  // Quick Select Highlights
  const isAllDaysSelected =
    selectedDays.length === 7 && DAYS_LIST.every((d) => selectedDays.includes(d.key));
  const isWeekdaysSelected =
    selectedDays.length === 5 &&
    ["Mon", "Tue", "Wed", "Thu", "Fri"].every((d) => selectedDays.includes(d as DayKey));
  const isWeekendsSelected =
    selectedDays.length === 2 &&
    ["Sat", "Sun"].every((d) => selectedDays.includes(d as DayKey));

  // Quick Select Handlers
  const handleQuickSelect = (type: "all" | "weekdays" | "weekends") => {
    setValidationError("");
    if (type === "all") {
      onSelectedDaysChange(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    } else if (type === "weekdays") {
      onSelectedDaysChange(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    } else if (type === "weekends") {
      onSelectedDaysChange(["Sat", "Sun"]);
    }
  };

  // Day Toggle Handler
  const handleToggleDay = (dayKey: DayKey) => {
    setValidationError("");
    if (selectedDays.includes(dayKey)) {
      onSelectedDaysChange(selectedDays.filter((d) => d !== dayKey));
    } else {
      onSelectedDaysChange([...selectedDays, dayKey]);
    }
  };

  // Select Time Option
  const handleSelectTimeValue = (timeValue: string) => {
    if (!timePickerTarget) return;
    setValidationError("");
    const { type, dayKey, slotIndex = 0 } = timePickerTarget;
    setTimePickerTarget(null);

    if (type === "sameFrom") {
      onSameFromTimeChange(timeValue);
    } else if (type === "sameTo") {
      onSameToTimeChange(timeValue);
    } else if (type === "breakFrom") {
      onBreakFromTimeChange(timeValue);
    } else if (type === "breakTo") {
      onBreakToTimeChange(timeValue);
    } else if (dayKey && (type === "daySlotFrom" || type === "daySlotTo")) {
      const currentSched = daySchedules[dayKey] || { closed: false, slots: [{ from: "09:00 AM", to: "07:00 PM" }] };
      const updatedSlots = [...(currentSched.slots || [])];
      if (updatedSlots[slotIndex]) {
        if (type === "daySlotFrom") updatedSlots[slotIndex].from = timeValue;
        if (type === "daySlotTo") updatedSlots[slotIndex].to = timeValue;
      } else {
        updatedSlots.push({ from: "09:00 AM", to: "07:00 PM" });
      }
      onDaySchedulesChange({
        ...daySchedules,
        [dayKey]: { closed: false, slots: updatedSlots },
      });
    }
  };

  // Copy Timing to all other selected days in Different Hours mode
  const handleCopyDayTiming = (sourceDayKey: DayKey) => {
    const sourceSched = daySchedules[sourceDayKey] || {
      closed: false,
      slots: [{ from: "09:00 AM", to: "07:00 PM" }],
    };

    const newSchedules = { ...daySchedules };
    selectedDays.forEach((d) => {
      newSchedules[d] = {
        closed: false,
        slots: sourceSched.slots.map((s) => ({ ...s })),
      };
    });

    onDaySchedulesChange(newSchedules);
    Alert.alert("Timings Copied", `Copied ${sourceDayKey}'s schedule to all selected days.`);
  };

  // Add extra slot for a day in Different Hours mode
  const handleAddDaySlot = (dayKey: DayKey) => {
    const currentSched = daySchedules[dayKey] || { closed: false, slots: [{ from: "09:00 AM", to: "01:00 PM" }] };
    if (currentSched.slots.length >= 2) {
      Alert.alert("Limit Reached", "Maximum 2 time slots per day allowed.");
      return;
    }
    const updatedSlots = [...currentSched.slots, { from: "02:00 PM", to: "06:00 PM" }];
    onDaySchedulesChange({
      ...daySchedules,
      [dayKey]: { closed: false, slots: updatedSlots },
    });
  };

  // Submit & Validate Pipeline
  const handleContinue = () => {
    setValidationError("");

    if (!is24x7) {
      if (selectedDays.length === 0) {
        setValidationError("Please select at least one available day.");
        return;
      }

      if (hoursMode === "same") {
        if (!validateTimeRange(sameFromTime, sameToTime)) {
          setValidationError("End time must be later than start time (e.g. 09:00 AM to 07:00 PM).");
          return;
        }

        if (hasBreakSlot) {
          if (!validateTimeRange(breakFromTime, breakToTime)) {
            setValidationError("Break slot end time must be later than start time.");
            return;
          }
          if (timeToMinutes(breakFromTime) < timeToMinutes(sameToTime)) {
            setValidationError("Second time slot should start after the first slot ends.");
            return;
          }
        }
      } else {
        // Different hours validation
        for (const dayKey of selectedDays) {
          const sched = daySchedules[dayKey];
          if (sched && !sched.closed && sched.slots) {
            for (const slot of sched.slots) {
              if (!validateTimeRange(slot.from, slot.to)) {
                setValidationError(`In ${dayKey}: End time (${slot.to}) must be later than start time (${slot.from}).`);
                return;
              }
            }
          }
        }
      }
    }

    // Validation clean: Proceed to next step
    onNext();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.mainLayout, isLargeScreen && styles.mainLayoutLarge]}>
        {/* Left Column (Primary Form) */}
        <View style={[styles.formColumn, isLargeScreen && styles.formColumnLarge]}>
          {/* Main Heading & Intro */}
          <View style={styles.heroSection}>
            <Text style={styles.tagText}>AVAILABILITY</Text>
            <Text style={styles.heroTitle}>When are you available?</Text>
            <Text style={styles.heroSubtitle}>
              Let customers know on which days and at what times they can contact or request your service.
            </Text>
          </View>

          {/* Section 5: Intro Information Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardIconBox}>
              <Ionicons name="calendar-outline" size={24} color={GREEN} />
            </View>
            <View style={styles.infoCardTextGroup}>
              <Text style={styles.infoCardTitle}>Set your working days and hours</Text>
              <Text style={styles.infoCardDesc}>
                Customers can see your normal availability on your service profile.
              </Text>
            </View>
          </View>

          {/* Section 18: 24/7 Option Toggle Card */}
          <View style={[styles.card, is24x7 && styles.cardHighlight]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleIconCircle}>
                <Ionicons name="time" size={20} color={is24x7 ? GREEN : TEXT_SECONDARY} />
              </View>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleTitle}>24/7 Service</Text>
                <Text style={styles.toggleDesc}>
                  {is24x7 ? "Available all day, every day." : "Enable if your service runs 24 hours a day, 7 days a week."}
                </Text>
              </View>
              <Switch
                value={is24x7}
                onValueChange={onIs24x7Change}
                trackColor={{ false: "#CBD5E1", true: GREEN }}
                thumbColor="#FFFFFF"
              />
            </View>

            {is24x7 && (
              <View style={styles.noticeBox24x7}>
                <Ionicons name="checkmark-circle" size={18} color={GREEN} />
                <Text style={styles.noticeBox24x7Text}>
                  Your service will be shown as available 24 hours a day, 7 days a week.
                </Text>
              </View>
            )}
          </View>

          {/* Normal Availability Controls (Hidden if 24/7 is ON) */}
          {!is24x7 && (
            <>
              {/* Section 6: Quick Selection */}
              <View style={styles.card}>
                <Text style={styles.cardSectionLabel}>Quick Select</Text>
                <View style={styles.quickSelectRow}>
                  <Pressable
                    style={[
                      styles.quickSelectBtn,
                      isAllDaysSelected && styles.quickSelectBtnActive,
                    ]}
                    onPress={() => handleQuickSelect("all")}
                    accessibilityRole="button"
                    accessibilityLabel="Select all days"
                  >
                    <Text
                      style={[
                        styles.quickSelectBtnText,
                        isAllDaysSelected && styles.quickSelectBtnTextActive,
                      ]}
                    >
                      All Days
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.quickSelectBtn,
                      isWeekdaysSelected && styles.quickSelectBtnActive,
                    ]}
                    onPress={() => handleQuickSelect("weekdays")}
                    accessibilityRole="button"
                    accessibilityLabel="Select weekdays Mon to Fri"
                  >
                    <Text
                      style={[
                        styles.quickSelectBtnText,
                        isWeekdaysSelected && styles.quickSelectBtnTextActive,
                      ]}
                    >
                      Weekdays (Mon - Fri)
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.quickSelectBtn,
                      isWeekendsSelected && styles.quickSelectBtnActive,
                    ]}
                    onPress={() => handleQuickSelect("weekends")}
                    accessibilityRole="button"
                    accessibilityLabel="Select weekends Sat and Sun"
                  >
                    <Text
                      style={[
                        styles.quickSelectBtnText,
                        isWeekendsSelected && styles.quickSelectBtnTextActive,
                      ]}
                    >
                      Weekends (Sat - Sun)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Section 7: Select Working Days */}
              <View style={styles.card}>
                <Text style={styles.cardSectionLabel}>Select Working Days</Text>
                <View style={styles.daysGrid}>
                  {DAYS_LIST.map((day) => {
                    const isSelected = selectedDays.includes(day.key);
                    return (
                      <Pressable
                        key={day.key}
                        style={[
                          styles.dayButton,
                          isSelected && styles.dayButtonSelected,
                        ]}
                        onPress={() => handleToggleDay(day.key)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={`Toggle ${day.fullLabel}`}
                      >
                        <View
                          style={[
                            styles.dayCheckCircle,
                            isSelected && styles.dayCheckCircleSelected,
                          ]}
                        >
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color={isSelected ? WHITE : "transparent"}
                          />
                        </View>
                        <Text
                          style={[
                            styles.dayButtonText,
                            isSelected && styles.dayButtonTextSelected,
                          ]}
                        >
                          {day.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {selectedDays.length === 0 && (
                  <Text style={styles.fieldErrorText}>
                    Please select at least one available day.
                  </Text>
                )}
              </View>

              {/* Section 9: Working Hours Segmented Choice */}
              {selectedDays.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardSectionLabel}>Working Hours</Text>

                  {/* Segmented Control */}
                  <View style={styles.segmentedContainer}>
                    <Pressable
                      style={[
                        styles.segmentedBtn,
                        hoursMode === "same" && styles.segmentedBtnActive,
                      ]}
                      onPress={() => onHoursModeChange("same")}
                    >
                      <Text
                        style={[
                          styles.segmentedBtnText,
                          hoursMode === "same" && styles.segmentedBtnTextActive,
                        ]}
                      >
                        Same time for all selected days
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.segmentedBtn,
                        hoursMode === "different" && styles.segmentedBtnActive,
                      ]}
                      onPress={() => onHoursModeChange("different")}
                    >
                      <Text
                        style={[
                          styles.segmentedBtnText,
                          hoursMode === "different" && styles.segmentedBtnTextActive,
                        ]}
                      >
                        Different hours for each day
                      </Text>
                    </Pressable>
                  </View>

                  {/* MODE A: Same time for all selected days */}
                  {hoursMode === "same" && (
                    <View style={styles.sameHoursContainer}>
                      <View style={styles.timePickerRow}>
                        {/* From Time */}
                        <View style={styles.timePickerCol}>
                          <Text style={styles.timePickerLabel}>From</Text>
                          <Pressable
                            style={styles.timePickerBox}
                            onPress={() => setTimePickerTarget({ type: "sameFrom" })}
                          >
                            <Ionicons name="sunny-outline" size={16} color="#D97706" />
                            <Text style={styles.timePickerValue}>{sameFromTime}</Text>
                            <Ionicons name="chevron-down" size={14} color={TEXT_SECONDARY} />
                          </Pressable>
                        </View>

                        <Ionicons
                          name="arrow-forward"
                          size={18}
                          color={TEXT_SECONDARY}
                          style={{ marginTop: 24 }}
                        />

                        {/* To Time */}
                        <View style={styles.timePickerCol}>
                          <Text style={styles.timePickerLabel}>To</Text>
                          <Pressable
                            style={styles.timePickerBox}
                            onPress={() => setTimePickerTarget({ type: "sameTo" })}
                          >
                            <Ionicons name="moon-outline" size={16} color="#2563EB" />
                            <Text style={styles.timePickerValue}>{sameToTime}</Text>
                            <Ionicons name="chevron-down" size={14} color={TEXT_SECONDARY} />
                          </Pressable>
                        </View>
                      </View>

                      {/* Same Time Live Summary Box */}
                      <View style={styles.sameHoursSummaryBox}>
                        <Ionicons name="time-outline" size={16} color={GREEN} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sameHoursSummaryTitle}>
                            Selected days: {selectedDays.join(", ")}
                          </Text>
                          <Text style={styles.sameHoursSummarySub}>
                            Time: {sameFromTime} – {sameToTime}
                          </Text>
                        </View>
                      </View>

                      {/* Add Break Slot Toggle */}
                      <View style={styles.breakSlotToggleRow}>
                        <Text style={styles.breakSlotToggleLabel}>
                          Add another time slot (e.g., break hours)
                        </Text>
                        <Switch
                          value={hasBreakSlot}
                          onValueChange={onHasBreakSlotChange}
                          trackColor={{ false: "#CBD5E1", true: GREEN }}
                          thumbColor="#FFFFFF"
                        />
                      </View>

                      {hasBreakSlot && (
                        <View style={styles.breakSlotBox}>
                          <Text style={styles.breakSlotTitle}>Second Slot / After Break</Text>
                          <View style={styles.timePickerRow}>
                            <View style={styles.timePickerCol}>
                              <Text style={styles.timePickerLabel}>From</Text>
                              <Pressable
                                style={styles.timePickerBox}
                                onPress={() => setTimePickerTarget({ type: "breakFrom" })}
                              >
                                <Ionicons name="time-outline" size={16} color={GREEN} />
                                <Text style={styles.timePickerValue}>{breakFromTime}</Text>
                                <Ionicons name="chevron-down" size={14} color={TEXT_SECONDARY} />
                              </Pressable>
                            </View>

                            <Ionicons
                              name="arrow-forward"
                              size={18}
                              color={TEXT_SECONDARY}
                              style={{ marginTop: 24 }}
                            />

                            <View style={styles.timePickerCol}>
                              <Text style={styles.timePickerLabel}>To</Text>
                              <Pressable
                                style={styles.timePickerBox}
                                onPress={() => setTimePickerTarget({ type: "breakTo" })}
                              >
                                <Ionicons name="time-outline" size={16} color={GREEN} />
                                <Text style={styles.timePickerValue}>{breakToTime}</Text>
                                <Ionicons name="chevron-down" size={14} color={TEXT_SECONDARY} />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* MODE B: Different hours for each day */}
                  {hoursMode === "different" && (
                    <View style={styles.differentHoursContainer}>
                      {DAYS_LIST.map((day) => {
                        const isSelected = selectedDays.includes(day.key);
                        const daySched = daySchedules[day.key] || {
                          closed: !isSelected,
                          slots: [{ from: "09:00 AM", to: "07:00 PM" }],
                        };

                        return (
                          <View
                            key={day.key}
                            style={[
                              styles.dayScheduleCard,
                              !isSelected && styles.dayScheduleCardClosed,
                            ]}
                          >
                            <View style={styles.dayScheduleHeader}>
                              <View style={styles.dayScheduleTitleGroup}>
                                <View
                                  style={[
                                    styles.dayStatusDot,
                                    { backgroundColor: isSelected ? GREEN : "#94A3B8" },
                                  ]}
                                />
                                <Text style={styles.dayScheduleTitle}>{day.fullLabel}</Text>
                              </View>

                              {isSelected && (
                                <Pressable
                                  style={styles.copyBtn}
                                  onPress={() => handleCopyDayTiming(day.key)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Copy ${day.fullLabel} timing to all days`}
                                >
                                  <Ionicons name="copy-outline" size={14} color={GREEN} />
                                </Pressable>
                              )}
                            </View>

                            {isSelected ? (
                              <View style={styles.daySlotsWrap}>
                                {(daySched.slots || [{ from: "09:00 AM", to: "07:00 PM" }]).map(
                                  (slot, sIdx) => (
                                    <View key={sIdx} style={styles.daySlotItem}>
                                      <View style={styles.timePickerRow}>
                                        <View style={styles.timePickerCol}>
                                          <Pressable
                                            style={styles.timePickerBox}
                                            onPress={() =>
                                              setTimePickerTarget({
                                                type: "daySlotFrom",
                                                dayKey: day.key,
                                                slotIndex: sIdx,
                                              })
                                            }
                                          >
                                            <Text style={styles.timePickerValue}>{slot.from}</Text>
                                            <Ionicons
                                              name="chevron-down"
                                              size={13}
                                              color={TEXT_SECONDARY}
                                            />
                                          </Pressable>
                                        </View>

                                        <Text style={styles.arrowSep}>→</Text>

                                        <View style={styles.timePickerCol}>
                                          <Pressable
                                            style={styles.timePickerBox}
                                            onPress={() =>
                                              setTimePickerTarget({
                                                type: "daySlotTo",
                                                dayKey: day.key,
                                                slotIndex: sIdx,
                                              })
                                            }
                                          >
                                            <Text style={styles.timePickerValue}>{slot.to}</Text>
                                            <Ionicons
                                              name="chevron-down"
                                              size={13}
                                              color={TEXT_SECONDARY}
                                            />
                                          </Pressable>
                                        </View>
                                      </View>
                                    </View>
                                  )
                                )}

                                {daySched.slots && daySched.slots.length < 2 && (
                                  <Pressable
                                    style={styles.addSlotBtn}
                                    onPress={() => handleAddDaySlot(day.key)}
                                  >
                                    <Ionicons name="add" size={14} color={GREEN} />
                                    <Text style={styles.addSlotBtnText}>Add slot</Text>
                                  </Pressable>
                                )}
                              </View>
                            ) : (
                              <View style={styles.closedCardContent}>
                                <Ionicons name="ban-outline" size={16} color="#DC2626" />
                                <Text style={styles.closedCardText}>
                                  Closed · I am not available on this day.
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* Section 20: Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="checkmark-circle" size={20} color={GREEN} />
              <Text style={styles.summaryTitle}>Your availability</Text>
            </View>

            <View style={styles.summaryBody}>
              <Text style={styles.summaryText}>{liveSummary}</Text>
            </View>
          </View>

          {/* Validation Error Alert */}
          {Boolean(validationError) && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          )}

          {/* Section 21: Sticky Continue & Back Actions */}
          <View style={styles.actionsGroup}>
            <Pressable
              style={styles.continueBtn}
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel="Continue to Step 6"
            >
              <Text style={styles.continueBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>

            <Pressable
              style={styles.backBtn}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back to Step 4"
            >
              <Ionicons name="arrow-back" size={16} color="#475569" />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          </View>
        </View>

        {/* Right Column (Tablet / Large Screen Preview Card) */}
        {isLargeScreen && (
          <View style={styles.sidebarColumn}>
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons name="calendar-outline" size={22} color={GREEN} />
                <Text style={styles.previewTitle}>Looks Good!</Text>
              </View>
              <Text style={styles.previewSub}>
                Here's a quick preview of your availability.
              </Text>

              <View style={styles.previewBodyCard}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewDayLabel}>You are available</Text>
                  <Text style={styles.previewTimeText}>{liveSummary}</Text>
                </View>
              </View>

              <View style={styles.tipsList}>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                  <Text style={styles.tipItemText}>Easy to Set</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                  <Text style={styles.tipItemText}>Flexible Options</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                  <Text style={styles.tipItemText}>More Clarity for Customers</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ── Time Picker Modal Selector ── */}
      <Modal
        visible={timePickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerTarget(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setTimePickerTarget(null)}
        >
          <View style={styles.timePickerSheet}>
            <View style={styles.timePickerSheetHeader}>
              <Text style={styles.timePickerSheetTitle}>Select Time</Text>
              <Pressable onPress={() => setTimePickerTarget(null)}>
                <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {STANDARD_TIMES.map((tVal) => (
                <Pressable
                  key={tVal}
                  style={styles.timeOptionItem}
                  onPress={() => handleSelectTimeValue(tVal)}
                >
                  <Text style={styles.timeOptionText}>{tVal}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainLayout: { gap: 16 },
  mainLayoutLarge: { flexDirection: "row", alignItems: "flex-start" },
  formColumn: { flex: 1, gap: 14 },
  formColumnLarge: { flex: 3 },
  sidebarColumn: { flex: 2, gap: 14 },

  heroSection: { gap: 4 },
  tagText: { fontSize: 12, fontWeight: "800", color: GREEN, letterSpacing: 0.5 },
  heroTitle: { fontSize: 24, fontWeight: "900", color: TEXT_PRIMARY, letterSpacing: -0.4 },
  heroSubtitle: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18 },

  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: GREEN_BG,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
  },
  infoCardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCardTextGroup: { flex: 1, gap: 2 },
  infoCardTitle: { fontSize: 14, fontWeight: "800", color: GREEN_DARK },
  infoCardDesc: { fontSize: 12, color: GREEN_DARK, opacity: 0.8 },

  card: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  cardHighlight: {
    borderColor: GREEN_BORDER,
    backgroundColor: GREEN_BG,
  },
  cardSectionLabel: { fontSize: 14, fontWeight: "800", color: TEXT_PRIMARY },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTextWrap: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 14, fontWeight: "800", color: TEXT_PRIMARY },
  toggleDesc: { fontSize: 11, color: TEXT_SECONDARY },
  noticeBox24x7: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: GREEN_SOFT,
    padding: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  noticeBox24x7Text: { fontSize: 12, fontWeight: "700", color: GREEN_DARK, flex: 1 },

  quickSelectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickSelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: BORDER,
  },
  quickSelectBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  quickSelectBtnText: { fontSize: 12, fontWeight: "700", color: TEXT_SECONDARY },
  quickSelectBtnTextActive: { color: WHITE },

  daysGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayButton: {
    width: 44,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dayButtonSelected: { backgroundColor: GREEN, borderColor: GREEN },
  dayCheckCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  dayCheckCircleSelected: { backgroundColor: GREEN_DARK, borderColor: GREEN_DARK },
  dayButtonText: { fontSize: 11, fontWeight: "800", color: TEXT_PRIMARY },
  dayButtonTextSelected: { color: WHITE },
  fieldErrorText: { fontSize: 12, color: "#DC2626", fontWeight: "700" },

  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
  },
  segmentedBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  segmentedBtnActive: { backgroundColor: WHITE, shadowColor: "#000", shadowOpacity: 0.05, elevation: 1 },
  segmentedBtnText: { fontSize: 11, fontWeight: "700", color: TEXT_SECONDARY, textAlign: "center" },
  segmentedBtnTextActive: { color: GREEN, fontWeight: "800" },

  sameHoursContainer: { gap: 12, marginTop: 4 },
  timePickerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timePickerCol: { flex: 1, gap: 4 },
  timePickerLabel: { fontSize: 12, fontWeight: "700", color: TEXT_SECONDARY },
  timePickerBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  timePickerValue: { fontSize: 13, fontWeight: "800", color: TEXT_PRIMARY },
  sameHoursSummaryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: GREEN_BG,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
  },
  sameHoursSummaryTitle: { fontSize: 12, fontWeight: "800", color: GREEN_DARK },
  sameHoursSummarySub: { fontSize: 11, color: GREEN_DARK, opacity: 0.8 },

  breakSlotToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 },
  breakSlotToggleLabel: { fontSize: 12, fontWeight: "700", color: TEXT_PRIMARY },
  breakSlotBox: { backgroundColor: "#F8FAFC", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: BORDER, gap: 8 },
  breakSlotTitle: { fontSize: 12, fontWeight: "800", color: TEXT_PRIMARY },

  differentHoursContainer: { gap: 10 },
  dayScheduleCard: { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: BORDER, gap: 8 },
  dayScheduleCardClosed: { opacity: 0.65 },
  dayScheduleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayScheduleTitleGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  dayStatusDot: { width: 7, height: 7, borderRadius: 3.5 },
  dayScheduleTitle: { fontSize: 13, fontWeight: "800", color: TEXT_PRIMARY },
  copyBtn: { padding: 4 },
  daySlotsWrap: { gap: 8 },
  daySlotItem: { gap: 4 },
  arrowSep: { fontSize: 14, fontWeight: "800", color: TEXT_SECONDARY, marginTop: 12 },
  addSlotBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 4 },
  addSlotBtnText: { fontSize: 12, fontWeight: "700", color: GREEN },
  closedCardContent: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4 },
  closedCardText: { fontSize: 12, fontWeight: "600", color: "#DC2626" },

  summaryCard: { backgroundColor: GREEN_BG, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: GREEN_BORDER, gap: 6 },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryTitle: { fontSize: 13, fontWeight: "800", color: GREEN_DARK },
  summaryBody: { paddingLeft: 26 },
  summaryText: { fontSize: 12, fontWeight: "700", color: GREEN_DARK },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { fontSize: 12, fontWeight: "700", color: "#DC2626" },

  actionsGroup: { gap: 10, marginTop: 8 },
  continueBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: GREEN, height: 50, borderRadius: 14 },
  continueBtnText: { fontSize: 15, fontWeight: "800", color: WHITE },
  backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 14, backgroundColor: "#F1F5F9" },
  backBtnText: { fontSize: 14, fontWeight: "700", color: "#475569" },

  previewCard: { backgroundColor: WHITE, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: BORDER, gap: 10 },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewTitle: { fontSize: 16, fontWeight: "800", color: TEXT_PRIMARY },
  previewSub: { fontSize: 12, color: TEXT_SECONDARY },
  previewBodyCard: { backgroundColor: GREEN_BG, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: GREEN_BORDER },
  previewRow: { gap: 2 },
  previewDayLabel: { fontSize: 11, fontWeight: "700", color: GREEN_DARK, opacity: 0.8 },
  previewTimeText: { fontSize: 13, fontWeight: "800", color: GREEN_DARK },
  tipsList: { gap: 6 },
  tipItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipItemText: { fontSize: 12, color: TEXT_PRIMARY },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  timePickerSheet: { backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10 },
  timePickerSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  timePickerSheetTitle: { fontSize: 16, fontWeight: "800", color: TEXT_PRIMARY },
  timeOptionItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  timeOptionText: { fontSize: 15, fontWeight: "700", color: TEXT_PRIMARY, textAlign: "center" },
});
