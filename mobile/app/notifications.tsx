import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";
import { NotificationsScreen } from "../src/components/NotificationsScreen";
import { useRequireAuth } from "../src/auth/useRequireAuth";
import { StatusBar } from "expo-status-bar";

export default function NotificationsPage() {
  const { role, context, notificationId } = useLocalSearchParams<{
    role?: string;
    context?: string;
    notificationId?: string;
  }>();
  const { isAuthenticated, user } = useRequireAuth();
  if (!isAuthenticated) return null;
  if (role !== "seeker" && role !== "provider") return <Redirect href="/" />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack.Screen
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <NotificationsScreen
        initialNotificationId={notificationId}
        key={`${user?.id}:${role}:${context === "service" ? "service" : "work"}`}
        role={role}
        context={
          context === "service"
            ? "service"
            : role === "provider"
              ? "hire"
              : "work"
        }
        onBack={() => {
          if (router.canGoBack()) router.back();
          else
            router.replace(
              context === "service"
                ? "/service-home"
                : role === "provider"
                  ? "/provider-home"
                  : "/find-work",
            );
        }}
        onSelectJob={(jobId: string, type?: string) => {
          if (role === "provider" && type !== "NEW_JOB_NEARBY") {
            router.push({ pathname: "/activity", params: { filter: "interested", jobId } });
          } else {
            router.push({ pathname: "/jobs/[id]", params: { id: jobId } });
          }
        }}
        onSelectRequest={(id: string, kind?: string) =>
          router.push({
            pathname: "/requests/[id]",
            params: { id, kind: kind || (context === "service" ? "service" : "job") },
          })
        }
        onSelectService={(id: string) =>
          router.push({ pathname: "/service-details", params: { id } })
        }
        onSelectProviderRatingQueue={(jobId: string) =>
          router.push({ pathname: "/activity", params: { filter: "hired", jobId } })
        }
        onSelectReceivedRating={(interactionId: string) =>
          router.push({ pathname: "/rating-received", params: { interactionId, role } })
        }
        onSelectAcceptedApplication={(interactionId: string) =>
          router.push({ pathname: "/find-work", params: { tab: "applications", applicationId: interactionId } })
        }
        onSelectCompletionPrompt={(interactionId: string) =>
          router.push({ pathname: "/find-work", params: { tab: "applications", completionInteractionId: interactionId } })
        }
        onSelectProviderFeedback={(interactionId: string) =>
          router.push({ pathname: "/activity", params: { filter: "completed", completionInteractionId: interactionId } })
        }
        onSelectProfile={(workerId) =>
          router.push({
            pathname: "/profile/[id]",
            params: { id: workerId, role: "seeker" },
          })
        }
      />
    </>
  );
}
