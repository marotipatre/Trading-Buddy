import type { IntradayPick } from "./picks";

export interface Bar { time: number; open: number; high: number; low: number; close: number }
export type Outcome = "target" | "stop" | "eod" | "no-entry" | "skipped-gap";
export interface PickResult { outcome: Outcome; entryPrice?: number; exitPrice?: number; pnlPct: number; r: number }

const istDate = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
const istMinutes = (t: number) => { const d = new Date((t + 19800) * 1000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

/**
 * What would have happened if you had followed the pick: buy-stop at the entry, stop-loss and first target, flat by 15:15.
 * Rules, all against the trader: a gap through the entry fills at the open (and the trade is skipped if it opens more than
 * 1% above entry or at or below the stop); if one bar touches both stop and target, the stop counts first.
 * Costs are not included.
 */
export function evaluatePick(pick: Pick<IntradayPick, "plan" | "forDate">, bars: Bar[]): PickResult | null {
  const day = bars.filter((b) => istDate(b.time) === pick.forDate && istMinutes(b.time) >= 9 * 60 + 15 && istMinutes(b.time) < 15 * 60 + 15).sort((a, b) => a.time - b.time);
  if (day.length < 3) return null; // the session has not happened, or there is no data
  const { entry, stop, target1, risk } = pick.plan;
  const first = day[0];
  if (first.open > entry * 1.01 || first.open <= stop) return { outcome: "skipped-gap", pnlPct: 0, r: 0 };
  let filled: number | null = null;
  let start = 0;
  if (first.open >= entry) { filled = first.open; start = 0; }
  else {
    const i = day.findIndex((b) => b.high >= entry);
    if (i < 0) return { outcome: "no-entry", pnlPct: 0, r: 0 };
    filled = entry; start = i;
  }
  for (let i = start; i < day.length; i++) {
    const b = day[i];
    if (b.low <= stop) return done("stop", filled, stop, risk); // the stop is checked before the target in every bar
    if (b.high >= target1) return done("target", filled, target1, risk);
  }
  return done("eod", filled, day[day.length - 1].close, risk);
}

function done(outcome: Outcome, entry: number, exit: number, risk: number): PickResult {
  return { outcome, entryPrice: entry, exitPrice: exit, pnlPct: ((exit - entry) / entry) * 100, r: (exit - entry) / risk };
}

export interface Scorecard { evaluated: number; taken: number; wins: number; losses: number; flat: number; skipped: number; winRate: number; avgR: number; totalR: number; avgPnlPct: number }

export function summarize(results: PickResult[]): Scorecard {
  const taken = results.filter((r) => r.outcome !== "no-entry" && r.outcome !== "skipped-gap");
  const wins = taken.filter((r) => r.r > 0).length, losses = taken.filter((r) => r.r < 0).length;
  const totalR = taken.reduce((s, r) => s + r.r, 0);
  return {
    evaluated: results.length, taken: taken.length, wins, losses, flat: taken.length - wins - losses, skipped: results.length - taken.length,
    winRate: taken.length ? wins / taken.length : 0, avgR: taken.length ? totalR / taken.length : 0, totalR,
    avgPnlPct: taken.length ? taken.reduce((s, r) => s + r.pnlPct, 0) / taken.length : 0,
  };
}
