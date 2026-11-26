import { describe, it, expect } from "vitest";
import { computeFeatures, matchesScreen, SCREENS } from "./features";
import type { Candle } from "@/lib/data/types";

const mk = (f: (i: number) => { c: number; v?: number }, n = 300): Candle[] => Array.from({ length: n }, (_, i) => { const { c, v = 1000 } = f(i); return { time: i * 86400, open: c, high: c * 1.005, low: c * 0.995, close: c, volume: v }; });

describe("screen features", () => {
  it("returns null without a year of history", () => { expect(computeFeatures(mk(() => ({ c: 100 }), 100))).toBeNull(); });
  it("flags a fresh breakout on a volume surge near the high", () => {
    const f = computeFeatures(mk((i) => (i < 299 ? { c: 100 + Math.sin(i / 5) } : { c: 120, v: 5000 })))!;
    expect(f.breakout20).toBe(true);
    expect(f.volRatio).toBeGreaterThan(4);
    expect(f.offHighPct).toBeLessThan(3);
    expect(matchesScreen(f, "volume")).toBe(true);
    expect(matchesScreen(f, "high")).toBe(true);
  });
  it("is quiet in a flat market", () => {
    const f = computeFeatures(mk(() => ({ c: 100 })))!;
    expect(f.breakout20).toBe(false);
    expect(matchesScreen(f, "volume")).toBe(false);
  });
  it("finds a dip in an uptrend", () => {
    const f = computeFeatures(mk((i) => ({ c: 100 * Math.pow(1.002, i) * (i > 288 ? 1 - (i - 288) * 0.006 : 1) })))!;
    expect(f.pullback).toBe(true);
  });
  it("lists a hint for every screen", () => { expect(SCREENS.every((s) => s.hint.length > 10)).toBe(true); });
});
