import { mulberry32, quantile } from "./stats";
import type { Trade } from "./types";

export interface MonteCarloOptions {
  sims?: number;
  seed?: number;
  /** A path "ruins" if its drawdown reaches this percent. */
  ruinDrawdownPct?: number;
}

export interface MonteCarloResult {
  sims: number;
  tradesPerPath: number;
  /** Final return percentiles, in percent. */
  returnPct: { p5: number; p25: number; p50: number; p75: number; p95: number };
  maxDrawdownPct: { median: number; p95: number };
  probProfit: number;
  probRuin: number;
  ruinDrawdownPct: number;
}

/** Each trade's net P&L as a fraction of the equity held just before it. */
export function equityReturns(trades: Trade[], initialCapital: number): number[] {
  let equity = initialCapital;
  return trades.map((t) => {
    const r = equity > 0 ? t.netPnl / equity : 0;
    equity += t.netPnl;
    return r;
  });
}

/**
 * Bootstrap Monte Carlo: resample the trade returns with replacement to see how much of the
 * result was luck of ordering/selection. Assumes trades are independent and the future looks
 * like the sample; it cannot fix a biased or too-small sample.
 */
export function monteCarlo(returns: number[], opts: MonteCarloOptions = {}): MonteCarloResult | null {
  const { sims = 5000, seed = 1, ruinDrawdownPct = 50 } = opts;
  const n = returns.length;
  if (n === 0) return null;
  const rand = mulberry32(seed);
  const finals: number[] = [];
  const dds: number[] = [];
  let profit = 0;
  let ruin = 0;
  for (let s = 0; s < sims; s++) {
    let eq = 1;
    let peak = 1;
    let dd = 0;
    for (let k = 0; k < n; k++) {
      eq *= 1 + returns[Math.floor(rand() * n)];
      if (eq > peak) peak = eq;
      dd = Math.max(dd, (peak - eq) / peak);
    }
    finals.push((eq - 1) * 100);
    dds.push(dd * 100);
    if (eq > 1) profit++;
    if (dd * 100 >= ruinDrawdownPct) ruin++;
  }
  finals.sort((a, b) => a - b);
  dds.sort((a, b) => a - b);
  return {
    sims,
    tradesPerPath: n,
    returnPct: {
      p5: quantile(finals, 0.05),
      p25: quantile(finals, 0.25),
      p50: quantile(finals, 0.5),
      p75: quantile(finals, 0.75),
      p95: quantile(finals, 0.95),
    },
    maxDrawdownPct: { median: quantile(dds, 0.5), p95: quantile(dds, 0.95) },
    probProfit: profit / sims,
    probRuin: ruin / sims,
    ruinDrawdownPct,
  };
}
