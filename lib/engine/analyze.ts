import type { Candle } from "@/lib/data/types";
import { DEFAULT_COSTS, type CostConfig } from "./costs";
import { computeMetrics, type Metrics } from "./metrics";
import { equityReturns, monteCarlo, type MonteCarloResult } from "./montecarlo";
import { runBacktest, type BacktestResult } from "./simulator";
import type { StrategyDef } from "./strategy";
import { stopLossStudy, type StopLossStudy } from "./stoploss-study";
import type { EquityPoint, Trade } from "./types";

export interface Analysis {
  symbol: string;
  result: BacktestResult;
  metrics: Metrics;
  monteCarlo: MonteCarloResult | null;
  stopStudy: StopLossStudy;
  /** Trades split by time: the later `oosFraction` of the data is held out. */
  outOfSample: { splitTime: number; inSample: Metrics; outSample: Metrics } | null;
  buyHoldReturnPct: number;
  warnings: string[];
}

/** Equity curve stepped at each trade exit, for metrics over a subset of trades. */
export function equityFromTrades(trades: Trade[], initialCapital: number): { equity: EquityPoint[]; finalEquity: number } {
  const sorted = [...trades].sort((a, b) => a.exitTime - b.exitTime);
  let eq = initialCapital;
  const equity: EquityPoint[] = [{ time: sorted[0]?.entryTime ?? 0, equity: eq }];
  for (const t of sorted) {
    eq += t.netPnl;
    equity.push({ time: t.exitTime, equity: eq });
  }
  return { equity, finalEquity: eq };
}

function subsetMetrics(trades: Trade[], initialCapital: number): Metrics {
  const { equity, finalEquity } = equityFromTrades(trades, initialCapital);
  return computeMetrics({ trades, equity, initialCapital, finalEquity });
}

export function analyze(
  symbol: string,
  candles: Candle[],
  strat: StrategyDef,
  costs: CostConfig = DEFAULT_COSTS,
  opts: { oosFraction?: number; mcSims?: number } = {},
): Analysis {
  const { oosFraction = 0.3, mcSims = 5000 } = opts;
  const result = runBacktest(symbol, candles, strat, costs);
  const metrics = computeMetrics(result);
  const warnings: string[] = [];
  if (candles.length < 250) warnings.push(`Only ${candles.length} bars of history; results may not be representative.`);
  if (metrics.lowSample) warnings.push(`Only ${metrics.trades} trades: win rate and expectancy are statistically weak (see the confidence interval).`);

  const mc = monteCarlo(equityReturns(result.trades, result.initialCapital), { sims: mcSims });
  const stopStudy = stopLossStudy(candles, strat, result.trades.map((t) => t.entryIdx - 1), costs);

  let outOfSample: Analysis["outOfSample"] = null;
  if (candles.length >= 100 && result.trades.length >= 4) {
    const splitIdx = Math.floor(candles.length * (1 - oosFraction));
    const splitTime = candles[splitIdx].time;
    const inS = result.trades.filter((t) => t.entryIdx < splitIdx);
    const outS = result.trades.filter((t) => t.entryIdx >= splitIdx);
    if (inS.length && outS.length) {
      outOfSample = { splitTime, inSample: subsetMetrics(inS, strat.initialCapital), outSample: subsetMetrics(outS, strat.initialCapital) };
      if (outOfSample.outSample.expectancyPct < 0 && outOfSample.inSample.expectancyPct > 0) {
        warnings.push("Profitable in-sample but losing out-of-sample: the edge may be overfit or regime-dependent.");
      }
    }
  }

  const buyHoldReturnPct = candles.length > 1 ? (candles.at(-1)!.close / candles[0].close - 1) * 100 : NaN;
  return { symbol, result, metrics, monteCarlo: mc, stopStudy, outOfSample, buyHoldReturnPct, warnings };
}
