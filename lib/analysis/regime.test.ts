import { describe, it, expect } from "vitest";
import { marketRegime } from "./regime";
import { latestPatterns, patternsAt } from "./patterns";
import type { Candle } from "@/lib/data/types";

const mk = (f: (i: number) => number, n = 300): Candle[] => Array.from({ length: n }, (_, i) => { const c = f(i); return { time: i * 86400, open: c, high: c * 1.005, low: c * 0.995, close: c, volume: 1 }; });
const c = (o: number, h: number, l: number, cl: number): Candle => ({ time: 0, open: o, high: h, low: l, close: cl, volume: 1 });

describe("marketRegime", () => {
  it("calls a steady climb bull, a slide bear, and a flat market sideways", () => {
    expect(marketRegime(mk((i) => 100 + i * 0.5))!.regime).toBe("bull");
    expect(marketRegime(mk((i) => 300 - i * 0.5))!.regime).toBe("bear");
    expect(marketRegime(mk(() => 100))!.regime).toBe("sideways");
  });
  it("cuts suggested size in worse regimes and needs history", () => {
    expect(marketRegime(mk((i) => 100 + i * 0.5))!.sizeFactor).toBeGreaterThan(marketRegime(mk((i) => 300 - i * 0.5))!.sizeFactor);
    expect(marketRegime(mk((i) => i, 100))).toBeNull();
  });
});

describe("candlestick patterns", () => {
  const fall = Array.from({ length: 6 }, (_, i) => c(110 - i * 2, 111 - i * 2, 108 - i * 2, 109 - i * 2));
  const rise = Array.from({ length: 6 }, (_, i) => c(100 + i * 2, 102 + i * 2, 99 + i * 2, 101 + i * 2));
  it("finds a hammer after a fall and a shooting star after a rise", () => {
    expect(latestPatterns([...fall, c(99.5, 100.2, 94, 100)]).map((p) => p.name)).toContain("hammer");
    expect(latestPatterns([...rise, c(111.5, 118, 111.2, 112.2)]).map((p) => p.name)).toContain("shooting star");
  });
  it("finds engulfing patterns", () => {
    expect(latestPatterns([...fall, c(100, 100.2, 97.8, 98), c(97.5, 102, 97.2, 101.5)]).map((p) => p.name)).toContain("bullish engulfing");
    expect(latestPatterns([...rise, c(112, 114.2, 111.8, 114), c(114.5, 114.8, 109.5, 110)]).map((p) => p.name)).toContain("bearish engulfing");
  });
  it("finds a doji and a morning star, and nothing in a plain bar", () => {
    expect(latestPatterns([...rise, c(112, 114, 110, 112.05)]).map((p) => p.name)).toContain("doji");
    expect(latestPatterns([...fall, c(100, 100.5, 94, 95), c(94.5, 95, 93.5, 94.6), c(95, 100.6, 94.8, 100.2)]).map((p) => p.name)).toContain("morning star");
    expect(patternsAt([...rise, c(112, 113, 111, 112.8)], 6).map((p) => p.name)).not.toContain("hammer");
    expect(patternsAt(rise, 2)).toEqual([]);
  });
});
