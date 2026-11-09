import React from "react";
import { View, Text, StyleSheet, Pressable, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  CategoryFormSchema,
  FormFieldConfig,
  FormSectionConfig,
} from "@bulao/domain";
import { AppTextInput } from "../../AppTextInput";

const GREEN = "#15803D";
const GREEN_SOFT = "#DCFCE7";
const TEXT_PRIMARY = "#0F172A";
const TEXT_SECONDARY = "#64748B";
const BORDER = "#E2E8F0";
const WHITE = "#FFFFFF";
const BG_MUTED = "#F8FAFC";
const DANGER = "#DC2626";

interface Props {
  schema: CategoryFormSchema;
  answers: Record<string, any>;
  onChangeAnswer: (key: string, value: any) => void;
  errors?: Record<string, string>;
}

export function isFieldVisible(field: FormFieldConfig, answers: Record<string, any>): boolean {
  if (!field.condition) return true;
  const { field: targetKey, operator, value: expected } = field.condition;
  const current = answers[targetKey];

  if (operator === "equals") {
    return current === expected;
  }
  if (operator === "not_equals") {
    return current !== expected;
  }
  if (operator === "in") {
    if (Array.isArray(expected)) {
      return expected.includes(current);
    }
    return false;
  }
  if (operator === "contains") {
    if (Array.isArray(current)) {
      return current.includes(expected);
    }
    return String(current || "").includes(String(expected));
  }
  return true;
}

export function CategoryFormRenderer({
  schema,
  answers,
  onChangeAnswer,
  errors = {},
}: Props) {
  const renderField = (field: FormFieldConfig) => {
    if (!isFieldVisible(field, answers)) return null;

    const value = answers[field.key];
    const error = errors[field.key];

    return (
      <View key={field.key} style={styles.fieldContainer}>
        <View style={styles.labelRow}>
          <Text style={styles.fieldLabel}>
            {field.label}
            {field.required && <Text style={styles.requiredStar}> *</Text>}
          </Text>
        </View>

        {field.description ? (
          <Text style={styles.fieldDescription}>{field.description}</Text>
        ) : null}

        {/* Text & Number Inputs */}
        {field.type === "text" && (
          <AppTextInput
            placeholder={field.placeholder || `Enter ${field.label}`}
            value={typeof value === "string" ? value : ""}
            onChangeText={(text) => onChangeAnswer(field.key, text)}
            style={error ? styles.inputError : undefined}
          />
        )}

        {field.type === "textarea" && (
          <AppTextInput
            placeholder={field.placeholder || `Describe ${field.label.toLowerCase()}`}
            value={typeof value === "string" ? value : ""}
            onChangeText={(text) => onChangeAnswer(field.key, text)}
            multiline
            numberOfLines={4}
            style={[styles.textArea, error ? styles.inputError : undefined]}
          />
        )}

        {field.type === "number" && (
          <AppTextInput
            placeholder={field.placeholder || "0"}
            value={value != null ? String(value) : ""}
            onChangeText={(text) => {
              const num = parseInt(text.replace(/[^0-9]/g, ""), 10);
              onChangeAnswer(field.key, isNaN(num) ? undefined : num);
            }}
            keyboardType="number-pad"
            style={error ? styles.inputError : undefined}
          />
        )}

        {/* Single Select Chips */}
        {field.type === "single_select" && field.options && (
          <View style={styles.chipRow}>
            {field.options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onChangeAnswer(field.key, opt.value)}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipSelected : styles.chipUnselected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Multi-Select Chips */}
        {field.type === "multi_select" && field.options && (
          <View style={styles.chipRow}>
            {field.options.map((opt) => {
              const list: string[] = Array.isArray(value) ? value : [];
              const isSelected = list.includes(opt.value);

              const toggle = () => {
                const next = isSelected
                  ? list.filter((v) => v !== opt.value)
                  : [...list, opt.value];
                onChangeAnswer(field.key, next);
              };

              return (
                <Pressable
                  key={opt.value}
                  onPress={toggle}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipSelected : styles.chipUnselected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  {isSelected ? (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={GREEN}
                      style={{ marginRight: 4 }}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.chipText,
                      isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Toggle Switch */}
        {field.type === "toggle" && (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>
              {value ? "Yes / Enabled" : "No / Not Available"}
            </Text>
            <Switch
              value={Boolean(value)}
              onValueChange={(val) => onChangeAnswer(field.key, val)}
              trackColor={{ false: "#CBD5E1", true: GREEN_SOFT }}
              thumbColor={value ? GREEN : "#FFFFFF"}
            />
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  };

  const renderSection = (section: FormSectionConfig) => {
    return (
      <View key={section.id} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.description ? (
            <Text style={styles.sectionSubtitle}>{section.description}</Text>
          ) : null}
        </View>

        <View style={styles.sectionBody}>
          {section.fields.map(renderField)}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {schema.sections.map(renderSection)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  sectionCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 14,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  sectionBody: {
    gap: 16,
  },
  fieldContainer: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  requiredStar: {
    color: DANGER,
    fontWeight: "800",
  },
  fieldDescription: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 16,
  },
  textArea: {
    height: 90,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  inputError: {
    borderColor: DANGER,
    borderWidth: 1.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: GREEN_SOFT,
    borderColor: GREEN,
  },
  chipUnselected: {
    backgroundColor: BG_MUTED,
    borderColor: BORDER,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: GREEN,
    fontWeight: "700",
  },
  chipTextUnselected: {
    color: TEXT_PRIMARY,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BG_MUTED,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  errorText: {
    fontSize: 11.5,
    color: DANGER,
    fontWeight: "600",
    marginTop: 2,
  },
});
