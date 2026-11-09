import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../src/api/client";
import { useAuth } from "../src/auth";
import { Screen, Copy, Field, Button, Failure } from "../src/components/ui";
import { t } from "../src/i18n/en";
export default function Safety() {
  const params = useLocalSearchParams<{ targetId?: string | string[] }>();
  const targetId = Array.isArray(params.targetId) ? params.targetId[0] : params.targetId;
  const [reason, setReason] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const { session } = useAuth();
  const token = session?.token || null;
  const client = useQueryClient();
  const report = useMutation({
    mutationFn: () => api("/reports", { targetId, reason }),
  });
  const block = useMutation({
    mutationFn: () => api("/blocks", { targetId }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["nearby"] }),
  });
  return (
    <Screen title={targetId ? t("report") : "Safety & reporting"} back>
      {!token ? (
        <Button label={t("signIn")} onPress={() => router.push("/auth")} />
      ) : !targetId ? (
        <>
          <Copy>Report a person or block someone from the related job or request so the report is attached to the right account.</Copy>
          <Button label="Find work" secondary onPress={() => router.push("/find-work")} />
        </>
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
