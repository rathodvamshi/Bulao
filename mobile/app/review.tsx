import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../src/api/client";
import {
  Screen,
  Copy,
  Field,
  Chip,
  Button,
  Failure,
  s,
} from "../src/components/ui";
import { t } from "../src/i18n/en";
export default function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState("");
  const client = useQueryClient();
  const review = useMutation({
    mutationFn: () => api("/reviews", { interactionId: id, stars, body }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["activity"] }),
  });
  return (
    <Screen title={t("review")} back>
      {review.isSuccess ? (
        <>
          <Copy>{t("reviewSaved")}</Copy>
          <Button
            label={t("track")}
            onPress={() => router.replace("/activity")}
          />
        </>
      ) : (
        <>
          <Copy>{t("reviewPrompt")}</Copy>
          <View style={s.row}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip
                key={n}
                label={`${n} ★`}
                selected={stars === n}
                onPress={() => setStars(n)}
              />
            ))}
          </View>
          <Field
            label={t("reviewBody")}
            value={body}
            onChangeText={setBody}
            multiline
          />
          <Button
            label={t("save")}
            disabled={!stars || review.isPending}
            onPress={() => review.mutate()}
          />
          {review.error && <Failure error={review.error} />}
        </>
      )}
    </Screen>
  );
}
