import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ServiceOffering, PricingModelType } from "@bulao/domain";
import { AppTextInput } from "../../AppTextInput";

const GREEN = "#15803D";
const GREEN_SOFT = "#DCFCE7";
const TEXT_PRIMARY = "#0F172A";
const TEXT_SECONDARY = "#64748B";
const BORDER = "#E2E8F0";
const WHITE = "#FFFFFF";
const BG_MUTED = "#F8FAFC";
const DANGER = "#DC2626";

const PRICING_MODELS: { id: PricingModelType; label: string; unitDefault: string }[] = [
  { id: "fixed", label: "Fixed Price", unitDefault: "per job" },
  { id: "per_task", label: "Per Task / Item", unitDefault: "per task" },
  { id: "hourly", label: "Hourly Rate", unitDefault: "per hour" },
  { id: "per_day", label: "Daily Rate", unitDefault: "per day" },
  { id: "per_month", label: "Monthly Contract", unitDefault: "per month" },
  { id: "per_session", label: "Per Session / Class", unitDefault: "per session" },
  { id: "price_range", label: "Price Range", unitDefault: "estimate" },
  { id: "inspection", label: "Quote After Inspection", unitDefault: "visit charge" },
  { id: "quote", label: "Contact for Quote", unitDefault: "custom quote" },
];

interface Props {
  categoryId: string;
  categoryName: string;
  offerings: ServiceOffering[];
  onChangeOfferings: (offerings: ServiceOffering[]) => void;
}

