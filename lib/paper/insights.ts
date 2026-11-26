import { mean } from "@/lib/engine/stats";
import type { ClosedTrade, PaperState } from "./types";

export interface GroupStat { key: string; n: number; winRate: number; avgReturnPct: number; totalPnl: number }

export interface Insights {
  n: number;
  lowSample: boolean;
  withStop: number;
  stopUsagePct: number;
  /** Average initial stop distance, % of entry, over trades that had one. */
  avgStopPct?: number;
  avgWinR?: number;
  avgLossR?: number;
  expectancyR?: number;
  worstLossR?: number;
  winnersAvgMaePct?: number;
  losersAvgMfePct?: number;
  /** Losing trades that had been at least 1R in profit first. */
  gaveBack: { count: number; of: number };
  protectedAvgPct?: number;
  unprotectedAvgPct?: number;
  byExit: GroupStat[];
  byTag: GroupStat[];
  bySymbol: GroupStat[];
  byProduct: GroupStat[];
  tips: string[];
}

const win = (t: ClosedTrade) => t.netPnl > 0;
const riskPct = (t: ClosedTrade) => (t.initialRisk !== undefined && t.qty > 0 ? (t.initialRisk / (t.qty * t.entryPrice)) * 100 : undefined);
const def = (xs: (number | undefined)[]) => xs.filter((x): x is number => x !== undefined && Number.isFinite(x));
const avg = (xs: number[]) => (xs.length ? mean(xs) : undefined);

function group(trades: ClosedTrade[], keyOf: (t: ClosedTrade) => string[]): GroupStat[] {
  const map = new Map<string, ClosedTrade[]>();
  for (const t of trades) for (const k of keyOf(t)) map.set(k, [...(map.get(k) ?? []), t]);
  return [...map.entries()]
    .map(([key, ts]) => ({
      key, n: ts.length, winRate: ts.filter(win).length / ts.length,
      avgReturnPct: mean(ts.map((t) => t.returnPct)), totalPnl: ts.reduce((a, t) => a + t.netPnl, 0),
    }))
    .sort((a, b) => b.n - a.n || b.totalPnl - a.totalPnl);
}

const pct = (x: number, d = 0) => `${x.toFixed(d)}%`;
const inr = (x: number) => `₹${Math.round(Math.abs(x)).toLocaleString("en-IN")}`;

export function computeInsights(state: Pick<PaperState, "trades">): Insights {
  const trades = state.trades;
  const n = trades.length;
  const stopped = trades.filter((t) => t.initialRisk !== undefined);
  const winners = trades.filter(win);
  const losers = trades.filter((t) => !win(t));
  const rOf = (ts: ClosedTrade[]) => def(ts.map((t) => t.rMultiple));
  const rWin = rOf(winners);
  const rLoss = rOf(losers);
  const rAll = rOf(trades);

  const gaveBackSet = losers.filter((t) => {
    const r = riskPct(t);
    return r !== undefined && r > 0 && (t.mfePct ?? 0) >= r;
  });
  const losersWithRisk = losers.filter((t) => t.initialRisk !== undefined).length;

  const prot = stopped;
  const unprot = trades.filter((t) => t.initialRisk === undefined);
  const out: Insights = {
    n,
    lowSample: n < 30,
    withStop: stopped.length,
    stopUsagePct: n ? (stopped.length / n) * 100 : 0,
    avgStopPct: avg(def(stopped.map(riskPct))),
    avgWinR: avg(rWin),
    avgLossR: avg(rLoss),
    expectancyR: avg(rAll),
    worstLossR: rLoss.length ? Math.min(...rLoss) : undefined,
    winnersAvgMaePct: avg(def(winners.map((t) => t.maePct))),
    losersAvgMfePct: avg(def(losers.map((t) => t.mfePct))),
    gaveBack: { count: gaveBackSet.length, of: losersWithRisk },
    protectedAvgPct: prot.length ? mean(prot.map((t) => t.returnPct)) : undefined,
    unprotectedAvgPct: unprot.length ? mean(unprot.map((t) => t.returnPct)) : undefined,
    byExit: group(trades, (t) => [t.reason]),
    byTag: group(trades, (t) => t.tags ?? []),
    bySymbol: group(trades, (t) => [t.symbol]).slice(0, 10),
    byProduct: group(trades, (t) => [t.product]),
    tips: [],
  };
  out.tips = buildTips(out, trades);
  return out;
}

