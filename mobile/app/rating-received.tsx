import { Redirect, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ReceivedRatingScreen } from "../src/components/ReceivedRatingScreen";
import { useRequireAuth } from "../src/auth/useRequireAuth";

export default function RatingReceivedPage() {
  const { interactionId, role } = useLocalSearchParams<{
    interactionId?: string;
    role?: string;
  }>();
  const { isAuthenticated } = useRequireAuth();
  if (!isAuthenticated) return null;
  if (role !== "seeker" && role !== "provider") return <Redirect href="/" />;

  return (
    <>
      <StatusBar style="dark" />
      <ReceivedRatingScreen
        interactionId={interactionId || ""}
        role={role}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace(role === "provider" ? "/provider-home" : "/find-work");
        }}
      />
    </>
  );
}
