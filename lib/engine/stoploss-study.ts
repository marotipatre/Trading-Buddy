import type { Candle } from "@/lib/data/types";
import { DEFAULT_COSTS, roundTripCharges, type CostConfig } from "./costs";
import { buildSignals, SeriesCache } from "./rules";
import { makeLevelSource, resolveDistances, walkRulesFor, type Levels } from "./simulator";
import { mean } from "./stats";
import type { StrategyDef, StopLoss } from "./strategy";
import type { ExitReason } from "./types";
import { entryFill, walkTrade } from "./walk";

export interface StudyTrade {
  entryIdx: number;
  exitIdx: number;
  returnPct: number; // net of charges, on the notional deployed
  pnl: number;
  reason: ExitReason;
  maePct: number;
  mfePct: number;
}

export interface VariantStats {
  label: string;
  stop: StopLoss | null;
  trades: number;
  winRate: number;
  expectancyPct: number;
  avgLossPct: number;
  worstTradePct: number;
  profitFactor: number;
  totalPnl: number;
  maxDrawdownPct: number; // on cumulative P&L vs initial capital
  stoppedOut: number;
}

export interface StopLossStudy {
  entries: number;
  notional: number;
  none: VariantStats;
  user: VariantStats | null;
  grid: VariantStats[];
  /** Per-trade MAE/MFE measured with NO stop, to show what stops would have cut. */
  scatter: { maePct: number; mfePct: number; returnPct: number }[];
  winnersMaeP90: number; // a stop wider than this keeps 90% of eventual winners alive
  losersMedianMfePct: number;
  /** User stop vs no stop, summed over trades the user's stop closed. */
  impact: {
    stoppedTrades: number;
    wouldHaveRecovered: number; // stopped trades that were profitable with no stop
    lossSaved: number; // INR the stop saved vs holding on
    profitForgone: number; // INR the stop gave up vs holding on
  } | null;
  verdict: string;
  caveats: string[];
}

const DEFAULT_PCT_GRID = [1, 2, 3, 5, 7, 10, 15];
const DEFAULT_ATR_GRID = [1, 1.5, 2, 3, 4];

/**
 * Replays `signalIdx` entries under `strat`'s exits. The target distance is ALWAYS resolved from
 * `base` (the user's original strategy) so that only the stop varies between variants. An
 * R-multiple target would otherwise stretch or shrink with each candidate stop.
 */
function simulateEntries(
  candles: Candle[],
  signalIdx: number[],
  base: StrategyDef,
  strat: StrategyDef,
  exitSig: boolean[] | undefined,
  levels: (i: number) => Levels,
  notional: number,
  costs: CostConfig,
): StudyTrade[] {
  const out: StudyTrade[] = [];
  const sign = strat.direction === "long" ? 1 : -1;
  for (const s of signalIdx) {
    const e = s + 1;
    if (e >= candles.length) continue;
    const entryPrice = entryFill(candles[e].open, strat.direction, costs.slippageBps);
    const qty = Math.floor(notional / entryPrice);
    if (qty < 1) continue;
    const baseD = resolveDistances(base, entryPrice, levels(s));
    if (baseD.invalid) continue; // the strategy itself would not have taken this trade
    const d = { stopDist: resolveDistances(strat, entryPrice, levels(s)).stopDist, targetDist: baseD.targetDist };
    const w = walkTrade(candles, e, entryPrice, walkRulesFor(strat, d, exitSig, costs));
    const pnl = sign * (w.exitPrice - entryPrice) * qty - roundTripCharges(strat.direction, qty, entryPrice, w.exitPrice, strat.product, costs);
    out.push({ entryIdx: e, exitIdx: w.exitIdx, returnPct: (pnl / (qty * entryPrice)) * 100, pnl, reason: w.exitReason, maePct: w.maePct, mfePct: w.mfePct });
  }
  return out;
}

