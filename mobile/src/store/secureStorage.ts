import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { StateStorage } from "zustand/middleware";

export const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (Platform.OS === "web") return null;
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (Platform.OS === "web") return;
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // safe fallback
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (Platform.OS === "web") return;
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // safe fallback
    }
  },
};
