import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import type { Catalog } from "../../src/api/types";
import { useLocation } from "../../src/store/location";
import { useSession } from "../../src/store/session";
import {
  Screen,
  Copy,
  Chip,
  Button,
  Field,
  Failure,
  Loading,
  s,
} from "../../src/components/ui";
import { t } from "../../src/i18n/en";
export default function Offer() {
  const [step, setStep] = useState(0);
  const [categoryId, setCategory] = useState("");
  const [radiusKm, setRadius] = useState(5);
  const [experience, setExperience] = useState("0");
  const location = useLocation((x) => x.location);
  const token = useSession((x) => x.token);
  const client = useQueryClient();
  const catalog = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Catalog>("/categories"),
  });
  const publish = useMutation({
    mutationFn: () =>
      api("/services", {
        ...location,
        categoryId,
        radiusKm,
        experience: Number(experience),
        available: true,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["nearby"] }),
  });
  if (!token)
    return (
      <Screen title={t("offer")} back>
        <Button label={t("signIn")} onPress={() => router.push("/auth")} />
      </Screen>
    );
  return (
    <Screen title={t(publish.isSuccess ? "servicePublished" : "offer")} back>
      {publish.isSuccess ? (
        <>
          <Copy>{t("servicePublishedHint")}</Copy>
          <Button label={t("goHome")} onPress={() => router.replace("/")} />
        </>
      ) : (
        <>
          <Copy>{step + 1} / 3</Copy>
          {step === 0 ? (
            <>
              <Copy>{t("serviceCategory")}</Copy>
              {catalog.isPending ? (
                <Loading />
              ) : catalog.isError ? (
                <Failure
                  error={catalog.error}
                  retry={() => void catalog.refetch()}
                />
              ) : (
                <View style={s.row}>
                  {catalog.data.categories
                    .filter((c) => c.kind === "service")
                    .map((c) => (
                      <Chip
                        key={c.id}
                        label={c.name}
                        selected={categoryId === c.id}
                        onPress={() => setCategory(c.id)}
                      />
                    ))}
                </View>
              )}
            </>
          ) : step === 1 ? (
            <>
              <Button
                label={location?.area ?? t("location")}
                onPress={() => router.push("/location")}
              />
              <Copy>{t("travel")}</Copy>
              <View style={s.row}>
                {[3, 5, 10, 25].map((km) => (
                  <Chip
                    key={km}
                    label={`${km} km`}
                    selected={km === radiusKm}
                    onPress={() => setRadius(km)}
                  />
                ))}
              </View>
              <Field
                label={t("experience")}
                value={experience}
                onChangeText={setExperience}
                keyboardType="number-pad"
              />
            </>
          ) : (
            <>
              <Copy>
                {
                  catalog.data?.categories.find((c) => c.id === categoryId)
                    ?.name
                }
              </Copy>
              <Copy>
                {location?.area} · {radiusKm} km
              </Copy>
              <Copy>{t("available")}</Copy>
            </>
          )}
          {publish.error && <Failure error={publish.error} />}
          <Button
            label={t(step === 2 ? "offer" : "continue")}
            disabled={
              publish.isPending ||
              !categoryId ||
              (step > 0 &&
                (!location ||
                  !Number.isInteger(Number(experience)) ||
                  Number(experience) < 0 ||
                  Number(experience) > 70))
            }
            onPress={() => (step === 2 ? publish.mutate() : setStep(step + 1))}
          />
          {step > 0 && (
            <Button
              label={t("back")}
              secondary
              onPress={() => setStep(step - 1)}
            />
          )}
        </>
      )}
    </Screen>
  );
}
