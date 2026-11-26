import { describe, it, expect } from "vitest";
import { analyze, equityFromTrades } from "./analyze";
import { getPreset } from "./presets";
import { mulberry32 } from "./stats";
import { DEFAULT_COSTS } from "./costs";
import type { Candle } from "@/lib/data/types";
import type { Trade } from "./types";

function synthetic(n: number, seed = 5): Candle[] {
  const rand = mulberry32(seed);
  let p = 100;
  return Array.from({ length: n }, (_, i) => {
    const o = p;
    p = Math.max(5, p * (1 + (rand() - 0.49) * 0.03 + Math.sin(i / 20) * 0.004));
    return { time: 1_500_000_000 + i * 86400, open: o, high: Math.max(o, p) * 1.005, low: Math.min(o, p) * 0.995, close: p, volume: 1e5 };
  });
}

describe("analyze", () => {
  const candles = synthetic(1500);
  const a = analyze("SYN", candles, getPreset("ema-cross")!.strategy, DEFAULT_COSTS, { mcSims: 300 });

  it("produces consistent pieces", () => {
    expect(a.result.trades.length).toBeGreaterThan(5);
    expect(a.metrics.trades).toBe(a.result.trades.length);
    expect(a.monteCarlo?.tradesPerPath).toBe(a.result.trades.length);
    expect(a.stopStudy.entries).toBeGreaterThan(0);
    expect(a.buyHoldReturnPct).toBeCloseTo((candles.at(-1)!.close / candles[0].close - 1) * 100);
  });

  it("splits trades by entry time with no overlap between samples", () => {
    expect(a.outOfSample).not.toBeNull();
    const o = a.outOfSample!;
    expect(o.inSample.trades + o.outSample.trades).toBe(a.metrics.trades);
  });

  it("flags too little data", () => {
    const small = analyze("SYN", synthetic(120), getPreset("ema-cross")!.strategy, DEFAULT_COSTS, { mcSims: 50 });
    expect(small.warnings.join(" ")).toContain("bars of history");
  });

  it("equityFromTrades steps at exits", () => {
    const t = (exitTime: number, netPnl: number) => ({ entryTime: 0, exitTime, netPnl }) as Trade;
    const r = equityFromTrades([t(20, -50), t(10, 100)], 1000);
    expect(r.equity.map((p) => p.equity)).toEqual([1000, 1100, 1050]);
    expect(r.finalEquity).toBe(1050);
  });
});
