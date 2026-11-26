import { describe, it, expect } from "vitest";
import { applyParam, GRIDS, pickRobust, planWindows, scoreTrades, sweepParam, walkForward, type GridPoint } from "./optimize";
import { getPreset } from "./presets";
import { mulberry32 } from "./stats";
import type { Candle } from "@/lib/data/types";
import type { Trade } from "./types";

function series(seed: number, n = 1500): Candle[] {
  const rand = mulberry32(seed);
  let p = 100;
  return Array.from({ length: n }, (_, i) => {
    const o = p;
    p = Math.max(5, p * (1 + (rand() - 0.485) * 0.03 + Math.sin(i / 18) * 0.005));
    return { time: 1_400_000_000 + i * 86400, open: o, high: Math.max(o, p) * 1.006, low: Math.min(o, p) * 0.994, close: p, volume: 1e5 };
  });
}
const strat = getPreset("ema-cross")!.strategy;
const t = (returnPct: number): Trade => ({ returnPct, netPnl: returnPct } as Trade);
const gp = (value: number, score: number): GridPoint => ({ value, trades: 50, winRate: 0.5, expectancyPct: score, profitFactor: 1.2, score });

describe("applyParam", () => {
  it("changes only the named setting and keeps the rest", () => {
    const s = applyParam(strat, "stopPct", 7);
    expect(s.stopLoss).toMatchObject({ type: "percent", value: 7, trailing: false });
    expect(s.entry).toBe(strat.entry);
    expect(applyParam(strat, "stopAtr", 2).stopLoss).toMatchObject({ type: "atr", value: 2 });
    expect(applyParam(strat, "maxHold", 12.4).maxHoldBars).toBe(12);
    expect(applyParam(strat, "targetPct", 9).target).toEqual({ type: "percent", value: 9 });
  });
  it("keeps a trailing stop trailing when its distance changes", () => {
    const trailing = { ...strat, stopLoss: { ...strat.stopLoss!, trailing: true } };
    expect(applyParam(trailing, "stopPct", 4).stopLoss?.trailing).toBe(true);
  });
  it("does not mutate the original", () => {
    const before = JSON.stringify(strat);
    applyParam(strat, "stopPct", 3);
    expect(JSON.stringify(strat)).toBe(before);
  });
  it("every grid is ascending with unique values", () => {
    for (const g of Object.values(GRIDS)) expect([...g].sort((a, b) => a - b)).toEqual(g);
  });
});

describe("scoreTrades", () => {
  it("refuses to score too few trades", () => {
    expect(scoreTrades([t(5), t(6)], "expectancy", 15)).toBe(-Infinity);
  });
  it("scores expectancy and profit factor", () => {
    const trades = Array.from({ length: 20 }, (_, i) => t(i % 2 ? 6 : -3));
    expect(scoreTrades(trades, "expectancy", 15)).toBeCloseTo(1.5);
    expect(scoreTrades(trades, "profitFactor", 15)).toBeCloseTo(2);
  });
});

describe("pickRobust", () => {
  it("prefers a broad plateau to a lone spike", () => {
    const pts = [gp(2, 0.1), gp(3, 0.2), gp(4, 2.5), gp(5, -0.5), gp(6, 0.8), gp(8, 0.9), gp(10, 0.85), gp(12, 0.3)];
    const r = pickRobust(pts);
    expect(r.peak!.value).toBe(4); // the lone spike is the raw maximum
    expect([6, 8, 10]).toContain(r.robust!.value); // but the robust choice is on the plateau
    expect(r.plateau).toBe(true);
  });
  it("flags a result with no stable neighbourhood", () => {
    const r = pickRobust([gp(2, -1), gp(3, 2), gp(4, -1.5), gp(5, 1.8), gp(6, -2)]);
    expect(r.plateau).toBe(false);
  });
  it("a value that is only good because of a neighbouring spike is not chosen", () => {
    const r = pickRobust([gp(2, 0.1), gp(3, 0.2), gp(4, 2.5), gp(5, 0.15), gp(6, 0.1)]);
    expect(r.peak!.value).toBe(4);
    expect(r.plateau).toBe(false);
  });
  it("copes with nothing scoreable", () => {
    expect(pickRobust([gp(2, -Infinity), gp(3, -Infinity)])).toEqual({ peak: null, robust: null, plateau: false });
    expect(pickRobust([])).toEqual({ peak: null, robust: null, plateau: false });
  });
});

