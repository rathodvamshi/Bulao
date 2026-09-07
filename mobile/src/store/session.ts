import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { apiBaseUrl } from "../api/config";

type Session = {
  token: string | null;
  ready: boolean;
  restoreError: string | null;
  setToken: (token: string | null) => Promise<void>;
  hydrate: () => Promise<void>;
};
let revision = 0;
export const useSession = create<Session>((set) => ({
  token: null, ready: false, restoreError: null,
  async setToken(token) {
    const current = ++revision;
    if (!token) set({ token: null, ready: true, restoreError: null });
    if (Platform.OS !== "web") {
      if (token) await SecureStore.setItemAsync("bulao.session", token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      else await SecureStore.deleteItemAsync("bulao.session");
    }
    if (current === revision) set({ token, ready: true, restoreError: null });
  },
  async hydrate() {
    const current = ++revision;
    set({ ready: false, restoreError: null });
    try {
      const token = Platform.OS === "web" ? null : await SecureStore.getItemAsync("bulao.session");
      if (current !== revision) return;
      if (!token) { set({ token: null, ready: true }); return; }
      const response = await fetch(`${apiBaseUrl()}/auth/session`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error",
      });
      if (current !== revision) return;
      if (response.status === 401) {
        await SecureStore.deleteItemAsync("bulao.session");
        if (current === revision) set({ token: null, ready: true });
        return;
      }
      if (!response.ok || !(await response.json()).success) throw new Error("unavailable");
      if (current === revision) set({ token, ready: true });
    } catch {
      if (current === revision) set({ token: null, ready: true, restoreError: "Could not restore your session. Check your connection and try again." });
    }
  },
}));
