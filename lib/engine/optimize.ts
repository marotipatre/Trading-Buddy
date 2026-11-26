import type { Candle } from "@/lib/data/types";
import { DEFAULT_COSTS, type CostConfig } from "./costs";
import { runBacktest } from "./simulator";
import { poolTrades } from "./scan";
import type { StrategyDef } from "./strategy";
import type { Trade } from "./types";

/** The settings worth tuning for a swing strategy. Entries and exits stay as you defined them. */
export type ParamKey = "stopPct" | "stopAtr" | "maxHold" | "targetPct";

export const PARAM_LABEL: Record<ParamKey, string> = {
  stopPct: "Stop-loss (% below entry)",
  stopAtr: "Stop-loss (× ATR)",
  maxHold: "Max days to hold",
  targetPct: "Profit target (%)",
};

export const GRIDS: Record<ParamKey, number[]> = {
  stopPct: [2, 3, 4, 5, 6, 8, 10, 12, 15],
  stopAtr: [1, 1.5, 2, 2.5, 3, 4],
  maxHold: [5, 8, 10, 15, 20, 30, 40],
  targetPct: [4, 6, 8, 10, 15, 20],
};

/** Pure: the strategy with one setting changed. Other settings (trailing, ATR period, ...) are kept. */
export function applyParam(strat: StrategyDef, key: ParamKey, value: number): StrategyDef {
  switch (key) {
    case "stopPct": return { ...strat, stopLoss: { type: "percent", value, trailing: strat.stopLoss?.trailing ?? false, atrPeriod: strat.stopLoss?.atrPeriod ?? 14 } };
    case "stopAtr": return { ...strat, stopLoss: { type: "atr", value, trailing: strat.stopLoss?.trailing ?? false, atrPeriod: strat.stopLoss?.atrPeriod ?? 14 } };
    case "maxHold": return { ...strat, maxHoldBars: Math.max(1, Math.round(value)) };
    case "targetPct": return { ...strat, target: { type: "percent", value } };
  }
}

export type Objective = "expectancy" | "profitFactor";

/** The number being maximised. Too few trades scores -Infinity so a lucky handful can never win. */
export function scoreTrades(trades: Trade[], objective: Objective, minTrades = 15): number {
  if (trades.length < minTrades) return -Infinity;
  const p = poolTrades(trades);
  const v = objective === "expectancy" ? p.expectancyPct : p.profitFactor;
  return Number.isFinite(v) ? v : v === Infinity ? 99 : -Infinity;
}

export interface GridPoint { value: number; trades: number; winRate: number; expectancyPct: number; profitFactor: number; score: number }
export interface Series { symbol: string; candles: Candle[] }

const point = (value: number, trades: Trade[], objective: Objective, minTrades: number): GridPoint => {
  const p = poolTrades(trades);
  return { value, trades: p.trades, winRate: p.winRate, expectancyPct: p.expectancyPct, profitFactor: p.profitFactor, score: scoreTrades(trades, objective, minTrades) };
};

/** Pooled results of every value of one setting over one or many stocks, optionally within a slice of each history. */
export function sweepParam(
  series: Series[], strat: StrategyDef, key: ParamKey, values: number[], costs: CostConfig = DEFAULT_COSTS,
  opts: { objective?: Objective; minTrades?: number; /** fraction of each history to use, e.g. [0, 0.7] */ slice?: [number, number] } = {},
): GridPoint[] {
  const { objective = "expectancy", minTrades = 15, slice = [0, 1] } = opts;
  return values.map((v) => {
    const s = applyParam(strat, key, v);
    const trades: Trade[] = [];
    for (const { symbol, candles } of series) {
      const from = Math.floor(candles.length * slice[0]);
      const to = Math.floor(candles.length * slice[1]);
      const r = runBacktest(symbol, candles.slice(0, to), s, costs);
      // indicators warm up on everything before `from`, but only trades entered inside the slice count
      trades.push(...r.trades.filter((t) => t.entryIdx >= from));
    }
    return point(v, trades, objective, minTrades);
  });
}

export interface Robust { peak: GridPoint | null; robust: GridPoint | null; /** The robust choice sits on a plateau, not a lone spike. */ plateau: boolean }

const median3 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/**
 * Choose a value that works across a RANGE of neighbouring values, not the single best one (which is usually luck).
 * A value's robust score is the LOWER of its own score and the median of itself and its neighbours, so a lone spike
 * (great alone, poor next to it) and the shoulders around it both score low. A "plateau" means the neighbours are
 * also positive and within a similar range (0.5x to 3x): neither far below it nor a spike beside it.
 */
export function pickRobust(points: GridPoint[]): Robust {
  const ok = points.filter((p) => Number.isFinite(p.score));
  if (!ok.length) return { peak: null, robust: null, plateau: false };
  const peak = ok.reduce((a, b) => (b.score > a.score ? b : a));
  const scored = points.map((p, i) => {
    if (!Number.isFinite(p.score)) return { p, robust: -Infinity, n: 0 };
    const hood = [points[i - 1], p, points[i + 1]].filter((x): x is GridPoint => !!x && Number.isFinite(x.score)).map((x) => x.score);
    // at the edge of the grid there is only one neighbour, so use the weaker of the two
    const mid = hood.length === 3 ? median3(hood) : Math.min(...hood);
    return { p, robust: Math.min(p.score, mid), n: hood.length };
  });
  const best = scored.reduce((a, b) => (b.robust > a.robust ? b : a));
  const i = points.indexOf(best.p);
  const neighbours = [points[i - 1], points[i + 1]].filter((x): x is GridPoint => !!x && Number.isFinite(x.score));
  const plateau = best.n >= 3 && best.p.score > 0 && neighbours.length === 2 && neighbours.every((x) => x.score >= best.p.score * 0.5 && x.score <= best.p.score * 3);
  return { peak, robust: best.robust === -Infinity ? null : best.p, plateau };
}

