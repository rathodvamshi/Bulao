import { invalidateServiceQueries } from "../../../api/serviceApi";
import { useState } from "react";
import {
  View,
  Pressable,
  Modal,
  StyleSheet,
  Share,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../api/client";
import { useAuth } from "../../../auth";
import type { ServiceItem } from "../types";
import {
  ServiceText as Text,
  serviceTheme as theme,
  serviceModeLabel,
} from "./serviceProfileTheme";
export type ServiceMenuAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export function ServiceActionsPopover({
  service,
  anchor,
  onClose,
}: {
  service: ServiceItem;
  anchor: ServiceMenuAnchor;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const { session } = useAuth();
  const [error, setError] = useState("");
  const menuWidth = Math.min(210, width - 32);
  const menuHeight = error ? 240 : 205;
  const above = anchor.y + anchor.height + menuHeight + 12 > height - insets.bottom;
  const top = Math.max(
    insets.top + 8,
    above ? anchor.y - menuHeight - 4 : anchor.y + anchor.height + 6
  );
  const left = Math.max(
    12,
    Math.min(anchor.x + anchor.width - menuWidth + 4, width - menuWidth - 14)
  );
  const pause = useMutation({
    mutationFn: () =>
      api(
        `/services/${service.id}`,
        { available: !service.available },
        "PATCH",
      ),
    onSuccess: async () => {
      client.setQueryData<ServiceItem[]>(
        ["my-services", session?.token],
        (items) =>
          items?.map((item) =>
            item.id === service.id
              ? { ...item, available: !service.available }
              : item,
          ),
      );
      await Promise.all([
        invalidateServiceQueries(client),
        client.invalidateQueries({ queryKey: ["nearby"] }),
        client.invalidateQueries({ queryKey: ["myServices"] }),
      ]);
      onClose();
    },
    onError: () => setError("Couldn't save. Please try again."),
  });
  const navigate = (edit: boolean) => {
    onClose();
    router.push(
      edit
        ? { pathname: "/create-service", params: { editId: service.id } }
        : { pathname: "/service-details", params: { id: service.id } },
    );
  };
  const share = async () => {
    try {
      await Share.share({
        title: service.title,
        message: `${service.title}\n${service.area}\n${serviceModeLabel(service)}\nFind my service on Bulao.`,
      });
      onClose();
    } catch {
      setError("Couldn't open sharing. Try again.");
    }
  };
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={s.backdrop}
        onPress={onClose}
        accessibilityLabel="Dismiss service menu"
      />
      <View
        accessibilityViewIsModal
        style={[s.menu, { top, left, width: menuWidth }]}
      >
        <View style={s.header}>
          <Text numberOfLines={1} style={s.title}>
            {service.title || service.categoryName}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={onClose}
            style={s.close}
          >
            <Ionicons name="close" size={18} color="white" />
          </Pressable>
        </View>
        {(
          [
            ["View service", "eye-outline", () => navigate(false)],
            ["Edit service", "pencil-outline", () => navigate(true)],
            [
              service.available ? "Pause service" : "Resume service",
              service.available ? "pause-outline" : "play-outline",
              () => pause.mutate(),
            ],
            ["Share service", "share-social-outline", () => void share()],
          ] as const
        ).map(([label, icon, action]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            disabled={pause.isPending}
            onPress={action}
            style={s.row}
          >
            <Ionicons name={icon} size={17} color="white" />
            <Text style={s.rowText}>{label}</Text>
            {pause.isPending &&
              label.includes(service.available ? "Pause" : "Resume") && (
                <ActivityIndicator size="small" color="white" />
              )}
          </Pressable>
        ))}
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,30,25,0.14)",
  },
  menu: {
    position: "absolute",
    backgroundColor: "#034E3B",
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: "#09634C",
    elevation: 14,
    shadowColor: "#001C13",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#09634C",
    paddingBottom: 6,
    marginBottom: 4,
    paddingLeft: 8,
  },
  title: { flex: 1, fontSize: 11.5, fontWeight: "700", color: "#A7F3D0" },
  close: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  rowText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: "#FFFFFF" },
  error: { fontSize: 11, lineHeight: 16, color: "#FFE4C6", padding: 6 },
});