function buildTips(i: Insights, trades: ClosedTrade[]): string[] {
  const tips: string[] = [];
  if (i.n === 0) return ["Place and close a few paper trades; this page then shows where you make and lose money."];
  if (i.n < 10) return [`You have ${i.n} closed trade${i.n > 1 ? "s" : ""}. Nothing here is meaningful until you have at least 30; keep a stop on every trade and tag why you entered.`];

  if (i.stopUsagePct < 80) {
    let s = `Only ${pct(i.stopUsagePct)} of your trades had a stop-loss.`;
    if (i.protectedAvgPct !== undefined && i.unprotectedAvgPct !== undefined && i.withStop >= 3 && i.n - i.withStop >= 3) {
      s += ` Trades with a stop averaged ${pct(i.protectedAvgPct, 2)}; trades without averaged ${pct(i.unprotectedAvgPct, 2)}.`;
    }
    tips.push(s);
  }
  if (i.gaveBack.count >= 3 && i.gaveBack.of > 0 && i.gaveBack.count / i.gaveBack.of >= 0.3) {
    tips.push(`${i.gaveBack.count} of your ${i.gaveBack.of} losing trades were at least 1R in profit before reversing. A profit target or a trailing stop would have protected them.`);
  }
  if (i.avgStopPct !== undefined && i.winnersAvgMaePct !== undefined && i.avgStopPct < i.winnersAvgMaePct) {
    tips.push(`Your winners dipped ${pct(i.winnersAvgMaePct, 1)} on average before working, but your stops average ${pct(i.avgStopPct, 1)}. Stops this tight cut trades that would have paid.`);
  }
  if (i.avgLossR !== undefined && i.avgLossR < -1.25 && i.n >= 10) {
    tips.push(`Your average loss is ${i.avgLossR.toFixed(2)}R, worse than the -1R you planned. Check for gaps, moved stops, or exiting late.`);
  }
  if (i.expectancyR !== undefined && i.expectancyR < 0 && i.n >= 20) {
    tips.push(`Expectancy is ${i.expectancyR.toFixed(2)}R per trade: on average you lose money per unit of risk. Review your setups before adding size.`);
  }
  const badTag = i.byTag.filter((g) => g.n >= 3 && g.avgReturnPct < 0).sort((a, b) => a.totalPnl - b.totalPnl)[0];
  if (badTag) tips.push(`Trades tagged "${badTag.key}" lost ${inr(badTag.totalPnl)} over ${badTag.n} trades (avg ${pct(badTag.avgReturnPct, 2)}).`);
  const goodTag = i.byTag.filter((g) => g.n >= 3 && g.avgReturnPct > 0).sort((a, b) => b.totalPnl - a.totalPnl)[0];
  if (goodTag) tips.push(`Your best tag is "${goodTag.key}": ${inr(goodTag.totalPnl)} over ${goodTag.n} trades, ${pct(goodTag.winRate * 100)} wins.`);
  const manualLosses = trades.filter((t) => t.reason === "manual" && t.netPnl < 0);
  const stopLosses = trades.filter((t) => t.reason === "stop");
  if (manualLosses.length >= 3 && stopLosses.length >= 3 && mean(manualLosses.map((t) => t.returnPct)) < mean(stopLosses.map((t) => t.returnPct))) {
    tips.push(`Losses you closed by hand (${pct(mean(manualLosses.map((t) => t.returnPct)), 2)} avg) are bigger than losses your stop took (${pct(mean(stopLosses.map((t) => t.returnPct)), 2)} avg). Trust the stop.`);
  }
  if (i.stopUsagePct >= 90 && (i.expectancyR ?? 0) > 0) tips.push("Good discipline: nearly every trade has a stop and your expectancy is positive.");
  if (i.lowSample) tips.push(`Only ${i.n} trades so far. Treat these findings as hints, not conclusions, until you reach 30+.`);
  return tips;
}