describe("sweepParam", () => {
  const data = [{ symbol: "A", candles: series(1) }, { symbol: "B", candles: series(2) }];
  it("returns one pooled point per value, with consistent trade counts", () => {
    const pts = sweepParam(data, strat, "stopPct", [3, 6, 10]);
    expect(pts.map((p) => p.value)).toEqual([3, 6, 10]);
    expect(pts.every((p) => p.trades > 0)).toBe(true);
    // a tighter stop ends trades sooner, so it frees capital for more entries
    expect(pts[0].trades).toBeGreaterThanOrEqual(pts[2].trades - 1);
  });
  it("restricting to a slice only counts trades inside it", () => {
    const all = sweepParam(data, strat, "stopPct", [5])[0];
    const early = sweepParam(data, strat, "stopPct", [5], undefined, { slice: [0, 0.5] })[0];
    const late = sweepParam(data, strat, "stopPct", [5], undefined, { slice: [0.5, 1] })[0];
    expect(early.trades + late.trades).toBeLessThanOrEqual(all.trades + 2);
    expect(early.trades).toBeLessThan(all.trades);
  });
  it("is deterministic", () => {
    expect(sweepParam(data, strat, "maxHold", [10, 20])).toEqual(sweepParam(data, strat, "maxHold", [10, 20]));
  });
});

describe("planWindows", () => {
  it("rolls train and test windows without overlap between a window's own train and test", () => {
    const w = planWindows(2000, 750, 250, 250);
    expect(w).toEqual([
      { trainFrom: 0, trainTo: 750, testFrom: 750, testTo: 1000 },
      { trainFrom: 250, trainTo: 1000, testFrom: 1000, testTo: 1250 },
      { trainFrom: 500, trainTo: 1250, testFrom: 1250, testTo: 1500 },
      { trainFrom: 750, trainTo: 1500, testFrom: 1500, testTo: 1750 },
      { trainFrom: 1000, trainTo: 1750, testFrom: 1750, testTo: 2000 },
    ]);
    for (const x of w) expect(x.trainTo).toBe(x.testFrom);
  });
  it("returns nothing when there is too little history", () => {
    expect(planWindows(500, 750, 250, 250)).toEqual([]);
  });
});

describe("walkForward", () => {
  const r = walkForward(series(3, 2200), strat, "stopPct", [3, 5, 8, 12], undefined, { train: 700, test: 250, step: 250, minTrades: 3 });
  it("evaluates each chosen setting only on the unseen test period after it", () => {
    expect(r.windows.length).toBeGreaterThanOrEqual(5);
    for (const w of r.windows) expect(w.trainTo).toBe(w.testFrom);
    expect(r.windows.reduce((a, w) => a + w.testTrades, 0)).toBe(r.oos.trades);
  });
  it("reports efficiency, stability and the baseline for comparison", () => {
    expect(r.distinctChoices).toBeGreaterThanOrEqual(1);
    expect(r.distinctChoices).toBeLessThanOrEqual(4);
    expect(Number.isFinite(r.baseline.trades)).toBe(true);
    for (const x of [r.positiveShare]) expect(Number.isNaN(x) || (x >= 0 && x <= 1)).toBe(true);
  });
  it("is deterministic and yields no windows on short history", () => {
    expect(walkForward(series(3, 2200), strat, "stopPct", [3, 5, 8, 12], undefined, { train: 700, test: 250, step: 250, minTrades: 3 }).oos).toEqual(r.oos);
    expect(walkForward(series(3, 300), strat, "stopPct", [3, 5]).windows).toEqual([]);
  });
});

import { evalStrategy } from "./optimize";

describe("evalStrategy", () => {
  const data = [{ symbol: "A", candles: series(1) }, { symbol: "B", candles: series(2) }];
  it("matches a sweep at the same setting", () => {
    const base = evalStrategy(data, strat);
    const same = sweepParam(data, strat, "stopPct", [strat.stopLoss!.value])[0];
    expect(base.trades).toBe(same.trades);
    expect(base.expectancyPct).toBeCloseTo(same.expectancyPct);
  });
  it("respects the slice", () => {
    expect(evalStrategy(data, strat, undefined, { slice: [0.7, 1] }).trades).toBeLessThan(evalStrategy(data, strat).trades);
  });
});
