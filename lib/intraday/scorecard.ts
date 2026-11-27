import type { IntradayPick } from "./picks";
import { vwap } from "./live";

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
export function evaluatePick(pick: Pick<IntradayPick, "plan" | "forDate"> & { side?: "long" | "short" }, bars: Bar[], opts: { confirm?: boolean } = {}): PickResult | null {
  const day = bars.filter((b) => istDate(b.time) === pick.forDate && istMinutes(b.time) >= 9 * 60 + 15 && istMinutes(b.time) < 15 * 60 + 15).sort((a, b) => a.time - b.time);
  if (day.length < 3) return null; // the session has not happened, or there is no data
  const dir = pick.side === "short" ? -1 : 1; // a short sale makes money when price falls
  const { entry, stop, target1, risk } = pick.plan;
  const first = day[0];
  const triggered = (b: Bar) => (dir > 0 ? b.high >= entry : b.low <= entry);
  const stopHit = (b: Bar) => (dir > 0 ? b.low <= stop : b.high >= stop);
  const targetHit = (b: Bar) => (dir > 0 ? b.high >= target1 : b.low <= target1);
  const gapped = dir > 0 ? first.open > entry * 1.01 || first.open <= stop : first.open < entry * 0.99 || first.open >= stop;
  if (gapped) return { outcome: "skipped-gap", pnlPct: 0, r: 0 };
  // With `confirm`, a trigger only counts when that candle also closes on the right side of the day's VWAP so far (buyers or sellers in control).
  const confirmed = (i: number) => {
    if (!opts.confirm) return true;
    const v = vwap(day.slice(0, i + 1).map((b) => ({ ...b, volume: (b as { volume?: number }).volume ?? 1 })));
    return v === null || (dir > 0 ? day[i].close >= v : day[i].close <= v);
  };
  let filled: number | null = null;
  let start = 0;
  if (opts.confirm) {
    const i = day.findIndex((b, k) => triggered(b) && confirmed(k));
    if (i < 0) return { outcome: "no-entry", pnlPct: 0, r: 0 };
    filled = dir > 0 ? Math.max(entry, day[i].open <= entry ? entry : day[i].open) : Math.min(entry, day[i].open >= entry ? entry : day[i].open); start = i;
  } else if (dir > 0 ? first.open >= entry : first.open <= entry) { filled = first.open; start = 0; }
  else {
    const i = day.findIndex(triggered);
    if (i < 0) return { outcome: "no-entry", pnlPct: 0, r: 0 };
    filled = entry; start = i;
  }
  for (let i = start; i < day.length; i++) {
    const b = day[i];
    if (stopHit(b)) return done("stop", filled, stop, risk, dir); // the stop is checked before the target in every bar
    if (targetHit(b)) return done("target", filled, target1, risk, dir);
  }
  return done("eod", filled, day[day.length - 1].close, risk, dir);
}

function done(outcome: Outcome, entry: number, exit: number, risk: number, dir: 1 | -1): PickResult {
  return { outcome, entryPrice: entry, exitPrice: exit, pnlPct: ((dir * (exit - entry)) / entry) * 100, r: (dir * (exit - entry)) / risk };
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
