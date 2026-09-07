import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import type { Job } from "../../src/api/types";
import {
  Screen,
  Heading,
  Copy,
  Card,
  Button,
  Loading,
  Failure,
} from "../../src/components/ui";
import { useSession } from "../../src/store/session";
import { t } from "../../src/i18n/en";
export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [confirm, setConfirm] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const token = useSession((x) => x.token);
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ["me", token],
    enabled: !!token,
    queryFn: () => api<{ id: string }>("/users/me"),
  });
  const change = useMutation({
    mutationFn: (action: "pause" | "publish" | "cancel") =>
      api(`/jobs/${id}/action`, { action }),
    onSuccess: () => {
      setCancelConfirm(false);
      void client.invalidateQueries({ queryKey: ["job", id] });
      void client.invalidateQueries({ queryKey: ["activity"] });
      void client.invalidateQueries({ queryKey: ["nearby"] });
    },
  });
  const job = useQuery({
    queryKey: ["job", id],
    queryFn: () => api<Job>(`/jobs/${id}`),
  });
  const apply = useMutation({
    mutationFn: () => api(`/jobs/${id}/apply`, {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ["activity"] }),
  });
  return (
    <Screen title={apply.isSuccess ? t("sent") : t("findWork")} back>
      {job.isPending ? (
        <Loading />
      ) : job.isError ? (
        <Failure error={job.error} retry={() => void job.refetch()} />
      ) : apply.isSuccess ? (
        <>
          <Copy>{t("sentHint")}</Copy>
          <Button
            label={t("track")}
            onPress={() => router.replace("/activity")}
          />
        </>
      ) : (
        <>
          <Heading>{job.data.title}</Heading>
          <Heading>
            ₹{job.data.payPaise / 100}/{job.data.payUnit}
          </Heading>
          <Card>
            <Copy>{job.data.area}</Copy>
            <Copy>{new Date(job.data.startsAt * 1000).toLocaleString()}</Copy>
            <Copy>{job.data.workers} people</Copy>
            {!!job.data.details && <Copy>{job.data.details}</Copy>}
          </Card>
          <Card>
            <Copy>{job.data.ownerName || t("new")}</Copy>
            <Copy small>{t("verified")}</Copy>
            <Button
              label={t("profile")}
              secondary
              onPress={() =>
                router.push({
                  pathname: "/profile/[id]",
                  params: { id: job.data.ownerId },
                })
              }
            />
          </Card>
          {me.data?.id === job.data.ownerId ? (
            <>
              <Button
                label={t("track")}
                onPress={() => router.push("/activity")}
              />
              {["PUBLISHED", "PAUSED"].includes(job.data.status) && (
                <Button
                  label={t(
                    job.data.status === "PAUSED" ? "resumeJob" : "pauseJob",
                  )}
                  secondary
                  disabled={change.isPending}
                  onPress={() =>
                    change.mutate(
                      job.data.status === "PAUSED" ? "publish" : "pause",
                    )
                  }
                />
              )}
              {["PUBLISHED", "PAUSED", "FILLED"].includes(job.data.status) && (
                <>
                  <Copy>{cancelConfirm ? t("confirmTitle") : ""}</Copy>
                  <Button
                    label={t("cancelJob")}
                    secondary
                    disabled={change.isPending}
                    onPress={() =>
                      cancelConfirm
                        ? change.mutate("cancel")
                        : setCancelConfirm(true)
                    }
                  />
                </>
              )}
              {change.error && <Failure error={change.error} />}
              <Copy>
                {t(
                  (
                    {
                      PUBLISHED: "published",
                      PAUSED: "paused",
                      FILLED: "filled",
                      CANCELLED: "cancelled",
                      COMPLETED: "completed",
                    } as const
                  )[job.data.status as "PUBLISHED"] ?? "saved",
                )}
              </Copy>
            </>
          ) : (
            <>
              {confirm && <Copy>{t("confirmTitle")}</Copy>}
              <Button
                label={t(confirm ? "confirmApply" : "apply")}
                disabled={apply.isPending || job.data.status !== "PUBLISHED"}
                onPress={() => {
                  if (!token) router.push("/auth");
                  else if (!confirm) setConfirm(true);
                  else apply.mutate();
                }}
              />
              {apply.error && <Failure error={apply.error} />}
            </>
          )}
          <Button
            label={t("report")}
            secondary
            onPress={() =>
              router.push({
                pathname: "/safety",
                params: { targetId: job.data.ownerId },
              })
            }
          />
        </>
      )}
    </Screen>
  );
}
