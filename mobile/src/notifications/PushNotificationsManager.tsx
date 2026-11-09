import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import type { NotificationResponse } from "expo-notifications";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth";
import { api } from "../api/client";
import type { AppNotification } from "../api/types";
import { autoPromptAndroidPushOnLaunch, isExpoGo, syncGrantedAndroidPush } from "./registration";

type PushDestination = {
  notificationId: string;
  role: "seeker" | "provider";
  context: "work" | "hire" | "service";
  type?: string;
  jobId?: string;
  interactionId?: string;
  serviceId?: string;
};

function destinationFromResponse(response: NotificationResponse): PushDestination | null {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  if (
    typeof data?.notificationId !== "string" ||
    (data.role !== "seeker" && data.role !== "provider") ||
    (data.context !== "work" && data.context !== "hire" && data.context !== "service")
  ) {
    return null;
  }
  return {
    notificationId: data.notificationId,
    role: data.role,
    context: data.context,
    type: typeof data.type === "string" ? data.type : undefined,
    jobId: typeof data.jobId === "string" ? data.jobId : undefined,
    interactionId: typeof data.interactionId === "string" ? data.interactionId : undefined,
    serviceId: typeof data.serviceId === "string" ? data.serviceId : undefined,
  };
}

function navigateToTarget(
  role: "seeker" | "provider",
  type?: string,
  jobId?: string,
  interactionId?: string,
  serviceId?: string,
): boolean {
  if (!type && !jobId && !interactionId && !serviceId) return false;

  // 1. Nearby job alert -> open the job details page directly
  if (type === "NEW_JOB_NEARBY" && jobId) {
    router.push({
      pathname: "/jobs/[id]",
      params: { id: jobId },
    });
    return true;
  }

  // 2. Applicant created -> provider views applicants for this specific job posting
  if (type === "APPLICATION_CREATED" && role === "provider" && jobId) {
    router.push({
      pathname: "/activity",
      params: { filter: "interested", jobId },
    });
    return true;
  }

  if (type === "APPLICATION_ACCEPTED" && role === "seeker" && interactionId) {
    router.push({
      pathname: "/find-work",
      params: { tab: "applications", applicationId: interactionId },
    });
    return true;
  }

  // Rejected and cancelled applications open their interaction request.
  if (
    (type === "APPLICATION_REJECTED" ||
      (type && type.includes("CANCELLED"))) &&
    interactionId
  ) {
    router.push({
      pathname: "/requests/[id]",
      params: { id: interactionId, kind: "job" },
    });
    return true;
  }

  if (type === "REVIEW_RECEIVED" && interactionId) {
    router.push({
      pathname: "/rating-received",
      params: { interactionId, role },
    });
    return true;
  }

  // 4. Job completion confirmation or completed
  if (type === "JOB_COMPLETION_CONFIRMATION" || type === "JOB_COMPLETED") {
    if (type === "JOB_COMPLETED" && role === "provider" && interactionId) {
      router.push({
        pathname: "/activity",
        params: { filter: "completed", completionInteractionId: interactionId },
      });
      return true;
    }
    if (role === "provider" && jobId) {
      router.push({
        pathname: "/activity",
        params: { filter: "hired", jobId },
      });
      return true;
    }
    if (role === "seeker" && interactionId) {
      router.push({
        pathname: "/find-work",
        params: { tab: "applications", completionInteractionId: interactionId },
      });
      return true;
    }
    if (interactionId) {
      router.push({
        pathname: "/requests/[id]",
        params: { id: interactionId, kind: "job" },
      });
      return true;
    }
  }

  // 5. Worksite location updated
  if (type === "JOB_LOCATION_UPDATED") {
    if (interactionId) {
      router.push({
        pathname: "/requests/[id]",
        params: { id: interactionId, kind: "job" },
      });
      return true;
    }
    if (jobId) {
      router.push({
        pathname: "/jobs/[id]",
        params: { id: jobId },
      });
      return true;
    }
  }

  // 6. Service requests & updates
  if (type && type.startsWith("SERVICE_")) {
    if (interactionId) {
      router.push({
        pathname: "/requests/[id]",
        params: { id: interactionId, kind: "service" },
      });
      return true;
    }
    if (serviceId) {
      router.push({
        pathname: "/service-details",
        params: { id: serviceId },
      });
      return true;
    }
  }

  // Fallback routing by available identifiers if type is unhandled or missing
  if (role === "provider" && jobId) {
    router.push({
      pathname: "/activity",
      params: { filter: "interested", jobId },
    });
    return true;
  }
  if (interactionId) {
    router.push({
      pathname: "/requests/[id]",
      params: { id: interactionId, kind: "job" },
    });
    return true;
  }
  if (jobId) {
    router.push({
      pathname: "/jobs/[id]",
      params: { id: jobId },
    });
    return true;
  }
  if (serviceId) {
    router.push({
      pathname: "/service-details",
      params: { id: serviceId },
    });
    return true;
  }

  return false;
}

