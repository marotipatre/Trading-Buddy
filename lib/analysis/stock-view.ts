import type { Candle } from "@/lib/data/types";
import { atr, ema, rsi, sma, supertrend } from "@/lib/engine/indicators";
import { swingLevels } from "@/lib/engine/indicators/pivots";
import { aggregateWeekly } from "@/lib/chart-timeframes";

export type Verdict = "buy" | "watch" | "avoid";
export interface Reason { text: string; points: number }
export interface Plan {
  entry: number;
  /** "now" = price is close to its 20 EMA; "pullback" = wait for a dip to the 20 EMA. */
  entryKind: "now" | "pullback";
  stop: number;
  target1: number;
  target2: number;
  riskPct: number;
  rewardPct1: number;
  rr1: number;
  rr2: number;
}
export interface StockView {
  symbol: string;
  price: number;
  /** Technical score 0-100 from price alone. */
  technical: number;
  /** Final score after news and broker overlay (0-100). */
  score: number;
  verdict: Verdict;
  frames: { daily: "up" | "down" | "flat"; weekly: "up" | "down" | "flat"; monthly: "up" | "down" | "flat" };
  ret: { w1: number; m1: number; m3: number; m6: number };
  rsi: number;
  aboveEma50: boolean;
  reasons: Reason[];
  plan: Plan | null;
}

const last = <T,>(a: T[]) => a[a.length - 1];
const pctChange = (c: Candle[], bars: number) => (c.length > bars ? (last(c).close / c[c.length - 1 - bars].close - 1) * 100 : NaN);

/**
 * Score one stock for a 1-3 week swing long, from daily candles. Everything is computed from data up to the last bar.
 * Reasons list each rule that moved the score so the number can be audited.
 */
export function assessStock(symbol: string, candles: Candle[]): StockView | null {
  if (candles.length < 210) return null;
  const closes = candles.map((c) => c.close);
  const n = candles.length - 1;
  const price = closes[n];
  const e20 = ema(closes, 20)[n], e50 = ema(closes, 50)[n], e200 = ema(closes, 200)[n];
  const r = rsi(closes, 14)[n];
  const st = supertrend(candles, 10, 3).direction[n];
  const a = atr(candles, 14)[n];

  const weekly = aggregateWeekly(candles);
  const wc = weekly.map((c) => c.close);
  const w10 = wc.length >= 30 ? ema(wc, 10)[wc.length - 1] : NaN, w30 = wc.length >= 30 ? ema(wc, 30)[wc.length - 1] : NaN;
  const wFrame: "up" | "down" | "flat" = !Number.isFinite(w10) ? "flat" : w10 > w30 && last(wc) > w30 ? "up" : w10 < w30 && last(wc) < w30 ? "down" : "flat";
  const m6 = pctChange(candles, 126);
  const sma200 = sma(closes, 200)[n];
  const mFrame: "up" | "down" | "flat" = m6 > 3 && price > sma200 ? "up" : m6 < -3 && price < sma200 ? "down" : "flat";
  const dFrame: "up" | "down" | "flat" = e20 > e50 && price > e50 ? "up" : e20 < e50 && price < e50 ? "down" : "flat";

  const reasons: Reason[] = [];
  let score = 30;
  const add = (points: number, text: string) => { score += points; reasons.push({ text, points }); };

  if (price > e50) add(8, "Price is above its 50-day average"); else add(-10, "Price is below its 50-day average");
  if (e20 > e50) add(8, "20-day average is above the 50-day (uptrend)"); else add(-8, "20-day average is below the 50-day");
  if (e50 > e200) add(6, "50-day average is above the 200-day (long-term uptrend)"); else add(-6, "50-day average is below the 200-day");
  if (st > 0) add(7, "Supertrend is bullish"); else add(-7, "Supertrend is bearish");
  if (wFrame === "up") add(8, "Weekly trend is up"); else if (wFrame === "down") add(-8, "Weekly trend is down");
  if (mFrame === "up") add(5, "Six-month trend is up"); else if (mFrame === "down") add(-5, "Six-month trend is down");
  if (r >= 50 && r <= 68) add(6, `RSI ${r.toFixed(0)}: healthy momentum, not stretched`);
  else if (r > 75) add(-8, `RSI ${r.toFixed(0)}: overbought, a pullback is likely`);
  else if (r < 40) add(-5, `RSI ${r.toFixed(0)}: weak momentum`);
  const ext = ((price - e20) / e20) * 100;
  if (ext > 10) add(-8, `Price is ${ext.toFixed(0)}% above its 20-day average: chasing risk`);
  const m1 = pctChange(candles, 21);
  if (m1 > 4 && m1 < 25) add(4, `Up ${m1.toFixed(0)}% in a month`);

  const technical = Math.max(0, Math.min(100, Math.round(score)));
  const sw = swingLevels(candles, 5);

  // Plan for a long entry.
  let plan: Plan | null = null;
  if (Number.isFinite(a) && a > 0) {
    const nearTrend = ext <= 3;
    const entry = nearTrend ? price : Math.max(e20, price * 0.97);
    const lows = candles.slice(-10).map((c) => c.low);
    const swingLow = Math.min(...lows);
    let stop = Math.min(swingLow * 0.995, entry - 1.2 * a);
    stop = Math.max(stop, entry - 3 * a); // never wider than 3 ATR
    if (stop < entry) {
      const risk = entry - stop;
      const resistance = sw.resistance[n];
      const t1raw = Number.isFinite(resistance) && resistance > entry + 2 * risk ? resistance * 0.995 : entry + 2 * risk;
      const target1 = t1raw;
      const target2 = Math.max(entry * 1.12, target1 * 1.02);
      plan = {
        entry, entryKind: nearTrend ? "now" : "pullback", stop, target1, target2,
        riskPct: (risk / entry) * 100, rewardPct1: ((target1 - entry) / entry) * 100, rr1: (target1 - entry) / risk, rr2: (target2 - entry) / risk,
      };
    }
  }

  return {
    symbol, price, technical, score: technical, verdict: verdictOf(technical, plan),
    frames: { daily: dFrame, weekly: wFrame, monthly: mFrame },
    ret: { w1: pctChange(candles, 5), m1, m3: pctChange(candles, 63), m6 },
    rsi: r, aboveEma50: price > e50, reasons, plan,
  };
}

