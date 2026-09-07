import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../src/api/client";
import { useSession } from "../src/store/session";
import { Screen, Copy, Field, Button, Failure } from "../src/components/ui";
import { t } from "../src/i18n/en";
export default function Safety() {
  const { targetId } = useLocalSearchParams<{ targetId: string }>();
  const [reason, setReason] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const token = useSession((x) => x.token);
  const client = useQueryClient();
  const report = useMutation({
    mutationFn: () => api("/reports", { targetId, reason }),
  });
  const block = useMutation({
    mutationFn: () => api("/blocks", { targetId }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["nearby"] }),
  });
  return (
    <Screen title={t("report")} back>
      {!token ? (
        <Button label={t("signIn")} onPress={() => router.push("/auth")} />
      ) : (
        <>
          {report.isSuccess ? (
            <Copy>{t("reportSent")}</Copy>
          ) : (
            <>
              <Field
                label={t("reportReason")}
                value={reason}
                onChangeText={setReason}
                multiline
              />
              <Button
                label={t("report")}
                disabled={report.isPending || reason.trim().length < 3}
                onPress={() => report.mutate()}
              />
            </>
          )}
          {block.isSuccess ? (
            <Copy>{t("blocked")}</Copy>
          ) : (
            <>
              {confirmBlock && <Copy>{t("confirmTitle")}</Copy>}
              <Button
                label={t("block")}
                secondary
                disabled={block.isPending}
                onPress={() =>
                  confirmBlock ? block.mutate() : setConfirmBlock(true)
                }
              />
            </>
          )}
          {(report.error || block.error) && (
            <Failure error={report.error ?? block.error} />
          )}
        </>
      )}
    </Screen>
  );
}
