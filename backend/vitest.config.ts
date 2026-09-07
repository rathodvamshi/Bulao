import { defineConfig } from "vitest/config";
// No database emulator. Legacy API tests use the retired local-D1 harness and are
// deliberately excluded; integration coverage must run against approved remote staging.
export default defineConfig({ test: {
  include: ["tests/domain.test.ts", "tests/providers.test.ts", "tests/storage.test.ts", "tests/auth-policy.test.ts", "tests/auth-*.unit.test.ts"],
  setupFiles: ["tests/no-network.ts"], pool: "forks", maxWorkers: 1,
} });

