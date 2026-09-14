import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";
import { NotificationsScreen } from "../src/components/NotificationsScreen";
import { useRequireAuth } from "../src/auth/useRequireAuth";
import { StatusBar } from "expo-status-bar";

export default function NotificationsPage() {
  const { role } = useLocalSearchParams<{ role?: string }>();
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
        key={`${user?.id}:${role}`}
        role={role}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else
            router.replace(
              role === "provider" ? "/provider-home" : "/find-work",
            );
        }}
        onSelectJob={(jobId) => router.push(`/jobs/${jobId}`)}
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
