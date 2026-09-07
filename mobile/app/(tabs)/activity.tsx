import { useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import type { Connection } from "../../src/api/types";
import { useSession } from "../../src/store/session";
import {
  Screen,
  Copy,
  Card,
  Button,
  Loading,
  Failure,
  s,
  colors,
} from "../../src/components/ui";
import { t } from "../../src/i18n/en";
const statusKeys = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  CANCELLED: "cancelled",
} as const;
type Action = "accept" | "reject" | "withdraw" | "start" | "confirm" | "cancel";
function ConnectionCard({ row, userId }: { row: Connection; userId: string }) {
  const client = useQueryClient();
  const [confirmation, setConfirmation] = useState<Action | null>(null);
  const mine = row.ownerId === userId;
  const confirmed = mine ? row.ownerConfirmedAt : row.workerConfirmedAt;
  const actions: Action[] =
    row.status === "PENDING"
      ? mine
        ? ["accept", "reject"]
        : ["withdraw"]
      : row.status === "ACCEPTED"
        ? mine
          ? ["start", "cancel"]
          : ["cancel"]
        : row.status === "IN_PROGRESS"
          ? confirmed
            ? []
            : ["confirm"]
          : [];
  const update = useMutation({
    mutationFn: (action: Action) =>
      api(
        `/${row.kind === "job" ? "applications" : "service-requests"}/${row.id}/action`,
        { action },
      ),
    onSuccess: () => {
      setConfirmation(null);
      void client.invalidateQueries({ queryKey: ["activity"] });
    },
  });
  return (
    <Card>
      <Text style={s.label}>{row.title}</Text>
      <Copy small>{row.otherName || t("new")}</Copy>
      <Button
        label={t("view")}
        secondary
        onPress={() =>
          router.push({
            pathname: "/requests/[id]",
            params: { id: row.id, kind: row.kind },
          })
        }
      />
      <View
        style={{
          backgroundColor: "#EDF2E0",
          alignSelf: "flex-start",
          padding: 10,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: colors.green, fontWeight: "600" }}>
          {t(statusKeys[row.status as keyof typeof statusKeys] ?? "pending")}
        </Text>
      </View>
      {row.status === "IN_PROGRESS" && !!confirmed && (
        <Copy>{t("awaiting")}</Copy>
      )}
      {confirmation ? (
        <>
          <Copy>{t("confirmTitle")}</Copy>
          <Button
            label={t(confirmation)}
            disabled={update.isPending}
            onPress={() => update.mutate(confirmation)}
          />
          <Button
            label={t("back")}
            secondary
            disabled={update.isPending}
            onPress={() => setConfirmation(null)}
          />
        </>
      ) : (
        actions.map((action) => (
          <Button
            key={action}
            label={t(action)}
            secondary={
              action === "reject" ||
              action === "cancel" ||
              action === "withdraw"
            }
            onPress={() => setConfirmation(action)}
          />
        ))
      )}
      {update.error && <Failure error={update.error} />}{" "}
      {row.status === "COMPLETED" && !row.reviewed && (
        <Button
          label={t("review")}
          onPress={() =>
            router.push({ pathname: "/review", params: { id: row.id } })
          }
        />
      )}
      <Button
        label={t("report")}
        secondary
        onPress={() =>
          router.push({
            pathname: "/safety",
            params: { targetId: mine ? row.workerId : row.ownerId },
          })
        }
      />
    </Card>
  );
}
export default function Activity() {
  const token = useSession((x) => x.token);
  const me = useQuery({
    queryKey: ["me", token],
    enabled: !!token,
    queryFn: () => api<{ id: string }>("/users/me"),
  });
  const activity = useQuery({
    queryKey: ["activity", token],
    enabled: !!token,
    queryFn: () =>
      api<{
        interactions: Connection[];
        jobs: { id: string; title: string; status: string }[];
      }>("/activity"),
    refetchInterval: 60000,
  });
  return (
    <Screen title={t("activity")}>
      {!token ? (
        <>
          <Copy>{t("signedOut")}</Copy>
          <Button label={t("signIn")} onPress={() => router.push("/auth")} />
        </>
      ) : activity.isPending || me.isPending ? (
        <Loading />
      ) : activity.isError || me.isError ? (
        <Failure
          error={activity.error ?? me.error}
          retry={() => {
            void activity.refetch();
            void me.refetch();
          }}
        />
      ) : (
        <>
          {!activity.data.interactions.length && !activity.data.jobs.length ? (
            <Card>
              <Text style={s.label}>{t("noActivity")}</Text>
              <Copy>{t("noActivityHint")}</Copy>
              <Button
                label={t("findWork")}
                onPress={() => router.push("/explore?kind=job")}
              />
            </Card>
          ) : (
            <>
              <Copy>{t("yourConnections")}</Copy>
              {activity.data.interactions.map((row) => (
                <ConnectionCard key={row.id} row={row} userId={me.data.id} />
              ))}
              {!!activity.data.jobs.length && <Copy>{t("yourJobs")}</Copy>}
              {activity.data.jobs.map((job) => (
                <Card key={job.id}>
                  <Text style={s.label}>{job.title}</Text>
                  <Button
                    label={t("view")}
                    secondary
                    onPress={() => router.push(`/jobs/${job.id}`)}
                  />
                </Card>
              ))}
            </>
          )}
          <Button
            label={t("retry")}
            secondary
            onPress={() => void activity.refetch()}
          />
        </>
      )}
    </Screen>
  );
}