export function PushNotificationsManager() {
  const auth = useAuth();
  const authRef = useRef(auth);
  const queryClient = useQueryClient();
  const pendingDestination = useRef<PushDestination | null>(null);
  const lastHandled = useRef("");
  const lastHandledAt = useRef(0);

  const routePending = useCallback(async () => {
    const item = pendingDestination.current;
    if (!item) return;
    pendingDestination.current = null;

    if (authRef.current.status !== "authenticated") {
      router.push("/auth");
      return;
    }

    const scope = item.context === "service" ? "service" : "work";

    // 1. Mark as read immediately on the server
    void api(
      `/notifications/${encodeURIComponent(item.notificationId)}/read?role=${item.role}&scope=${scope}`,
      undefined,
      "POST",
    ).catch(() => {});

    // Invalidate caches so badges update immediately
    void queryClient.invalidateQueries({
      predicate: ({ queryKey }) =>
        [
          "notifications",
          "provider-notifications",
          "seeker-notifications",
          "service-notifications",
          "activity",
        ].includes(String(queryKey[0])),
    });

    // 1. If payload already contains routing metadata, navigate INSTANTLY without waiting for network
    if (navigateToTarget(item.role, item.type, item.jobId, item.interactionId, item.serviceId)) {
      return;
    }

    // 2. Fallback: fetch authenticated notification details for direct deep-link routing
    try {
      const notification = await api<AppNotification>(
        `/notifications/${encodeURIComponent(item.notificationId)}?role=${item.role}&scope=${scope}`,
      );

      let parsedData: Record<string, unknown> = {};
      if (notification?.data) {
        parsedData =
          typeof notification.data === "string"
            ? JSON.parse(notification.data)
            : (notification.data as Record<string, unknown>);
      }

      const jobId = typeof parsedData.jobId === "string" ? parsedData.jobId : undefined;
      const interactionId = typeof parsedData.interactionId === "string" ? parsedData.interactionId : undefined;
      const serviceId = typeof parsedData.serviceId === "string" ? parsedData.serviceId : undefined;

      if (navigateToTarget(item.role, notification.type, jobId, interactionId, serviceId)) {
        return;
      }
    } catch {
      // In case of network timeout or unexpected error, fall back to inbox
    }

    // Default fallback: open the notifications inbox
    router.push({
      pathname: "/notifications",
      params: {
        role: item.role,
        context: item.context,
        notificationId: item.notificationId,
      },
    });
  }, [queryClient]);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    if (Platform.OS !== "android" || isExpoGo() || auth.status !== "authenticated" || !auth.user) return;
    let active = true;
    let tokenSubscription: { remove: () => void } | undefined;
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncGrantedAndroidPush();
    });
    void import("expo-notifications").then((Notifications) => {
      if (!active) return;
      tokenSubscription = Notifications.addPushTokenListener(() => {
        void syncGrantedAndroidPush();
      });
      void syncGrantedAndroidPush();
    }).catch(() => {});
    return () => {
      active = false;
      tokenSubscription?.remove();
      appStateSubscription.remove();
    };
  }, [auth.status, auth.user?.id]);

  useEffect(() => {
    if (Platform.OS !== "android" || isExpoGo()) return;
    let active = true;
    let responseSubscription: { remove: () => void } | undefined;
    let receivedSubscription: { remove: () => void } | undefined;

    const open = (response: NotificationResponse | null) => {
      if (!response) return;
      const destination = destinationFromResponse(response);
      if (!destination) return;
      const key = `${destination.notificationId}:${destination.role}:${destination.context}`;
      if (lastHandled.current === key && Date.now() - lastHandledAt.current < 1500) return;
      lastHandled.current = key;
      lastHandledAt.current = Date.now();
      pendingDestination.current = destination;
      if (authRef.current.status === "authenticated") {
        void routePending();
      } else if (authRef.current.status === "unauthenticated") {
        router.push("/auth");
      }
    };

    void import("expo-notifications").then((Notifications) => {
      if (!active) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      // When notification is tapped
      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        open(response);
        void Notifications.clearLastNotificationResponseAsync().catch(() => {});
      });

      // When notification arrives in foreground: live update badges & lists
      receivedSubscription = Notifications.addNotificationReceivedListener(() => {
        void queryClient.invalidateQueries({
          predicate: ({ queryKey }) =>
            [
              "notifications",
              "provider-notifications",
              "seeker-notifications",
              "service-notifications",
              "activity",
            ].includes(String(queryKey[0])),
        });
      });

      void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    }).catch(() => {});

    return () => {
      active = false;
      responseSubscription?.remove();
      receivedSubscription?.remove();
    };
  }, [routePending, queryClient]);

  useEffect(() => {
    if (Platform.OS !== "android" || isExpoGo()) return;
    const timer = setTimeout(() => {
      void autoPromptAndroidPushOnLaunch();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated") void routePending();
  }, [auth.status, auth.user?.id, routePending]);

  return null;
}
