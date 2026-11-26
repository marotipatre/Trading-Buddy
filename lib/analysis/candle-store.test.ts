import { describe, it, expect } from "vitest";
import { fresh, pack, unpack } from "./candle-store";
import type { Candle } from "@/lib/data/types";

describe("candle store packing", () => {
  const c: Candle[] = [{ time: 1, open: 10, high: 12, low: 9, close: 11, volume: 1000 }, { time: 2, open: 11, high: 13.5, low: 10.25, close: 12, volume: 2500 }];
  it("round-trips candles exactly", () => { expect(unpack(pack(c))).toEqual(c); });
  it("handles an empty series and ignores a trailing partial record", () => {
    expect(unpack(pack([]))).toEqual([]);
    expect(unpack(new Float64Array([1, 2, 3]))).toEqual([]);
  });
  it("keeps data fresh for 20 minutes while the market is open and 6 hours otherwise", () => {
    expect(fresh(0, 19 * 60_000, true)).toBe(true);
    expect(fresh(0, 21 * 60_000, true)).toBe(false);
    expect(fresh(0, 5 * 3600_000, false)).toBe(true);
    expect(fresh(0, 7 * 3600_000, false)).toBe(false);
  });
});

describe("usableFromDb", () => {
  it("accepts a full, recent history and rejects short or stale ones", async () => {
    const { usableFromDb } = await import("./candle-cache");
    const now = 1_800_000_000, day = 86400;
    const mk = (n: number, endAgo: number) => Array.from({ length: n }, (_, i) => ({ time: now - endAgo * day - (n - 1 - i) * day, open: 1, high: 1, low: 1, close: 1, volume: 1 }));
    expect(usableFromDb(mk(900, 1), 800, now)).toBe(true);
    expect(usableFromDb(mk(300, 1), 800, now)).toBe(false);
    expect(usableFromDb(mk(900, 9), 800, now)).toBe(false);
    expect(usableFromDb(mk(10, 1), 5, now)).toBe(false);
  });
});

describe("usableFromDb with a known latest session", () => {
  it("rejects history that misses the newest official close", async () => {
    const { usableFromDb } = await import("./candle-cache");
    const now = Date.UTC(2026, 10, 27, 6) / 1000, day = 86400;
    const bars = (lastDate: string, n = 900) => { const end = Date.parse(lastDate + "T03:45:00Z") / 1000; return Array.from({ length: n }, (_, i) => ({ time: end - (n - 1 - i) * day, open: 1, high: 1, low: 1, close: 1, volume: 1 })); };
    expect(usableFromDb(bars("2026-11-26"), 800, now, "2026-11-26")).toBe(true);
    expect(usableFromDb(bars("2026-11-25"), 800, now, "2026-11-26")).toBe(false);
  });
});
