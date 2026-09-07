import "../global.css";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "../src/store/session";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
    mutations: { retry: false },
  },
});
export default function Layout() {
  useEffect(() => {
    const unsubscribe = useSession.subscribe((state, previous) => {
      if (state.token !== previous.token) {
        void client.cancelQueries();
        client.clear();
      }
    });
    void useSession.getState().hydrate();
    return unsubscribe;
  }, []);
  return (
    <QueryClientProvider client={client}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
