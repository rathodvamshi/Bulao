import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import { useSession } from "../../src/store/session";
import { useLocation } from "../../src/store/location";
import { Screen, Copy, Field, Button, Failure } from "../../src/components/ui";
import { t } from "../../src/i18n/en";
export default function Request() {
  const { id, name, category } = useLocalSearchParams<{
    id: string;
    name: string;
    category: string;
  }>();
  const [details, setDetails] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [days, setDays] = useState(0);
  const token = useSession((x) => x.token);
  const location = useLocation((x) => x.location);
  const client = useQueryClient();
  const request = useMutation({
    mutationFn: () =>
      api("/service-requests", {
        serviceId: id,
        details,
        ...location,
        scheduledAt: Math.floor(Date.now() / 1000) + days * 86400,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["activity"] }),
  });
  return (
    <Screen title={t(request.isSuccess ? "requestSent" : "request")} back>
      {request.isSuccess ? (
        <>
          <Copy>{t("requestHint")}</Copy>
          <Button
            label={t("track")}
            onPress={() => router.replace("/activity")}
          />
        </>
      ) : (
        <>
          <Copy>
            {name} · {category}
          </Copy>
          {confirm ? (
            <>
              <Copy>{details}</Copy>
              <Copy>
                {location?.area} · {t(days ? "tomorrow" : "today")}
              </Copy>
            </>
          ) : (
            <>
              <Button
                label={location?.area ?? t("location")}
                secondary
                onPress={() => router.push("/location")}
              />
              <Field
                label={t("requestDetails")}
                placeholder={t("requestExample")}
                value={details}
                onChangeText={setDetails}
                multiline
              />
              <Button
                secondary
                label={t(days ? "tomorrow" : "today")}
                onPress={() => setDays(days ? 0 : 1)}
              />
            </>
          )}
          {confirm && <Copy>{t("requestConfirm")}</Copy>}
          <Button
            label={t(confirm ? "request" : "continue")}
            disabled={
              !location || details.trim().length < 2 || request.isPending
            }
            onPress={() => {
              if (!token) router.push("/auth");
              else if (!confirm) setConfirm(true);
              else request.mutate();
            }}
          />
          {confirm && (
            <Button
              label={t("back")}
              secondary
              onPress={() => setConfirm(false)}
            />
          )}{" "}
          {request.error && <Failure error={request.error} />}
        </>
      )}
    </Screen>
  );
}