export interface WalkWindow {
  index: number;
  trainFrom: number; trainTo: number; testFrom: number; testTo: number;
  chosen: number | null;
  trainScore: number;
  testTrades: number;
  testExpectancyPct: number;
  /** The strategy's own (unoptimised) setting over the same test period, for comparison. */
  baselineExpectancyPct: number;
}

export interface WalkForwardResult {
  windows: WalkWindow[];
  oos: ReturnType<typeof poolTrades>;
  baseline: ReturnType<typeof poolTrades>;
  /** Share of windows whose out-of-sample result was positive. */
  positiveShare: number;
  /** Out-of-sample expectancy relative to the in-sample expectancy that picked the settings; near 1 is healthy, near 0 is overfit. */
  efficiency: number;
  /** How many different values were chosen across windows (1 = very stable). */
  distinctChoices: number;
}

/** Pure: start indexes of rolling train/test windows. */
export function planWindows(bars: number, train: number, test: number, step: number): { trainFrom: number; trainTo: number; testFrom: number; testTo: number }[] {
  const out = [];
  for (let s = 0; s + train + test <= bars; s += step) out.push({ trainFrom: s, trainTo: s + train, testFrom: s + train, testTo: s + train + test });
  return out;
}

/**
 * Walk-forward test of one setting on one stock: for each rolling window pick the best value on the training
 * period (using the plateau rule), then measure it on the NEXT, unseen period. Stitching the unseen periods
 * together gives the honest result of "tune on the past, trade the future".
 */
export function walkForward(
  candles: Candle[], strat: StrategyDef, key: ParamKey, values: number[], costs: CostConfig = DEFAULT_COSTS,
  opts: { train?: number; test?: number; step?: number; objective?: Objective; minTrades?: number; symbol?: string } = {},
): WalkForwardResult {
  const { train = 750, test = 250, step = 250, objective = "expectancy", minTrades = 8, symbol = "X" } = opts;
  const oosAll: Trade[] = [];
  const baseAll: Trade[] = [];
  const windows: WalkWindow[] = [];
  for (const [index, w] of planWindows(candles.length, train, test, step).entries()) {
    const slice = candles.slice(w.trainFrom, w.testTo);
    const trainEnd = w.trainTo - w.trainFrom;
    const warm = Math.min(60, Math.floor(trainEnd / 4)); // ignore trades while indicators are still warming up
    const runs = values.map((v) => ({ v, trades: runBacktest(symbol, slice, applyParam(strat, key, v), costs).trades }));
    const trainPts = runs.map((r) => point(r.v, r.trades.filter((t) => t.entryIdx >= warm && t.entryIdx < trainEnd), objective, minTrades));
    const { robust } = pickRobust(trainPts);
    const chosenRun = robust ? runs.find((r) => r.v === robust.value)! : null;
    const testTrades = chosenRun ? chosenRun.trades.filter((t) => t.entryIdx >= trainEnd) : [];
    const baseTrades = runBacktest(symbol, slice, strat, costs).trades.filter((t) => t.entryIdx >= trainEnd);
    oosAll.push(...testTrades);
    baseAll.push(...baseTrades);
    windows.push({
      index, ...w, chosen: robust?.value ?? null, trainScore: robust?.score ?? NaN,
      testTrades: testTrades.length, testExpectancyPct: poolTrades(testTrades).expectancyPct, baselineExpectancyPct: poolTrades(baseTrades).expectancyPct,
    });
  }
  const oos = poolTrades(oosAll);
  const withTrades = windows.filter((w) => w.testTrades > 0);
  const trainMean = windows.filter((w) => Number.isFinite(w.trainScore)).reduce((a, w, _, arr) => a + w.trainScore / arr.length, 0);
  return {
    windows,
    oos,
    baseline: poolTrades(baseAll),
    positiveShare: withTrades.length ? withTrades.filter((w) => w.testExpectancyPct > 0).length / withTrades.length : NaN,
    efficiency: trainMean > 0 && Number.isFinite(oos.expectancyPct) ? oos.expectancyPct / trainMean : NaN,
    distinctChoices: new Set(windows.map((w) => w.chosen).filter((c) => c !== null)).size,
  };
}

/** Pooled result of the strategy exactly as it is (no setting changed), for comparison with an optimised value. */
export function evalStrategy(
  series: Series[], strat: StrategyDef, costs: CostConfig = DEFAULT_COSTS,
  opts: { objective?: Objective; minTrades?: number; slice?: [number, number] } = {},
): GridPoint {
  const { objective = "expectancy", minTrades = 15, slice = [0, 1] } = opts;
  const trades: Trade[] = [];
  for (const { symbol, candles } of series) {
    const from = Math.floor(candles.length * slice[0]);
    const to = Math.floor(candles.length * slice[1]);
    trades.push(...runBacktest(symbol, candles.slice(0, to), strat, costs).trades.filter((t) => t.entryIdx >= from));
  }
  return point(NaN, trades, objective, minTrades);
}
