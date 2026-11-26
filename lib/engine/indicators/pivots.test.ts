import { describe, it, expect } from "vitest";
import { highestHigh, isPivotHigh, isPivotLow, lowestLow, swingLevels } from "./pivots";
import type { Candle } from "@/lib/data/types";

const c = (low: number, high: number, close = (low + high) / 2): Candle => ({ time: 0, open: close, high, low, close, volume: 0 });
/** lows with a clear swing low (10) at index 5, and highs with a clear swing high (30) at index 11 */
const lows = [20, 19, 18, 16, 14, 10, 14, 16, 18, 19, 21, 24, 22, 20, 19];
const highs = lows.map((l, i) => (i === 11 ? 30 : l + 3));
const candles = lows.map((l, i) => c(l, highs[i]));

describe("pivot detection", () => {
  it("finds a swing low and swing high with strength 3", () => {
    expect(isPivotLow(lows, 5, 3)).toBe(true);
    expect(isPivotLow(lows, 4, 3)).toBe(false);
    expect(isPivotHigh(highs, 11, 3)).toBe(true);
  });
  it("cannot confirm pivots at the edges of the data", () => {
    expect(isPivotLow(lows, 1, 3)).toBe(false);
    expect(isPivotLow(lows, lows.length - 1, 3)).toBe(false);
  });
  it("a flat bottom counts once: the first low is the pivot, the second is not", () => {
    const flat = [9, 8, 5, 5, 8, 9, 9];
    expect(isPivotLow(flat, 2, 2)).toBe(true);
    expect(isPivotLow(flat, 3, 2)).toBe(false);
    expect([2, 3].filter((i) => isPivotLow(flat, i, 1)).length).toBe(1);
  });
});

describe("swingLevels never use a pivot before it is confirmed", () => {
  it("support appears only `strength` bars after the swing low", () => {
    const s = swingLevels(candles, 3);
    expect(s.support[5]).toBeNaN();
    expect(s.support[7]).toBeNaN(); // pivot at 5 is known from bar 8
    expect(s.support[8]).toBe(10);
  });
  it("resistance appears only `strength` bars after the swing high", () => {
    const s = swingLevels(candles, 3);
    expect(s.resistance[13]).toBeNaN();
    // resistance must be at or above the close; the swing high of 30 is known from bar 14
    expect(s.resistance[14]).toBe(30);
  });
  it("is identical when future bars are removed (no lookahead)", () => {
    const full = swingLevels(candles, 3);
    const cut = swingLevels(candles.slice(0, 10), 3);
    for (let t = 0; t < 10; t++) {
      for (const key of ["support", "resistance", "trendSupport", "trendResistance"] as const) {
        const a = full[key][t], b = cut[key][t];
        expect(Number.isNaN(a) ? "nan" : a).toBe(Number.isNaN(b) ? "nan" : b);
      }
    }
  });
  it("support is the nearest swing low at or below the close, not one above it", () => {
    // price collapses below the old swing low: that low is no longer support
    const crash = [...candles.slice(0, 9), c(5, 7), c(4, 6)];
    const s = swingLevels(crash, 3);
    expect(s.support[9]).toBeNaN();
  });
});

describe("trendlines", () => {
  // two rising swing lows: 10 at bar 4 and 14 at bar 12 -> slope 0.5 per bar
  const rising = [20, 17, 14, 12, 10, 12, 14, 16, 18, 16, 14, 13, 14, 16, 18, 20, 22, 24, 26, 28].map((l) => c(l, l + 2));
  it("extends the line through the last two swing lows", () => {
    const s = swingLevels(rising, 2);
    const t = 19;
    const first = rising.findIndex((_, i) => isPivotLow(rising.map((x) => x.low), i, 2));
    expect(first).toBe(4);
    expect(Number.isFinite(s.trendSupport[t])).toBe(true);
    // 10 at bar 4, 13 at bar 11 -> slope 3/7 per bar
    expect(s.trendSupport[t]).toBeCloseTo(13 + (3 / 7) * (t - 11), 5);
  });
  it("is NaN until two pivots exist", () => {
    expect(swingLevels(rising, 2).trendSupport[8]).toBeNaN();
  });
});

describe("swing extremes", () => {
  it("lowest low and highest high over a window", () => {
    expect(lowestLow(candles, 3)[7]).toBe(10); // bars 5,6,7 have lows 10, 14, 16
    expect(lowestLow(candles, 3)[1]).toBeNaN(); // not enough bars yet
    expect(highestHigh(candles, 3)[12]).toBe(30); // bars 10,11,12 include the 30
  });
});