export function verdictOf(score: number, plan: Plan | null): Verdict {
  if (!plan || plan.rr1 < 1.5) return score >= 35 ? "watch" : "avoid"; // a setup without room to run is not a buy
  return score >= 65 ? "buy" : score >= 45 ? "watch" : "avoid";
}

/** Overlay news mood (-1..1) and broker consensus onto the technical score. Moves it by at most ±15. */
export function withOverlay(v: StockView, mood?: { score: number; count: number }, brokers?: { buy: number; hold: number; sell: number; brokers: number }): StockView {
  const reasons = [...v.reasons];
  let score = v.technical;
  if (mood && mood.count >= 3 && Math.abs(mood.score) > 0.15) {
    const p = Math.round(mood.score * 7);
    score += p; reasons.push({ text: `Recent headlines read ${mood.score > 0 ? "positive" : "negative"} (${mood.count} articles)`, points: p });
  }
  if (brokers && brokers.brokers >= 2) {
    const net = (brokers.buy - brokers.sell) / brokers.brokers;
    const p = Math.round(net * 8);
    if (p !== 0) { score += p; reasons.push({ text: `Brokers lean ${net > 0 ? "buy" : "sell"}: ${brokers.buy} buy, ${brokers.hold} hold, ${brokers.sell} sell`, points: p }); }
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { ...v, score, reasons, verdict: verdictOf(score, v.plan) };
}

/**
 * Rank the scanned stocks by 3-month return and move each score by up to ±10: in a rising market nearly everything
 * looks good on trend alone, so a buy must also be among the stronger names. Returns new views; scores re-sorted by caller.
 */
export function withRelativeStrength(views: StockView[]): StockView[] {
  const valid = views.filter((v) => Number.isFinite(v.ret.m3)).sort((a, b) => a.ret.m3 - b.ret.m3);
  const rank = new Map(valid.map((v, i) => [v.symbol, valid.length > 1 ? i / (valid.length - 1) : 0.5]));
  return views.map((v) => {
    const r = rank.get(v.symbol);
    if (r === undefined) return v;
    const p = Math.round((r - 0.5) * 20);
    if (p === 0) return v;
    const score = Math.max(0, Math.min(100, v.technical + p));
    const text = r >= 0.8 ? "Among the strongest 20% of scanned stocks over 3 months" : r <= 0.2 ? "Among the weakest 20% of scanned stocks over 3 months" : r > 0.5 ? "Stronger than the typical scanned stock over 3 months" : "Weaker than the typical scanned stock over 3 months";
    return { ...v, technical: score, score, reasons: [...v.reasons, { text, points: p }], verdict: verdictOf(score, v.plan) };
  });
}

/** How many shares to buy so that being stopped out costs `riskPct` of capital, capped at `maxPositionPct` of capital. */
export function positionSize(capital: number, riskPct: number, maxPositionPct: number, plan: Pick<Plan, "entry" | "stop">): { qty: number; value: number; risk: number } {
  const perShare = plan.entry - plan.stop;
  if (!(perShare > 0) || !(plan.entry > 0)) return { qty: 0, value: 0, risk: 0 };
  const byRisk = Math.floor((capital * riskPct) / 100 / perShare);
  const byCap = Math.floor((capital * maxPositionPct) / 100 / plan.entry);
  const qty = Math.max(0, Math.min(byRisk, byCap));
  return { qty, value: qty * plan.entry, risk: qty * perShare };
}
