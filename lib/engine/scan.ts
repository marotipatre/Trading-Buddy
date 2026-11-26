import type { Candle } from "@/lib/data/types";
import { DEFAULT_COSTS, type CostConfig } from "./costs";
import { computeMetrics, type Metrics } from "./metrics";
import { runBacktest } from "./simulator";
import { mean, wilsonInterval } from "./stats";
import type { StrategyDef } from "./strategy";
import { stopLossStudy } from "./stoploss-study";
import type { Trade } from "./types";

export interface ScanRow {
  symbol: string;
  name?: string;
  sector?: string;
  cap?: string;
  bars: number;
  trades: Trade[];
  metrics: Metrics;
  buyHoldPct: number;
  /** This stock's own trades before / after its 70% date split. */
  inSample: Trade[];
  outSample: Trade[];
  /** Total P&L of the same entries with no stop vs your stop (fixed notional); null if no stop or no trades. */
  stop: { none: number; user: number } | null;
}

/** Run one strategy on one stock's candles. Cheap (no Monte Carlo) so it can be repeated across a group. */
export function scanSymbol(
  meta: { symbol: string; name?: string; sector?: string; cap?: string },
  candles: Candle[],
  strat: StrategyDef,
  costs: CostConfig = DEFAULT_COSTS,
): ScanRow {
  const result = runBacktest(meta.symbol, candles, strat, costs);
  const split = Math.floor(candles.length * 0.7);
  let stop: ScanRow["stop"] = null;
  if (strat.stopLoss && result.trades.length) {
    const s = stopLossStudy(candles, strat, result.trades.map((t) => t.entryIdx - 1), costs);
    if (s.user) stop = { none: s.none.totalPnl, user: s.user.totalPnl };
  }
  return {
    ...meta,
    bars: candles.length,
    trades: result.trades,
    metrics: computeMetrics(result),
    buyHoldPct: candles.length > 1 ? (candles.at(-1)!.close / candles[0].close - 1) * 100 : NaN,
    inSample: result.trades.filter((t) => t.entryIdx < split),
    outSample: result.trades.filter((t) => t.entryIdx >= split),
    stop,
  };
}

export interface PooledStats {
  trades: number;
  wins: number;
  winRate: number;
  winRateCI: [number, number];
  expectancyPct: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
}

/** Statistics over a pool of trades from many stocks (each trade's return is on its own capital, so they are comparable). */
export function poolTrades(trades: Trade[]): PooledStats {
  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl <= 0);
  const gp = wins.reduce((a, t) => a + t.netPnl, 0);
  const gl = -losses.reduce((a, t) => a + t.netPnl, 0);
  return {
    trades: trades.length,
    wins: wins.length,
    winRate: trades.length ? wins.length / trades.length : NaN,
    winRateCI: wilsonInterval(wins.length, trades.length),
    expectancyPct: trades.length ? mean(trades.map((t) => t.returnPct)) : NaN,
    avgWinPct: wins.length ? mean(wins.map((t) => t.returnPct)) : NaN,
    avgLossPct: losses.length ? mean(losses.map((t) => t.returnPct)) : NaN,
    profitFactor: gl > 0 ? gp / gl : gp > 0 ? Infinity : NaN,
  };
}

export interface GroupStat { key: string; symbols: number; trades: number; winRate: number; expectancyPct: number; medianReturnPct: number }

const median = (xs: number[]) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function groupBy(rows: ScanRow[], keyOf: (r: ScanRow) => string | undefined): GroupStat[] {
  const m = new Map<string, ScanRow[]>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k) m.set(k, [...(m.get(k) ?? []), r]);
  }
  return [...m.entries()]
    .map(([key, rs]) => {
      const p = poolTrades(rs.flatMap((r) => r.trades));
      return { key, symbols: rs.length, trades: p.trades, winRate: p.winRate, expectancyPct: p.expectancyPct, medianReturnPct: median(rs.map((r) => r.metrics.totalReturnPct)) };
    })
    .sort((a, b) => b.symbols - a.symbols || a.key.localeCompare(b.key));
}

export interface ScanSummary {
  symbols: number;
  pooled: PooledStats;
  inSample: PooledStats;
  outSample: PooledStats;
  /** Share of stocks where the strategy made money. */
  profitableShare: number;
  medianStrategyReturnPct: number;
  medianBuyHoldPct: number;
  /** Share of stocks where the strategy beat simply holding. */
  beatBuyHoldShare: number;
  bySector: GroupStat[];
  byCap: GroupStat[];
  /** Effect of your stop-loss summed over all stocks, same entries replayed without it. */
  stop: { stocks: number; helped: number; totalNone: number; totalUser: number } | null;
  warnings: string[];
}

export function summarizeScan(rows: ScanRow[]): ScanSummary {
  const all = rows.flatMap((r) => r.trades);
  const pooled = poolTrades(all);
  const withStop = rows.filter((r) => r.stop);
  const warnings: string[] = [];
  if (rows.length < 10) warnings.push(`Only ${rows.length} stocks: a group this small can still be luck. Try 20 or more.`);
  if (pooled.trades < 100) warnings.push(`Only ${pooled.trades} trades in total: treat the win rate as a rough guide (see its confidence range).`);
  const out = poolTrades(rows.flatMap((r) => r.outSample));
  const inn = poolTrades(rows.flatMap((r) => r.inSample));
  if (inn.expectancyPct > 0 && out.expectancyPct < 0 && out.trades >= 20) warnings.push("Profitable in the earlier 70% of history but losing in the later 30% across the group: a sign of overfitting or a changed market.");
  const beat = rows.filter((r) => r.metrics.totalReturnPct > r.buyHoldPct).length;
  return {
    symbols: rows.length,
    pooled,
    inSample: inn,
    outSample: out,
    profitableShare: rows.length ? rows.filter((r) => r.metrics.totalReturnPct > 0).length / rows.length : NaN,
    medianStrategyReturnPct: median(rows.map((r) => r.metrics.totalReturnPct)),
    medianBuyHoldPct: median(rows.map((r) => r.buyHoldPct)),
    beatBuyHoldShare: rows.length ? beat / rows.length : NaN,
    bySector: groupBy(rows, (r) => r.sector),
    byCap: groupBy(rows, (r) => r.cap),
    stop: withStop.length
      ? { stocks: withStop.length, helped: withStop.filter((r) => r.stop!.user > r.stop!.none).length, totalNone: withStop.reduce((a, r) => a + r.stop!.none, 0), totalUser: withStop.reduce((a, r) => a + r.stop!.user, 0) }
      : null,
    warnings,
  };
}

/** Pick `n` items spread evenly through a list (so a scan is not just the A's). Deterministic. */
export function sampleEvenly<T>(list: T[], n: number): T[] {
  if (n >= list.length) return [...list];
  if (n <= 0) return [];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(list[Math.floor((i * list.length) / n)]);
  return out;
}
