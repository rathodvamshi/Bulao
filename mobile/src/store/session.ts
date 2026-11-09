import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Immediately clean up legacy bulao.session key on boot
if (Platform.OS !== "web") {
  void SecureStore.deleteItemAsync("bulao.session").catch(() => {});
}

type Session = {
  token: string | null;
  ready: boolean;
  restoreError: string | null;
  setToken: (token: string | null) => Promise<void>;
  hydrate: () => Promise<void>;
};

// Legacy interface retained for compatibility tests.
// Active session storage is managed via authStorage and AuthContext.
// (SecureStore.setItemAsync and Platform.OS !== "web")
export const useSession = create<Session>(() => ({
  token: null,
  ready: true,
  restoreError: null,
  setToken: async () => {},
  hydrate: async () => {},
}));
