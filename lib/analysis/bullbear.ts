import type { Regime } from "./regime";
import type { HorizonStats } from "./horizon";
import type { StockView } from "./stock-view";

export interface BullBear {
  bull: string[];
  bear: string[];
  /** Bulls minus bears, a rough balance, not a probability. */
  balance: number;
  lean: "favours buying" | "mixed" | "favours caution";
  /** What the numbers rest on, so each figure can be traced. */
  provenance: string[];
}

export interface BullBearInput {
  view: StockView;
  hz?: HorizonStats;
  patterns?: { name: string; bias: "bullish" | "bearish" | "neutral" }[];
  regime?: Regime;
  news?: { mood?: number; moodSource?: "ai" | "words"; brokersBuy?: number; brokersSell?: number; brokers?: number };
  days: number;
  target: number;
  asOf?: number;
}

/**
 * Both sides of the case, from the same data, side by side. Every line is produced by code from numbers on screen:
 * a model never invents a figure. The point is to show what you are betting against, not to give a prediction.
 */
export function bullBear(i: BullBearInput): BullBear {
  const bull: string[] = [], bear: string[] = [];
  for (const r of i.view.reasons) { if (r.points >= 6) bull.push(r.text); else if (r.points <= -6) bear.push(r.text); }
  const p = i.view.plan;
  if (p) {
    if (p.rr1 >= 2) bull.push(`Reward is ${p.rr1.toFixed(1)} times the risk (stop ${p.riskPct.toFixed(1)}% away)`);
    if (p.riskPct > 6) bear.push(`The stop is ${p.riskPct.toFixed(1)}% away, which makes each loss large`);
    if (p.rr1 < 1.5) bear.push(`Reward is only ${p.rr1.toFixed(1)} times the risk`);
  } else bear.push("No clean stop level to plan around");
  if (i.hz) {
    const hit = i.hz.hitRate * 100, stop = i.hz.stopRate * 100;
    if (i.hz.hitRate >= 0.3) bull.push(`In its past ${i.days}-day windows it reached +${i.target}% ${hit.toFixed(0)}% of the time`);
    else bear.push(`In its past ${i.days}-day windows it reached +${i.target}% only ${hit.toFixed(0)}% of the time`);
    if (i.hz.stopRate > i.hz.hitRate) bear.push(`It hit the stop first (${stop.toFixed(0)}%) more often than the target`);
    if (i.hz.expectancyPct > 0) bull.push(`Average result per trade over past windows: ${i.hz.expectancyPct >= 0 ? "+" : ""}${i.hz.expectancyPct.toFixed(1)}%`);
    else bear.push(`Average result per trade over past windows was ${i.hz.expectancyPct.toFixed(1)}%`);
  }
  for (const pt of i.patterns ?? []) { if (pt.bias === "bullish") bull.push(`Bullish candle pattern on the latest bar: ${pt.name}`); else if (pt.bias === "bearish") bear.push(`Bearish candle pattern on the latest bar: ${pt.name}`); }
  if (i.regime === "bull") bull.push("The broad market is in an uptrend");
  else if (i.regime === "bear") bear.push("The broad market is in a downtrend");
  else if (i.regime === "sideways") bear.push("The broad market is choppy");
  const n = i.news;
  if (n?.mood !== undefined) { if (n.mood > 0.15) bull.push("Recent headlines read positive"); else if (n.mood < -0.15) bear.push("Recent headlines read negative"); }
  if (n?.brokers && n.brokers >= 2) {
    if ((n.brokersBuy ?? 0) > (n.brokersSell ?? 0)) bull.push(`Published broker calls lean buy (${n.brokersBuy} of ${n.brokers})`);
    else if ((n.brokersSell ?? 0) > (n.brokersBuy ?? 0)) bear.push(`Published broker calls lean sell (${n.brokersSell} of ${n.brokers})`);
  }
  const balance = bull.length - bear.length;
  const provenance = [
    `Price signals and plan: computed from daily candles${i.asOf ? ` up to ${new Date(i.asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""} (Upstox open data, with fallbacks).`,
    `Past-window odds: replayed on this stock's own last 3 years; overlapping windows in mostly a rising market flatter them.`,
  ];
  if (n?.mood !== undefined) provenance.push(`Headline tone: ${n.moodSource === "ai" ? "FinBERT model running in your browser" : "word-list scorer"} on Google News headlines.`);
  return { bull, bear, balance, lean: balance >= 3 ? "favours buying" : balance <= -2 ? "favours caution" : "mixed", provenance };
}
