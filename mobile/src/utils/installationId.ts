import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const INSTALLATION_KEY = "bulao.push.installation.v1";
let memoryInstallationId: string | null = null;

function createUuidV4(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Returns the persistent per-installation UUID stored in SecureStore (or memory on web).
 * Used consistently across OTP rate limiting and Android push registration.
 */
export async function getInstallationId(): Promise<string> {
  if (Platform.OS === "web") {
    if (!memoryInstallationId) {
      memoryInstallationId = createUuidV4();
    }
    return memoryInstallationId;
  }

  try {
    const saved = await SecureStore.getItemAsync(INSTALLATION_KEY);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) {
      memoryInstallationId = saved;
      return saved;
    }
    const created = createUuidV4();
    await SecureStore.setItemAsync(INSTALLATION_KEY, created, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    memoryInstallationId = created;
    return created;
  } catch {
    if (!memoryInstallationId) {
      memoryInstallationId = createUuidV4();
    }
    return memoryInstallationId;
  }
}

export async function getExistingInstallationId(): Promise<string | null> {
  if (Platform.OS === "web") {
    return memoryInstallationId;
  }
  try {
    const saved = await SecureStore.getItemAsync(INSTALLATION_KEY);
    return saved && /^[0-9a-f-]{36}$/i.test(saved) ? saved : null;
  } catch {
    return memoryInstallationId;
  }
}

export function newRequestIdempotencyKey(): string {
  return createUuidV4();
}
