import { beforeEach, afterEach, vi } from "vitest";
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network calls are forbidden in database-free tests"); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
