import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";
const root = resolve("..");
const read = (file: string) => readFileSync(join(root, file), "utf8");
function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sources(`${dir}/${entry.name}`) : /\.(tsx?|js)$/.test(entry.name) ? [read(`${dir}/${entry.name}`)] : []);
}
describe("configuration and security contracts without database execution", () => {
  it("isolates staging and production databases and queues", () => {
    const config = read("backend/wrangler.toml");
    const staging = config.split("[env.staging]")[1]!.split("[env.production]")[0]!;
    const production = config.split("[env.production]")[1]!;
    expect(staging).toContain('database_name = "bulao-dev"'); expect(staging).not.toContain('database_name = "bulao-production"');
    expect(production).toContain('database_id = "4d2491e2-a3f9-4ff3-9978-828d1b24f1d1"'); expect(production).not.toContain("87983e8a-6759-4d17-a482-769b8bd31463");
    expect(staging).toContain('queue = "bulao-auth-events-staging"'); expect(production).toContain('queue = "bulao-auth-events-production"');
    expect(config).not.toMatch(/^\s*(MSG91_AUTH_KEY|AUTH_HASH_KEY)\s*=/m);
  });
  it("keeps provider secrets and local databases out of mobile source", () => {
    const text = [...sources("mobile/app"), ...sources("mobile/src")].join("\n");
    expect(text).not.toMatch(/MSG91_AUTH_KEY|AUTH_HASH_KEY|control\.msg91\.com|api\.msg91\.com|AsyncStorage|localStorage|indexedDB|expo-sqlite/);
    expect(read("mobile/src/store/session.ts")).toContain("SecureStore.setItemAsync");
    expect(read("mobile/src/store/session.ts")).toContain('Platform.OS !== "web"');
    expect(read("mobile/.env.example")).toContain("bulao-api-staging.codecheck369.workers.dev");
  });
  it("declares session restrictions, atomic creation, audit idempotency and indexes", () => {
    const repo = read("backend/src/modules/auth/repository.ts");
    for (const predicate of ["s.revoked_at IS NULL", "s.expires_at>?", "u.suspended=0", "u.phone_verified=1"]) expect(repo).toContain(predicate);
    expect(repo).toContain("ON CONFLICT(phone)"); expect(repo).toContain("db.batch(["); expect(repo).not.toContain("SELECT *"); expect(repo).toContain("ON CONFLICT(id) DO NOTHING");
    const migration = read("backend/migrations/0006_production_auth.sql");
    for (const index of ["sessions_user_id", "sessions_expires_at", "auth_events_user_id", "auth_events_created_at"]) expect(migration).toContain(`CREATE INDEX ${index}`);
  });
  it("excludes database suites and guards network calls", () => {
    const config = read("backend/vitest.config.ts"); expect(config).not.toContain('include: ["tests/**/*.test.ts"]'); expect(config).toContain("no-network.ts");
    expect(read("backend/tests/sqlite-d1.ts")).not.toContain("node:sqlite"); expect(read("backend/package.json")).not.toContain("--local");
    expect(read(".gitignore")).toContain(".dev.vars"); expect(read(".gitignore")).toContain(".env");
  });
});