export function summarize(label: string, stop: StopLoss | null, trades: StudyTrade[], initialCapital: number): VariantStats {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const gp = wins.reduce((a, t) => a + t.pnl, 0);
  const gl = -losses.reduce((a, t) => a + t.pnl, 0);
  let eq = initialCapital;
  let peak = eq;
  let dd = 0;
  for (const t of [...trades].sort((a, b) => a.exitIdx - b.exitIdx)) {
    eq += t.pnl;
    peak = Math.max(peak, eq);
    dd = Math.max(dd, (peak - eq) / peak);
  }
  return {
    label,
    stop,
    trades: trades.length,
    winRate: trades.length ? wins.length / trades.length : NaN,
    expectancyPct: mean(trades.map((t) => t.returnPct)),
    avgLossPct: mean(losses.map((t) => t.returnPct)),
    worstTradePct: trades.length ? Math.min(...trades.map((t) => t.returnPct)) : NaN,
    profitFactor: gl > 0 ? gp / gl : gp > 0 ? Infinity : NaN,
    totalPnl: trades.reduce((a, t) => a + t.pnl, 0),
    maxDrawdownPct: dd * 100,
    stoppedOut: trades.filter((t) => t.reason === "stop").length,
  };
}

/**
 * Replays the strategy's own entries under different stop-losses (everything else held
 * constant) so the effect of the stop is isolated. Entries are independent, fixed-notional
 * trades; overlapping positions are allowed, unlike the portfolio backtest.
 */
export function stopLossStudy(
  candles: Candle[],
  strat: StrategyDef,
  entrySignalIdx: number[],
  costs: CostConfig = DEFAULT_COSTS,
): StopLossStudy {
  const cache = new SeriesCache(candles);
  const exitSig = strat.exit ? buildSignals(cache, strat.exit) : undefined;
  const atrP = strat.stopLoss?.atrPeriod ?? 14;
  const levels = makeLevelSource(candles, strat);
  const notional = strat.initialCapital / 10;
  const trailing = strat.stopLoss?.trailing ?? false;
  const run = (stop: StopLoss | undefined) =>
    simulateEntries(candles, entrySignalIdx, strat, { ...strat, stopLoss: stop }, exitSig, levels, notional, costs);
  const stat = (label: string, stop: StopLoss | undefined, t: StudyTrade[]) => summarize(label, stop ?? null, t, strat.initialCapital);

  const noneTrades = run(undefined);
  const none = stat("No stop-loss", undefined, noneTrades);

  const userTrades = strat.stopLoss ? run(strat.stopLoss) : null;
  const user = strat.stopLoss && userTrades ? stat("Your stop", strat.stopLoss, userTrades) : null;

  const grid: VariantStats[] = [
    ...DEFAULT_PCT_GRID.map((v) => ({ type: "percent" as const, value: v })),
    ...DEFAULT_ATR_GRID.map((v) => ({ type: "atr" as const, value: v })),
  ].map((g) => {
    const stop: StopLoss = { ...g, trailing, atrPeriod: atrP };
    return stat(g.type === "percent" ? `${g.value}% stop` : `${g.value}×ATR stop`, stop, run(stop));
  });

  // MAE/MFE from the no-stop run: how far did eventual winners dip, how far did losers run?
  const winners = noneTrades.filter((t) => t.pnl > 0);
  const losers = noneTrades.filter((t) => t.pnl <= 0);
  const sortedMae = winners.map((t) => t.maePct).sort((a, b) => a - b);
  const winnersMaeP90 = sortedMae.length ? sortedMae[Math.min(sortedMae.length - 1, Math.floor(sortedMae.length * 0.9))] : NaN;
  const sortedLoserMfe = losers.map((t) => t.mfePct).sort((a, b) => a - b);
  const losersMedianMfePct = sortedLoserMfe.length ? sortedLoserMfe[Math.floor(sortedLoserMfe.length / 2)] : NaN;

  let impact: StopLossStudy["impact"] = null;
  if (userTrades) {
    const byEntry = new Map(noneTrades.map((t) => [t.entryIdx, t]));
    let saved = 0;
    let forgone = 0;
    let recovered = 0;
    let stopped = 0;
    for (const t of userTrades) {
      if (t.reason !== "stop") continue;
      const base = byEntry.get(t.entryIdx);
      if (!base) continue;
      stopped++;
      if (base.pnl > 0) recovered++;
      const diff = t.pnl - base.pnl;
      if (diff > 0) saved += diff;
      else forgone += -diff;
    }
    impact = { stoppedTrades: stopped, wouldHaveRecovered: recovered, lossSaved: saved, profitForgone: forgone };
  }

  const caveats = [
    "Entries are the ones your strategy took; each is replayed independently with a fixed notional.",
    "Your profit target is held at the same price distance in every variant, so only the stop changes.",
    "Picking the best stop from the grid is itself curve-fitting. Prefer a stop that is good across a wide, flat range of values.",
  ];
  if (entrySignalIdx.length < 30) caveats.unshift(`Only ${entrySignalIdx.length} entries: results are too noisy to trust.`);

  return {
    entries: noneTrades.length,
    notional,
    none,
    user,
    grid,
    scatter: noneTrades.map((t) => ({ maePct: t.maePct, mfePct: t.mfePct, returnPct: t.returnPct })),
    winnersMaeP90,
    losersMedianMfePct,
    impact,
    verdict: buildVerdict(none, user, impact, winnersMaeP90, strat),
    caveats,
  };
}

