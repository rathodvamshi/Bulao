import { useCallback } from "react";
import { View, Text, Image, Pressable, Linking, Alert } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import { serviceApi } from "../../src/api/serviceApi";
import { useAuth } from "../../src/auth";
import { Screen, Loading, Failure } from "../../src/components/ui";

type PublicProfileData = {
  id: string; name: string; area: string; photoUrl: string | null; phone: string | null;
  phoneVerified: number; rating: number | null; totalReviews: number; completed: number;
  reviews: { id: string; stars: number; body: string; author: string; jobTitle?: string }[];
};
export default function PublicProfile() {
  const { id, serviceId } = useLocalSearchParams<{ id: string; serviceId?: string }>();
  const { session } = useAuth();
  const profile = useQuery({
    queryKey: ["profile", id, session?.token], enabled: !!id,
    queryFn: () => api<PublicProfileData>(`/profiles/${encodeURIComponent(id)}`), staleTime: 0,
  });
  const services = useQuery({ queryKey: ["profile-services", id, session?.token], enabled: !!id, queryFn: () => serviceApi.providerListings(id) });
  useFocusEffect(useCallback(() => { if (id) void profile.refetch(); }, [id, profile.refetch]));
  const data = profile.data;
  return <Screen title="Profile" back>
    {profile.isPending ? <Loading /> : profile.isError ? <Failure error={profile.error} retry={() => void profile.refetch()} /> : data ? <View style={{ gap: 18, paddingBottom: 24 }}>
      {data.photoUrl && <Image source={{ uri: data.photoUrl }} style={{ width: 80, height: 80, borderRadius: 40 }} />}
      <Text style={{ fontSize: 24, fontWeight: "700" }}>{data.name || "Name not provided"}</Text>
      {!!data.area && <Text>{data.area}</Text>}
      {data.phoneVerified === 1 && <Text>Phone verified</Text>}
      <Text>{data.rating === null ? "No reviews yet" : `${data.rating.toFixed(1)} ★ · ${data.totalReviews} reviews`}</Text>
      <Text>{data.completed} completed engagements</Text>
      {data.phone && <Pressable onPress={() => void Linking.openURL(`tel:${data.phone}`).catch(() => Alert.alert("Call unavailable"))}><Text style={{ color: "#034E3B" }}>Call</Text></Pressable>}
      {serviceId && <Pressable onPress={() => router.push({ pathname: "/service-details", params: { id: serviceId } })}><Text style={{ color: "#034E3B", fontWeight: "700" }}>View service & request</Text></Pressable>}
      {services.isPending ? <Loading /> : services.isError ? <Failure error={services.error} retry={() => void services.refetch()} /> : services.data?.map(service => <Pressable key={service.id} style={{ padding: 16, backgroundColor: "#F0F7F2", borderRadius: 12 }} onPress={() => router.push({ pathname: "/service-details", params: { id: service.id } })}><Text style={{ fontWeight: "700" }}>{service.title || "Title not provided"}</Text><Text>{service.categoryName} · {service.area}</Text></Pressable>)}
      {data.reviews.map(review => <View key={review.id} style={{ padding: 16, borderRadius: 12, backgroundColor: "#F0F7F2", gap: 6 }}>
        <Text>{review.stars} ★{review.author ? ` · ${review.author}` : ""}</Text>
        {!!review.body && <Text>{review.body}</Text>}
        {!!review.jobTitle && <Text>{review.jobTitle}</Text>}
      </View>)}
      <Pressable onPress={() => router.push({ pathname: "/safety", params: { targetId: id } })}><Text style={{ color: "#B91C1C" }}>Report profile or abuse</Text></Pressable>
    </View> : null}
  </Screen>;
}
