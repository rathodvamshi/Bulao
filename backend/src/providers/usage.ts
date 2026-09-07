export async function recordUsage(
  db: D1Database,
  provider: string,
  service: string,
  success: boolean,
) {
  await db
    .prepare(
      "INSERT INTO provider_usage(provider,service,period,request_count,success_count,failure_count) VALUES(?,?,?,1,?,?) ON CONFLICT(provider,service,period) DO UPDATE SET request_count=request_count+1,success_count=success_count+excluded.success_count,failure_count=failure_count+excluded.failure_count",
    )
    .bind(
      provider,
      service,
      new Date().toISOString().slice(0, 10),
      success ? 1 : 0,
      success ? 0 : 1,
    )
    .run();
}
