import { useState } from "react";
import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import type { Catalog, Job, Professional } from "../../src/api/types";
import {
  Screen,
  Copy,
  Card,
  Button,
  Chip,
  Loading,
  Failure,
  s,
} from "../../src/components/ui";
import { t } from "../../src/i18n/en";
import { useLocation } from "../../src/store/location";
export default function Explore() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = params.kind === "service" ? "service" : "job";
  const location = useLocation((x) => x.location);
  const [radius, setRadius] = useState(5);
  const [category, setCategory] = useState("");
  const catalog = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Catalog>("/categories"),
    staleTime: 86400000,
  });
  const list = useInfiniteQuery({
    queryKey: ["nearby", kind, location, radius, category],
    enabled: !!location,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<{ items: (Job & Professional)[]; nextCursor: number | null }>(
        `/${kind === "job" ? "jobs" : "services"}?latitude=${location!.latitude}&longitude=${location!.longitude}&radiusKm=${radius}&cursor=${pageParam}${category ? `&categoryId=${encodeURIComponent(category)}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Screen title={t(kind === "job" ? "findWork" : "findService")}>
      <Button
        label={`⌖ ${location?.area ?? t("location")}`}
        secondary
        onPress={() => router.push("/location")}
      />
      <View style={s.row}>
        <Chip
          label={t("findWork")}
          selected={kind === "job"}
          onPress={() => {
            setCategory("");
            router.setParams({ kind: "job" });
          }}
        />
        <Chip
          label={t("findService")}
          selected={kind === "service"}
          onPress={() => {
            setCategory("");
            router.setParams({ kind: "service" });
          }}
        />
      </View>
      <View style={s.row}>
        {[3, 5, 10, 25].map((km) => (
          <Chip
            key={km}
            label={`${km} km`}
            selected={radius === km}
            onPress={() => setRadius(km)}
          />
        ))}
      </View>
      <View style={s.row}>
        <Chip
          label={t("all")}
          selected={!category}
          onPress={() => setCategory("")}
        />
        {catalog.data?.categories
          .filter((c) => c.kind === kind)
          .map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={category === c.id}
              onPress={() => setCategory(c.id)}
            />
          ))}
      </View>
      {catalog.isError && (
        <Failure error={catalog.error} retry={() => void catalog.refetch()} />
      )}
      {!location ? (
        <Copy>{t("locationWhy")}</Copy>
      ) : list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Failure error={list.error} retry={() => void list.refetch()} />
      ) : (
        <>
          {!rows.length && (
            <Card>
              <Text style={s.label}>{t("empty")}</Text>
              <Copy>{t("emptyHint")}</Copy>
              <Button
                label={t("location")}
                onPress={() => router.push("/location")}
              />
            </Card>
          )}
          {rows.map((item) => (
            <Card key={item.id}>
              <Text style={{ ...s.label, fontSize: 23 }}>
                {item.title || t("new")}
              </Text>
              <Copy>
                {kind === "service"
                  ? item.category
                  : `₹${item.payPaise / 100}/${item.payUnit}`}
              </Copy>
              <Copy small>
                {item.area} · {item.distanceKm} km
              </Copy>
              {kind === "job" ? (
                <Copy small>
                  {new Date(item.startsAt * 1000).toLocaleDateString()} ·{" "}
                  {item.workers} people
                </Copy>
              ) : (
                <Copy small>
                  {item.rating ? `★ ${item.rating}` : t("new")} ·{" "}
                  {item.completed} completed
                </Copy>
              )}
              <Button
                label={t(kind === "job" ? "view" : "request")}
                secondary
                onPress={() =>
                  router.push(
                    kind === "job"
                      ? `/jobs/${item.id}`
                      : {
                          pathname: "/profile/[id]",
                          params: {
                            id: item.userId,
                            serviceId: item.id,
                            name: item.title,
                            category: item.category,
                          },
                        },
                  )
                }
              />
            </Card>
          ))}
          {list.hasNextPage && (
            <Button
              label={t("continue")}
              disabled={list.isFetchingNextPage}
              onPress={() => void list.fetchNextPage()}
            />
          )}
        </>
      )}
    </Screen>
  );
}
