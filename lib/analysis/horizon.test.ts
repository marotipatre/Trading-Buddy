import { describe, it, expect } from "vitest";
import { barsFor, horizonStats } from "./horizon";
import type { Candle } from "@/lib/data/types";

const mk = (f: (i: number) => number, n = 400, wick = 0.002): Candle[] => Array.from({ length: n }, (_, i) => { const c = f(i); return { time: i * 86400, open: c, high: c * (1 + wick), low: c * (1 - wick), close: c, volume: 1 }; });

describe("horizonStats", () => {
  it("converts calendar days to trading days", () => {
    expect([7, 15, 30].map(barsFor)).toEqual([5, 11, 21]);
  });
  it("a steady riser hits a modest target almost every time", () => {
    const s = horizonStats(mk((i) => 100 * Math.pow(1.004, i)), 15, 4, 5)!; // ~4.5% in 11 bars
    expect(s.hitRate).toBeGreaterThan(0.9);
    expect(s.stopRate).toBe(0);
    expect(s.expectancyPct).toBeGreaterThan(3);
  });
  it("a steady decliner stops out", () => {
    const s = horizonStats(mk((i) => 300 * Math.pow(0.996, i)), 15, 4, 3)!;
    expect(s.hitRate).toBe(0);
    expect(s.stopRate).toBeGreaterThan(0.5);
    expect(s.expectancyPct).toBeLessThan(0);
  });
  it("a flat stock mostly times out, and rates add up to one", () => {
    const s = horizonStats(mk(() => 100), 15, 10, 5)!;
    expect(s.timeoutRate).toBe(1);
    expect(s.hitRate + s.stopRate + s.timeoutRate).toBeCloseTo(1);
    expect(s.medianPct).toBeCloseTo(0);
  });
  it("assumes the stop comes first when one bar touches both levels", () => {
    const c = mk(() => 100, 300, 0.2); // every bar spans -20% to +20%
    const s = horizonStats(c, 7, 5, 5)!;
    expect(s.hitRate).toBe(0);
    expect(s.stopRate).toBe(1);
  });
  it("needs enough history and sensible inputs", () => {
    expect(horizonStats(mk(() => 100, 80), 15, 5, 5)).toBeNull();
    expect(horizonStats(mk(() => 100), 15, 0, 5)).toBeNull();
  });
});
