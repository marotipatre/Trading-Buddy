import type { Candle } from "@/lib/data/types";
import { atr, ema, rsi } from "@/lib/engine/indicators";

export interface IntradayPlan {
  /** Buy-stop: buy when price trades up to this level. */
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  /** Rupees risked per share. */
  risk: number;
  riskPct: number;
  rr1: number;
}
export interface IntradayPick {
  symbol: string;
  name: string;
  sector: string;
  /** Session the plan is for, as YYYY-MM-DD in IST. */
  forDate: string;
  score: number;
  reasons: string[];
  plan: IntradayPlan;
  /** Previous session's close, for the "skip if it gaps" rules. */
  lastClose: number;
  atrPct: number;
  volumeRatio: number;
}

const tick = (x: number) => Math.round(x * 20) / 20;
const istDate = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);

/** The next weekday after a date (YYYY-MM-DD). Exchange holidays are not known here. */
export function nextSession(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Score a stock for a long intraday trade in the next session from its daily candles: liquid enough to trade with
 * margin, moving enough to reach a target, trending up, closing strong on rising volume. Returns null if it does not
 * qualify. `mood` (-1..1) is the headline tone, worth up to 10 points either way.
 */
export function scoreIntraday(symbol: string, name: string, sector: string, dailyIn: Candle[], mood = 0, nowSec?: number): IntradayPick | null {
  // While today's session is still running its daily candle is incomplete (volume and range are not final), so it is
  // dropped and the plan is built from the last finished day, for the session after today.
  let daily = dailyIn;
  let planFrom: string | undefined;
  if (nowSec !== undefined && daily.length) {
    const nowIst = new Date((nowSec + 19800) * 1000);
    const mins = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
    const today = istDate(nowSec);
    if (istDate(daily[daily.length - 1].time) === today && mins < 15 * 60 + 35 && nowIst.getUTCDay() >= 1 && nowIst.getUTCDay() <= 5) {
      daily = daily.slice(0, -1);
      planFrom = today;
    }
  }
  const n = daily.length - 1;
  if (n < 60) return null;
  const L = daily[n];
  const closes = daily.map((c) => c.close);
  const a = atr(daily, 14)[n];
  const e20 = ema(closes, 20)[n], e50 = ema(closes, 50)[n];
  const r = rsi(closes, 14)[n];
  if (![a, e20, e50, r].every(Number.isFinite) || !(L.high > L.low)) return null;

  const atrPct = (a / L.close) * 100;
  const last20 = daily.slice(n - 20, n);
  const avgVol = last20.reduce((s, c) => s + c.volume, 0) / 20;
  const turnover = last20.reduce((s, c) => s + c.close * c.volume, 0) / 20;
  const volumeRatio = avgVol > 0 ? L.volume / avgVol : 0;
  if (turnover < 2e8 || atrPct < 1 || atrPct > 4.5) return null; // thin or too sleepy/wild for a 5x margin day trade

  const closePos = (L.close - L.low) / (L.high - L.low);
  const ret3 = (L.close / daily[n - 3].close - 1) * 100;
  const ret5 = (L.close / daily[n - 5].close - 1) * 100;
  const reasons: string[] = [];
  let score = 0;
  const add = (pts: number, text: string) => { score += pts; reasons.push(text); };

  if (L.close > e20 && e20 > e50) add(25, "In an uptrend: price above its 20-day average, which is above the 50-day");
  else if (L.close > e50) add(8, "Above its 50-day average");
  else return null; // no long trades against the trend
  if (closePos >= 0.7) add(15, `Closed in the top ${Math.round((1 - closePos) * 100)}% of the day's range (buyers in control)`);
  else if (closePos >= 0.55) add(7, "Closed in the upper half of the day's range");
  if (volumeRatio >= 1.5) add(15, `Volume ${volumeRatio.toFixed(1)}x its 20-day average: strong participation`);
  else if (volumeRatio >= 1) add(8, `Volume ${volumeRatio.toFixed(1)}x its 20-day average`);
  if (r >= 55 && r <= 72) add(10, `RSI ${r.toFixed(0)}: positive momentum, not overheated`);
  else if (r > 78) score -= 8;
  if (ret5 > 1 && ret5 < 10) add(10, `Up ${ret5.toFixed(1)}% over five sessions`);
  else if (ret5 >= 10) reasons.push(`Already up ${ret5.toFixed(0)}% in five sessions: late-move risk`);
  if (ret3 > 0) add(5, "Rising over the last three sessions");
  if (atrPct >= 1.3 && atrPct <= 3.5) add(10, `Typical daily range ${atrPct.toFixed(1)}%: enough to reach a target`);
  add(5, `Trades about ₹${(turnover / 1e7).toFixed(0)} crore a day: easy to enter and exit`);
  if (Math.abs(mood) > 0.15) { const p = Math.round(mood * 10); score += p; reasons.push(`Recent headlines read ${mood > 0 ? "positive" : "negative"}`); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (score < 55) return null;

  const entry = tick(Math.max(L.high, L.close * 1.003) * 1.001);
  const d = Math.min(Math.max(0.45 * a, entry * 0.006), entry * 0.014);
  const stop = tick(entry - d);
  const risk = entry - stop;
  if (!(risk > 0)) return null;
  const plan: IntradayPlan = { entry, stop, target1: tick(entry + 1.5 * risk), target2: tick(entry + 2.5 * risk), risk, riskPct: (risk / entry) * 100, rr1: (tick(entry + 1.5 * risk) - entry) / risk };
  return { symbol, name, sector, forDate: nextSession(planFrom ?? istDate(L.time)), score, reasons, plan, lastClose: L.close, atrPct, volumeRatio };
}

/** The best `n` picks, at most `perSector` from one sector, best score first. */
export function topPicks(picks: IntradayPick[], n = 5, perSector = 2): IntradayPick[] {
  const used = new Map<string, number>();
  const out: IntradayPick[] = [];
  for (const p of [...picks].sort((a, b) => b.score - a.score)) {
    if (out.length >= n) break;
    if ((used.get(p.sector) ?? 0) >= perSector) continue;
    used.set(p.sector, (used.get(p.sector) ?? 0) + 1);
    out.push(p);
  }
  return out;
}

/**
 * Shares to buy: risk a fixed share of your own money (the pot) on the stop, and never let one position use more than
 * its share of the margin you can borrow. `slots` is how many positions you expect to hold at once.
 */
export function intradaySize(pot: number, leverage: number, riskPct: number, slots: number, plan: Pick<IntradayPlan, "entry" | "risk">): { qty: number; notional: number; margin: number; riskAmt: number; rewardAmt: number } {
  if (!(plan.risk > 0) || !(plan.entry > 0) || pot <= 0) return { qty: 0, notional: 0, margin: 0, riskAmt: 0, rewardAmt: 0 };
  const byRisk = Math.floor((pot * riskPct) / 100 / plan.risk);
  const byMargin = Math.floor((pot * leverage) / Math.max(1, slots) / plan.entry);
  const qty = Math.max(0, Math.min(byRisk, byMargin));
  return { qty, notional: qty * plan.entry, margin: (qty * plan.entry) / leverage, riskAmt: qty * plan.risk, rewardAmt: qty * plan.risk * 1.5 };
}
