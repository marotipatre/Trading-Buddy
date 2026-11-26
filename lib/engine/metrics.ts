import { mean, stdev, wilsonInterval } from "./stats";
import type { BacktestResult } from "./simulator";
import type { EquityPoint, ExitReason, Trade } from "./types";

export interface Metrics {
  trades: number;
  wins: number;
  losses: number;
  winRate: number; // 0..1
  winRateCI: [number, number]; // Wilson 95%
  avgWinPct: number;
  avgLossPct: number; // negative
  payoffRatio: number; // avg win / |avg loss|
  profitFactor: number; // gross profit / gross loss (Infinity if no losses)
  expectancyPct: number; // mean net return per trade, %
  expectancyR: number; // mean R multiple (trades with a stop only)
  totalReturnPct: number;
  cagrPct: number;
  maxDrawdownPct: number; // positive number
  sharpe: number; // annualised, daily equity returns, rf = 0
  maxConsecutiveLosses: number;
  avgBarsHeld: number;
  totalCharges: number;
  exitReasons: Record<ExitReason, number>;
  /** Fewer than 30 trades: statistics are unreliable. */
  lowSample: boolean;
}

export function maxDrawdown(equity: EquityPoint[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const p of equity) {
    peak = Math.max(peak, p.equity);
    if (peak > 0) worst = Math.max(worst, (peak - p.equity) / peak);
  }
  return worst * 100;
}

export function drawdownSeries(equity: EquityPoint[]): { time: number; dd: number }[] {
  let peak = -Infinity;
  return equity.map((p) => {
    peak = Math.max(peak, p.equity);
    return { time: p.time, dd: peak > 0 ? ((p.equity - peak) / peak) * 100 : 0 };
  });
}

export function maxConsecutiveLosses(trades: Trade[]): number {
  let best = 0;
  let run = 0;
  for (const t of trades) {
    run = t.netPnl < 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function sharpeRatio(equity: EquityPoint[], periodsPerYear = 252): number {
  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    if (equity[i - 1].equity > 0) rets.push(equity[i].equity / equity[i - 1].equity - 1);
  }
  const sd = stdev(rets);
  return sd > 0 ? (mean(rets) / sd) * Math.sqrt(periodsPerYear) : NaN;
}

export function computeMetrics(r: Pick<BacktestResult, "trades" | "equity" | "initialCapital" | "finalEquity">): Metrics {
  const { trades, equity, initialCapital, finalEquity } = r;
  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl <= 0);
  const grossProfit = wins.reduce((a, t) => a + t.netPnl, 0);
  const grossLoss = -losses.reduce((a, t) => a + t.netPnl, 0);
  const avgWinPct = mean(wins.map((t) => t.returnPct));
  const avgLossPct = mean(losses.map((t) => t.returnPct));
  const rs = trades.map((t) => t.rMultiple).filter((x) => !Number.isNaN(x));
  const exitReasons: Record<ExitReason, number> = { stop: 0, target: 0, signal: 0, time: 0, end: 0 };
  trades.forEach((t) => exitReasons[t.exitReason]++);

  const years = equity.length > 1 ? (equity.at(-1)!.time - equity[0].time) / (365.25 * 86400) : 0;
  const totalReturn = finalEquity / initialCapital - 1;
  const cagr = years > 0 && finalEquity > 0 ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100 : NaN;

  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? wins.length / trades.length : NaN,
    winRateCI: wilsonInterval(wins.length, trades.length),
    avgWinPct,
    avgLossPct,
    payoffRatio: avgLossPct < 0 ? avgWinPct / Math.abs(avgLossPct) : NaN,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : NaN,
    expectancyPct: mean(trades.map((t) => t.returnPct)),
    expectancyR: mean(rs),
    totalReturnPct: totalReturn * 100,
    cagrPct: cagr,
    maxDrawdownPct: maxDrawdown(equity),
    sharpe: sharpeRatio(equity),
    maxConsecutiveLosses: maxConsecutiveLosses(trades),
    avgBarsHeld: mean(trades.map((t) => t.barsHeld)),
    totalCharges: trades.reduce((a, t) => a + t.charges, 0),
    exitReasons,
    lowSample: trades.length < 30,
  };
}
