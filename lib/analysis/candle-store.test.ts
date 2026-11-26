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
