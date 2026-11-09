import { defineConfig } from "vitest/config";
// No database emulator. Legacy API tests use the retired local-D1 harness and are
// deliberately excluded; integration coverage must run against approved remote staging.
export default defineConfig({ test: {
  include: ["tests/domain.test.ts", "tests/providers.test.ts", "tests/storage.test.ts", "tests/auth-policy.test.ts", "tests/auth-*.unit.test.ts", "tests/notifications.unit.test.ts", "tests/push-notifications.unit.test.ts", "tests/stories.unit.test.ts", "tests/image-registry.unit.test.ts", "tests/dynamic-categories.unit.test.ts", "tests/job-history-retention.unit.test.ts", "tests/job-completion-disputes.unit.test.ts", "tests/nearby-job-matcher.unit.test.ts"],
  setupFiles: ["tests/no-network.ts"], pool: "forks", maxWorkers: 1,
} });

