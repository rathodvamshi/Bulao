// Historical integration suites are excluded from vitest.config.ts.
// Do not replace Cloudflare D1 with local SQLite or an in-memory database.
export function createDb(): never {
  throw new Error("Local D1 test persistence is retired. Use an approved remote staging integration suite.");
}