const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");
const inr = (x: number) => `₹${Math.round(x).toLocaleString("en-IN")}`;

export function buildVerdict(
  none: VariantStats,
  user: VariantStats | null,
  impact: StopLossStudy["impact"],
  winnersMaeP90: number,
  strat: StrategyDef,
): string {
  if (!user || !impact) {
    return `No stop-loss is defined. Without one, the worst single trade lost ${f(none.worstTradePct)}% and max drawdown was ${f(none.maxDrawdownPct)}%. Compare the grid below to choose one.`;
  }
  const dd = user.maxDrawdownPct - none.maxDrawdownPct;
  const pnl = user.totalPnl - none.totalPnl;
  const parts: string[] = [];
  parts.push(
    `Your ${strat.stopLoss!.type === "percent" ? `${strat.stopLoss!.value}%` : `${strat.stopLoss!.value}×ATR`} stop ${dd < -0.05 ? "reduced" : dd > 0.05 ? "increased" : "did not change"} max drawdown ${f(none.maxDrawdownPct)}% → ${f(user.maxDrawdownPct)}%` +
      ` and changed total P&L by ${pnl >= 0 ? "+" : "-"}${inr(Math.abs(pnl))} (${inr(none.totalPnl)} → ${inr(user.totalPnl)}).`,
  );
  parts.push(`It cut the worst trade from ${f(none.worstTradePct)}% to ${f(user.worstTradePct)}%.`);
  if (impact.stoppedTrades > 0) {
    parts.push(
      `${impact.stoppedTrades} trades were stopped out; ${impact.wouldHaveRecovered} of them (${f((impact.wouldHaveRecovered / impact.stoppedTrades) * 100, 0)}%) would have ended profitable without the stop. ` +
        `The stop saved ${inr(impact.lossSaved)} on trades that kept falling but gave up ${inr(impact.profitForgone)} on trades that recovered.`,
    );
  }
  if (Number.isFinite(winnersMaeP90) && strat.stopLoss?.type === "percent" && strat.stopLoss.value < winnersMaeP90) {
    parts.push(`Warning: 90% of eventual winners dipped up to ${f(winnersMaeP90)}% first, so a ${strat.stopLoss.value}% stop is likely too tight.`);
  }
  const helps = pnl > 0 || (dd < -2 && pnl > -0.1 * Math.abs(none.totalPnl));
  parts.push(helps ? "Verdict: the stop is helping." : "Verdict: the stop is costing more than it protects on this sample.");
  return parts.join(" ");
}
