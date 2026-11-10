import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "../api/client";
import { apiBaseUrl } from "../api/config";
import { fetchWithTimeout } from "../api/network";
import { getExistingInstallationId, getInstallationId } from "../utils/installationId";

export type PushEnableResult =
  | { status: "enabled" }
  | { status: "denied" }
  | { status: "expo_go" }
  | { status: "unsupported" }
  | { status: "not_configured" }
  | { status: "failed" };

function projectId() {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    "a50c7b67-2355-4fc9-bc4b-0e4eb8b948ac"
  );
}

export function isExpoGo() {
  return Platform.OS === "android" && Constants.appOwnership === "expo";
}

async function installationId() {
  return getInstallationId();
}

export async function registerCurrentAndroidInstallation(token: string) {
  const id = await getInstallationId();
  await api("/notifications/devices/register", {
    installationId: id,
    token,
    platform: "android",
  });
  return id;
}

async function configureAndroidChannel(Notifications: typeof import("expo-notifications")) {
  await Notifications.setNotificationChannelAsync("updates", {
    name: "Work updates",
    description: "General job, service, and completion updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("requests", {
    name: "New requests and applications",
    description: "New applications, service requests, and actions needing a response",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    lightColor: "#075B43",
  });
}

export async function enableAndroidPush(): Promise<PushEnableResult> {
  if (isExpoGo()) return { status: "expo_go" };
  if (Platform.OS !== "android" || !Device.isDevice) return { status: "unsupported" };
  const easProjectId = projectId();
  if (!easProjectId) return { status: "not_configured" };
  try {
    const Notifications = await import("expo-notifications");
    await configureAndroidChannel(Notifications);
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return { status: "denied" };
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
    await registerCurrentAndroidInstallation(token);
    return { status: "enabled" };
  } catch (error) {
    console.warn("Push registration could not be completed.", error instanceof Error ? error.name : "unknown");
    return { status: "failed" };
  }
}

export async function autoPromptAndroidPushOnLaunch(): Promise<PushEnableResult> {
  if (isExpoGo()) return { status: "expo_go" };
  if (Platform.OS !== "android" || !Device.isDevice) return { status: "unsupported" };
  const easProjectId = projectId();
  if (!easProjectId) return { status: "not_configured" };
  try {
    const Notifications = await import("expo-notifications");
    await configureAndroidChannel(Notifications);
    let permission = await Notifications.getPermissionsAsync();
    if (permission.granted) {
      const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
      await registerCurrentAndroidInstallation(token).catch(() => {});
      return { status: "enabled" };
    }
    if (permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (permission.granted) {
      const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
      await registerCurrentAndroidInstallation(token).catch(() => {});
      return { status: "enabled" };
    }
    return { status: "denied" };
  } catch (error) {
    console.warn("Auto push prompt on launch failed:", error instanceof Error ? error.name : "unknown");
    return { status: "failed" };
  }
}

export async function syncGrantedAndroidPush() {
  if (isExpoGo() || Platform.OS !== "android" || !Device.isDevice || !projectId()) return;
  try {
    const Notifications = await import("expo-notifications");
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    await configureAndroidChannel(Notifications);
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
    await registerCurrentAndroidInstallation(token);
  } catch (error) {
    // Registration is retried on the next foreground/token refresh. Never block app startup.
    console.warn("Push registration sync failed.", error instanceof Error ? error.name : "unknown");
  }
}

export async function unregisterAndroidPush(sessionToken: string | null) {
  if (!sessionToken) return;
  try {
    const id = await getExistingInstallationId();
    if (id) {
      await fetchWithTimeout(`${apiBaseUrl()}/notifications/devices/unregister`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ installationId: id }),
      }, 10000);
    }
  } catch {
    // Logout must complete even when offline. The server still sends privacy-safe copy.
  }
}
