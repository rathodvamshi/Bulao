import { useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import type { Catalog } from "../../src/api/types";
import {
  Screen,
  Copy,
  Card,
  Chip,
  Field,
  Button,
  Loading,
  Failure,
  s,
} from "../../src/components/ui";
import { t } from "../../src/i18n/en";
import { useLocation } from "../../src/store/location";
import { useSession } from "../../src/store/session";
export default function PostJob() {
  const [step, setStep] = useState(0);
  const [submissionKey] = useState(
    () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [category, setCategory] = useState("");
  const [role, setRole] = useState("");
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(9);
  const [workers, setWorkers] = useState(1);
  const [pay, setPay] = useState("700");
  const [unit, setUnit] = useState<"day" | "hour" | "job">("day");
  const [details, setDetails] = useState("");
  const location = useLocation((x) => x.location);
  const token = useSession((x) => x.token);
  const client = useQueryClient();
  const catalog = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Catalog>("/categories"),
    staleTime: 86400000,
  });
  const selected = catalog.data?.roles.find((r) => r.id === role);
  const date = new Date();
  date.setDate(date.getDate() + day);
  date.setHours(hour, 0, 0, 0);
  const post = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/jobs", {
        ...location,
        submissionKey,
        categoryId: selected?.categoryId,
        roleId: role,
        startsAt: Math.floor(date.getTime() / 1000),
        workers,
        payPaise: Math.round(Number(pay) * 100),
        payUnit: unit,
        details,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["nearby"] });
      void client.invalidateQueries({ queryKey: ["activity"] });
    },
  });
  const titles = [
    "role",
    "where",
    "when",
    "payment",
    "details",
    "check",
  ] as const;
  if (!token)
    return (
      <Screen title={t("hire")} back>
        <Copy>{t("signedOut")}</Copy>
        <Button label={t("signIn")} onPress={() => router.push("/auth")} />
      </Screen>
    );
  if (post.isSuccess)
    return (
      <Screen title={t("posted")}>
        <Copy>{t("postedHint")}</Copy>
        <Button
          label={t("view")}
          onPress={() => router.replace(`/jobs/${post.data.id}`)}
        />
        <Button
          label={t("goHome")}
          secondary
          onPress={() => router.replace("/")}
        />
      </Screen>
    );
  return (
    <Screen title={t(titles[step]!)} back>
      <Copy small>
        {step + 1} / {titles.length}
      </Copy>
      {step === 0 &&
        (catalog.isPending ? (
          <Loading />
        ) : catalog.isError ? (
          <Failure error={catalog.error} retry={() => void catalog.refetch()} />
        ) : (
          <View style={s.row}>
            {!category ? (
              catalog.data.categories
                .filter((c) => c.kind === "job")
                .map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    selected={false}
                    onPress={() => setCategory(c.id)}
                  />
                ))
            ) : (
              <Button
                secondary
                label={t("back")}
                onPress={() => {
                  setCategory("");
                  setRole("");
                }}
              />
            )}
            {catalog.data.roles
              .filter((r) => r.categoryId === category)
              .map((r) => (
                <Chip
                  key={r.id}
                  label={r.name}
                  selected={role === r.id}
                  onPress={() => setRole(r.id)}
                />
              ))}
          </View>
        ))}
      {step === 1 && (
        <>
          <Copy>{location?.area ?? t("locationWhy")}</Copy>
          <Button
            label={t("location")}
            onPress={() => router.push("/location")}
          />
        </>
      )}
      {step === 2 && (
        <>
          <View style={s.row}>
            {([0, 1, 7] as const).map((d, i) => (
              <Chip
                key={d}
                label={t((["today", "tomorrow", "nextWeek"] as const)[i]!)}
                selected={day === d}
                onPress={() => setDay(d)}
              />
            ))}
          </View>
          <View style={s.row}>
            {([9, 14, 18] as const).map((h, i) => (
              <Chip
                key={h}
                label={t((["morning", "afternoon", "evening"] as const)[i]!)}
                selected={hour === h}
                onPress={() => setHour(h)}
              />
            ))}
          </View>
          <Copy>{date.toLocaleString()}</Copy>
        </>
      )}
      {step === 3 && (
        <>
          <Text style={s.label}>{t("workers")}</Text>
          <View style={s.row}>
            <Button
              label="−"
              secondary
              disabled={workers === 1}
              onPress={() => setWorkers(workers - 1)}
            />
            <Text style={{ ...s.heading, padding: 10 }}>{workers}</Text>
            <Button
              label="+"
              secondary
              disabled={workers === 100}
              onPress={() => setWorkers(workers + 1)}
            />
          </View>
          <Field
            label={t("pay")}
            value={pay}
            onChangeText={setPay}
            keyboardType="number-pad"
            placeholder={t("payPlaceholder")}
          />
          <View style={s.row}>
            {(["day", "hour", "job"] as const).map((u, i) => (
              <Chip
                key={u}
                label={t((["perDay", "perHour", "perJob"] as const)[i]!)}
                selected={unit === u}
                onPress={() => setUnit(u)}
              />
            ))}
          </View>
        </>
      )}
      {step === 4 && (
        <Field
          label={t("optional")}
          value={details}
          onChangeText={setDetails}
          multiline
          placeholder={t("detailsPlaceholder")}
        />
      )}{" "}
      {step === 5 && (
        <Card>
          <Text style={s.heading}>{selected?.name}</Text>
          <Copy>{location?.area}</Copy>
          <Copy>{date.toLocaleString()}</Copy>
          <Copy>
            {workers} people · ₹{pay}/{unit}
          </Copy>
          {!!details && <Copy>{details}</Copy>}
        </Card>
      )}
      {post.error && <Failure error={post.error} />}
      <Button
        label={post.isPending ? t("busy") : t(step === 5 ? "post" : "continue")}
        disabled={
          post.isPending ||
          (step === 0 && !role) ||
          (step === 1 && !location) ||
          (step === 2 && date.getTime() <= Date.now()) ||
          (step === 3 && (!Number.isFinite(Number(pay)) || Number(pay) < 1))
        }
        onPress={() => (step === 5 ? post.mutate() : setStep(step + 1))}
      />
      {step > 0 && (
        <Button label={t("back")} secondary onPress={() => setStep(step - 1)} />
      )}
    </Screen>
  );
}
