import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router } from "expo-router";
import { Screen, Copy, Button, Loading, Failure } from "../src/components/ui";
import { api } from "../src/api/client";
import type { Catalog } from "../src/api/types";
import { useLocation } from "../src/store/location";
import { t } from "../src/i18n/en";
export default function LocationScreen() {
  const catalog = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Catalog>("/categories"),
    staleTime: 86400000,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setLocation = useLocation((x) => x.setLocation);
  async function gps() {
    setBusy(true);
    setError(null);
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      if (!result.granted) throw new Error(t("gpsDenied"));
      const point = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: point.coords.latitude,
        longitude: point.coords.longitude,
        area: "Near me",
      });
      router.back();
    } catch {
      setError(t("gpsDenied"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title={t("location")} back>
      <Copy>{t("locationWhy")}</Copy>
      <Button label={t("gps")} disabled={busy} onPress={() => void gps()} />
      {error && <Failure error={new Error(error)} />}
      <Copy>{t("manual")}</Copy>
      {catalog.isPending ? (
        <Loading />
      ) : catalog.isError ? (
        <Failure error={catalog.error} retry={() => void catalog.refetch()} />
      ) : (
        catalog.data.locations.map((area) => (
          <Button
            key={area.id}
            label={area.area}
            secondary
            onPress={() => {
              setLocation(area);
              router.back();
            }}
          />
        ))
      )}
    </Screen>
  );
}