export function OfferingManager({
  categoryId,
  categoryName,
  offerings,
  onChangeOfferings,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Draft form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricingModel, setPricingModel] = useState<PricingModelType>("fixed");
  const [rupees, setRupees] = useState("");
  const [minRupees, setMinRupees] = useState("");
  const [maxRupees, setMaxRupees] = useState("");
  const [pricingUnit, setPricingUnit] = useState("per task");
  const [includedWork, setIncludedWork] = useState("");
  const [additionalCharges, setAdditionalCharges] = useState("");
  const [formError, setFormError] = useState("");

  const openAddModal = () => {
    setEditingIndex(null);
    setName("");
    setDescription("");
    setPricingModel("fixed");
    setRupees("");
    setMinRupees("");
    setMaxRupees("");
    setPricingUnit("per task");
    setIncludedWork("");
    setAdditionalCharges("");
    setFormError("");
    setModalVisible(true);
  };

  const openEditModal = (index: number) => {
    const item = offerings[index];
    if (!item) return;
    setEditingIndex(index);
    setName(item.name);
    setDescription(item.description);
    setPricingModel(item.pricingModel);
    setRupees(item.pricePaise ? String(item.pricePaise / 100) : "");
    setMinRupees(item.minPricePaise ? String(item.minPricePaise / 100) : "");
    setMaxRupees(item.maxPricePaise ? String(item.maxPricePaise / 100) : "");
    setPricingUnit(item.pricingUnit || "per task");
    setIncludedWork(item.includedWork || "");
    setAdditionalCharges(item.additionalCharges || "");
    setFormError("");
    setModalVisible(true);
  };

  const handleSaveOffering = () => {
    const editedOffering = editingIndex !== null ? offerings[editingIndex] : undefined;
    if (editingIndex !== null && !editedOffering) {
      setFormError("This offering is no longer available. Refresh the list and try again.");
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setFormError("Offering name is required (at least 2 characters).");
      return;
    }

    const priceNum = parseFloat(rupees);
    const minNum = parseFloat(minRupees);
    const maxNum = parseFloat(maxRupees);

    if (["fixed", "hourly", "per_day", "per_session", "per_month", "per_task"].includes(pricingModel)) {
      if (isNaN(priceNum) || priceNum < 0) {
        setFormError("Enter a valid price in Rupees.");
        return;
      }
    } else if (pricingModel === "price_range") {
      if (isNaN(minNum) || isNaN(maxNum) || minNum > maxNum) {
        setFormError("Enter a valid minimum and maximum price range.");
        return;
      }
    }

    const item: ServiceOffering = {
      id: editedOffering?.id ?? crypto.randomUUID(),
      categoryId,
      name: trimmedName,
      description: description.trim(),
      pricingModel,
      pricePaise: !isNaN(priceNum) ? Math.round(priceNum * 100) : undefined,
      minPricePaise: !isNaN(minNum) ? Math.round(minNum * 100) : undefined,
      maxPricePaise: !isNaN(maxNum) ? Math.round(maxNum * 100) : undefined,
      pricingUnit: pricingUnit.trim() || "per task",
      includedWork: includedWork.trim(),
      additionalCharges: additionalCharges.trim(),
      isActive: editedOffering?.isActive ?? true,
      sortOrder: editedOffering?.sortOrder ?? offerings.length,
    };

    if (editingIndex !== null) {
      const next = [...offerings];
      next[editingIndex] = item;
      onChangeOfferings(next);
    } else {
      onChangeOfferings([...offerings, item]);
    }

    setModalVisible(false);
  };

  const handleDeleteOffering = (index: number) => {
    const next = offerings.filter((_, i) => i !== index);
    onChangeOfferings(next);
  };

  const renderPriceLabel = (offering: ServiceOffering) => {
    if (offering.pricingModel === "quote") return "Contact for quote";
    if (offering.pricingModel === "inspection") {
      const fee = offering.pricePaise ? `₹${offering.pricePaise / 100} visiting fee` : "Inspection required";
      return fee;
    }
    if (offering.pricingModel === "price_range") {
      const min = offering.minPricePaise ? `₹${offering.minPricePaise / 100}` : "₹0";
      const max = offering.maxPricePaise ? `₹${offering.maxPricePaise / 100}` : "N/A";
      return `${min} - ${max} ${offering.pricingUnit}`;
    }
    const val = offering.pricePaise != null ? `₹${offering.pricePaise / 100}` : "₹0";
    return `${val} ${offering.pricingUnit}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Specific Service Offerings</Text>
          <Text style={styles.subtitle}>
            Add the individual services you offer under {categoryName} with flexible pricing.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={openAddModal}
          style={styles.addButton}
        >
          <Ionicons name="add" size={18} color={WHITE} />
          <Text style={styles.addButtonText}>Add Service</Text>
        </Pressable>
      </View>

      {offerings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="pricetags-outline" size={32} color={TEXT_SECONDARY} />
          <Text style={styles.emptyTitle}>No offerings added yet</Text>
          <Text style={styles.emptyText}>
            Add at least one specific service with its pricing to publish your profile.
          </Text>
          <Pressable onPress={openAddModal} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>+ Add First Offering</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {offerings.map((off, index) => (
            <View key={off.id} style={styles.offeringCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.offeringName}>{off.name}</Text>
                  <Text style={styles.priceBadge}>{renderPriceLabel(off)}</Text>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => openEditModal(index)}
                    style={styles.iconButton}
                  >
                    <Ionicons name="create-outline" size={18} color={TEXT_PRIMARY} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteOffering(index)}
                    style={styles.iconButton}
                  >
                    <Ionicons name="trash-outline" size={18} color={DANGER} />
                  </Pressable>
                </View>
              </View>

              {off.description ? (
                <Text style={styles.offeringDesc}>{off.description}</Text>
              ) : null}

              {off.includedWork ? (
                <View style={styles.detailRow}>
                  <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                  <Text style={styles.detailText}>Includes: {off.includedWork}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Offering Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingIndex !== null ? "Edit Offering" : "Add Service Offering"}
            </Text>
            <Pressable onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={TEXT_PRIMARY} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Service / Task Name *</Text>
              <AppTextInput
                placeholder="e.g. Tap Installation, Pipe Leakage Fix"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description / Work Scope</Text>
              <AppTextInput
                placeholder="What exactly is covered in this service?"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ height: 75, textAlignVertical: "top" }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pricing Model *</Text>
              <View style={styles.pricingChips}>
                {PRICING_MODELS.map((pm) => {
                  const isSel = pricingModel === pm.id;
                  return (
                    <Pressable
                      key={pm.id}
                      onPress={() => {
                        setPricingModel(pm.id);
                        setPricingUnit(pm.unitDefault);
                      }}
                      style={[styles.pricingChip, isSel && styles.pricingChipActive]}
                    >
                      <Text
                        style={[
                          styles.pricingChipText,
                          isSel && styles.pricingChipTextActive,
                        ]}
                      >
                        {pm.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Price Inputs depending on model */}
            {pricingModel !== "quote" && pricingModel !== "price_range" && (
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Amount (₹) *</Text>
                  <AppTextInput
                    placeholder="300"
                    value={rupees}
                    onChangeText={setRupees}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Unit Label</Text>
                  <AppTextInput
                    placeholder="per task"
                    value={pricingUnit}
                    onChangeText={setPricingUnit}
                  />
                </View>
              </View>
            )}

            {pricingModel === "price_range" && (
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Min Price (₹) *</Text>
                  <AppTextInput
                    placeholder="500"
                    value={minRupees}
                    onChangeText={setMinRupees}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Max Price (₹) *</Text>
                  <AppTextInput
                    placeholder="1200"
                    value={maxRupees}
                    onChangeText={setMaxRupees}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Included Work / Materials</Text>
              <AppTextInput
                placeholder="e.g. Includes sealing tape, testing & cleanup"
                value={includedWork}
                onChangeText={setIncludedWork}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Additional Charges (If any)</Text>
              <AppTextInput
                placeholder="e.g. Spare parts billed at actual MRP"
                value={additionalCharges}
                onChangeText={setAdditionalCharges}
              />
            </View>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

            <Pressable
              accessibilityRole="button"
              onPress={handleSaveOffering}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>
                {editingIndex !== null ? "Save Changes" : "Add Service Offering"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 12.5,
    color: TEXT_SECONDARY,
    lineHeight: 17,
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addButtonText: {
    color: WHITE,
    fontSize: 12.5,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: "dashed",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  emptyText: {
    fontSize: 12.5,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  emptyButton: {
    marginTop: 6,
    backgroundColor: GREEN_SOFT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: GREEN,
    fontWeight: "700",
    fontSize: 13,
  },
  list: {
    gap: 10,
  },
  offeringCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  offeringName: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  priceBadge: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  offeringDesc: {
    fontSize: 12.5,
    color: TEXT_SECONDARY,
    lineHeight: 17,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  detailText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  modalContent: {
    padding: 20,
    backgroundColor: WHITE,
    flexGrow: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  modalBody: {
    paddingTop: 16,
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  pricingChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pricingChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG_MUTED,
  },
  pricingChipActive: {
    backgroundColor: GREEN_SOFT,
    borderColor: GREEN,
  },
  pricingChipText: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: "600",
  },
  pricingChipTextActive: {
    color: GREEN,
    fontWeight: "700",
  },
  errorText: {
    color: DANGER,
    fontSize: 12,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "800",
  },
});
