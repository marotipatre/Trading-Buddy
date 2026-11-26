import { describe, it, expect } from "vitest";
import { averagesOf, buildEmaStrategy, DEFAULT_EMA_SPEC, describeEmaSpec } from "./ema-builder";
import { runBacktest } from "./simulator";
import { DEFAULT_COSTS } from "./costs";
import type { Candle } from "@/lib/data/types";

const market: Candle[] = Array.from({ length: 600 }, (_, i) => {
  const c = 100 + Math.sin(i / 25) * 12 + Math.sin(i / 2.3) * 3 + i * 0.1;
  return { time: 1_600_000_000 + i * 86400, open: c - 0.2, high: c + 1, low: c - 1, close: c, volume: 1e5 };
});

describe("EMA strategy builder", () => {
  it("builds a valid strategy for every entry, stop and target choice", () => {
    for (const entry of ["cross", "price_cross", "pullback"] as const)
      for (const stop of ["percent", "ema", "atr"] as const)
        for (const target of ["none", "percent", "rr", "next_ema"] as const) {
          const s = buildEmaStrategy({ ...DEFAULT_EMA_SPEC, entry, stop, target, stopPct: stop === "atr" ? 2 : 6 });
          expect(s.entry.conditions.length).toBeGreaterThan(0);
          expect(describeEmaSpec({ ...DEFAULT_EMA_SPEC, entry, stop, target })).toContain("Buy when");
        }
  });
  it("runs end to end with a next-EMA target and an EMA stop", () => {
    const s = buildEmaStrategy({ ...DEFAULT_EMA_SPEC, entry: "pullback", stop: "ema", target: "next_ema", exitOnReverse: false });
    const r = runBacktest("T", market, s, DEFAULT_COSTS);
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.trades.some((t) => t.exitReason === "target")).toBe(true);
  });
  it("lists the averages the chart should draw", () => {
    const a = averagesOf(buildEmaStrategy({ ...DEFAULT_EMA_SPEC, stop: "ema", target: "next_ema", targetEmas: [20, 100] }));
    expect(a.map((x) => x.period)).toEqual([20, 50, 100]);
  });
});
