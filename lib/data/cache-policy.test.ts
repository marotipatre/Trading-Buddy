import { describe, it, expect } from "vitest";
import { cacheAction, refreshTtlSec, type PolicyInput } from "./cache-policy";

const DAY = 86400;
const now = 1_800_000_000;
const base: PolicyInput = {
  interval: "1d", count: 500, cachedFirst: now - 400 * DAY, cachedLast: now - DAY, fromSec: now - 365 * DAY, toSec: now,
  nowSec: now, marketOpen: false, lastRefreshAt: now - 60,
};

describe("cacheAction", () => {
  it("fetches when nothing is cached", () => {
    expect(cacheAction({ ...base, count: 0 })).toBe("fetch");
  });
  it("fetches when the cache does not reach back far enough", () => {
    expect(cacheAction({ ...base, cachedFirst: now - 100 * DAY })).toBe("fetch");
  });
  it("tolerates a few days of weekend/holiday gap at the start", () => {
    expect(cacheAction({ ...base, cachedFirst: now - 361 * DAY })).toBe("serve");
  });
  it("does not demand more history than the provider can supply (intraday ~59d)", () => {
    const i: PolicyInput = { ...base, interval: "15m", fromSec: now - 400 * DAY, cachedFirst: now - 58 * DAY };
    expect(cacheAction(i)).toBe("serve");
  });
  it("serves instantly and refreshes in the background on the first request after a restart", () => {
    expect(cacheAction({ ...base, lastRefreshAt: undefined })).toBe("serve+refresh");
  });
  it("serves without refreshing while recently refreshed", () => {
    expect(cacheAction({ ...base, lastRefreshAt: now - 30 })).toBe("serve");
  });
  it("refreshes sooner while the market is open", () => {
    const open = { ...base, marketOpen: true, lastRefreshAt: now - 200 };
    expect(cacheAction(open)).toBe("serve+refresh");
    expect(cacheAction({ ...open, marketOpen: false })).toBe("serve");
  });
  it("uses longer TTLs when closed and shorter for intraday while open", () => {
    expect(refreshTtlSec("1d", false)).toBe(1800);
    expect(refreshTtlSec("5m", true)).toBe(60);
    expect(refreshTtlSec("1d", true)).toBe(120);
  });
});
