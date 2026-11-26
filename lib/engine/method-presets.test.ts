import { describe, it, expect } from "vitest";
import { PRESETS } from "./presets";
import { runBacktest } from "./simulator";
import { DEFAULT_COSTS } from "./costs";
import type { Candle } from "@/lib/data/types";

/** Rising market with swings, long enough for 252-bar lookbacks. */
const market: Candle[] = Array.from({ length: 1200 }, (_, i) => {
  const c = 100 * Math.pow(1.0009, i) + Math.sin(i / 11) * 6 + Math.sin(i / 2.7) * 2;
  return { time: 1_500_000_000 + i * 86400, open: c - 0.3, high: c + 1.5, low: c - 1.5, close: c, volume: 1e5 };
});

describe("Ideas methods as backtest presets", () => {
  for (const id of ["minervini-template", "pullback-uptrend", "momentum-filter"]) {
    it(`${id} runs and trades on a trending market`, () => {
      const p = PRESETS.find((x) => x.id === id);
      expect(p).toBeTruthy();
      const r = runBacktest("T", market, p!.strategy, DEFAULT_COSTS);
      expect(r.trades.length).toBeGreaterThan(0);
      for (const t of r.trades) { expect(t.qty).toBeGreaterThan(0); expect(t.exitIdx).toBeGreaterThanOrEqual(t.entryIdx); }
    });
  }
  it("does not trade the Minervini template in a market that only falls", () => {
    const down = market.map((c, i) => { const v = 400 * Math.pow(0.9992, i); return { ...c, open: v, high: v + 1, low: v - 1, close: v }; });
    expect(runBacktest("D", down, PRESETS.find((x) => x.id === "minervini-template")!.strategy, DEFAULT_COSTS).trades).toHaveLength(0);
  });
});
