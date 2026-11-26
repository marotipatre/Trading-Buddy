import type { Candle } from "@/lib/data/types";
import { atr, ema, rsi, sma, supertrend } from "@/lib/engine/indicators";
import { swingLevels } from "@/lib/engine/indicators/pivots";
import { aggregateMonthly, aggregateWeekly } from "@/lib/chart-timeframes";

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

export type Frame = "daily" | "weekly" | "monthly";
export const FRAME_LABEL: Record<Frame, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
/** Moving-average lengths, history needed, stop lookback and the second target for each candle size. */
const CFG: Record<Frame, { f: number; m: number; s: number; min: number; stopBars: number; t2: number; ext: number }> = {
  daily: { f: 20, m: 50, s: 200, min: 210, stopBars: 10, t2: 1.12, ext: 10 },
  weekly: { f: 10, m: 30, s: 50, min: 60, stopBars: 6, t2: 1.15, ext: 15 },
  monthly: { f: 3, m: 6, s: 12, min: 20, stopBars: 3, t2: 1.2, ext: 25 },
};
/** Days of daily history to download so the chosen frame has enough bars. */
export const HISTORY_DAYS: Record<Frame, number> = { daily: 800, weekly: 1600, monthly: 3650 };

/**
 * Score one stock for a swing long on the chosen candle size, from daily candles (weekly and monthly are built from them).
 * Everything is computed from data up to the last bar. Reasons list each rule that moved the score so it can be audited.
 */
export function assessStock(symbol: string, daily: Candle[], frame: Frame = "daily"): StockView | null {
  const cfg = CFG[frame];
  const candles = frame === "daily" ? daily : frame === "weekly" ? aggregateWeekly(daily) : aggregateMonthly(daily);
  if (candles.length < cfg.min || daily.length < 210) return null;
  const closes = candles.map((c) => c.close);
  const n = candles.length - 1;
  const price = closes[n];
  const e20 = ema(closes, cfg.f)[n], e50 = ema(closes, cfg.m)[n], e200 = ema(closes, cfg.s)[n];
  const r = rsi(closes, 14)[n];
  const st = supertrend(candles, 10, 3).direction[n];
  const a = atr(candles, 14)[n];
  const unit = frame === "daily" ? "day" : frame === "weekly" ? "week" : "month";

  // Trend on every candle size, always from the daily data, so the arrows are comparable across lists.
  const dn = daily.length - 1;
  const dc = daily.map((c) => c.close);
  const d20 = ema(dc, 20)[dn], d50 = ema(dc, 50)[dn];
  const weekly = aggregateWeekly(daily);
  const wc = weekly.map((c) => c.close);
  const w10 = wc.length >= 30 ? ema(wc, 10)[wc.length - 1] : NaN, w30 = wc.length >= 30 ? ema(wc, 30)[wc.length - 1] : NaN;
  const wFrame: "up" | "down" | "flat" = !Number.isFinite(w10) ? "flat" : w10 > w30 && last(wc) > w30 ? "up" : w10 < w30 && last(wc) < w30 ? "down" : "flat";
  const m6 = pctChange(daily, 126);
  const sma200 = sma(dc, 200)[dn];
  const mFrame: "up" | "down" | "flat" = m6 > 3 && last(dc) > sma200 ? "up" : m6 < -3 && last(dc) < sma200 ? "down" : "flat";
  const dFrame: "up" | "down" | "flat" = d20 > d50 && last(dc) > d50 ? "up" : d20 < d50 && last(dc) < d50 ? "down" : "flat";

  const reasons: Reason[] = [];
  let score = 30;
  const add = (points: number, text: string) => { score += points; reasons.push({ text, points }); };

  if (price > e50) add(8, `Price is above its ${cfg.m}-${unit} average`); else add(-10, `Price is below its ${cfg.m}-${unit} average`);
  if (e20 > e50) add(8, `${cfg.f}-${unit} average is above the ${cfg.m}-${unit} (uptrend)`); else add(-8, `${cfg.f}-${unit} average is below the ${cfg.m}-${unit}`);
  if (e50 > e200) add(6, `${cfg.m}-${unit} average is above the ${cfg.s}-${unit} (longer-term uptrend)`); else add(-6, `${cfg.m}-${unit} average is below the ${cfg.s}-${unit}`);
  if (st > 0) add(7, `Supertrend is bullish on ${frame} candles`); else add(-7, `Supertrend is bearish on ${frame} candles`);
  if (frame !== "weekly") { if (wFrame === "up") add(8, "Weekly trend is up"); else if (wFrame === "down") add(-8, "Weekly trend is down"); }
  else if (dFrame === "up") add(8, "Daily trend agrees (up)"); else if (dFrame === "down") add(-8, "Daily trend is down");
  if (frame !== "monthly") { if (mFrame === "up") add(5, "Six-month trend is up"); else if (mFrame === "down") add(-5, "Six-month trend is down"); }
  if (r >= 50 && r <= 68) add(6, `RSI ${r.toFixed(0)}: healthy momentum, not stretched`);
  else if (r > 75) add(-8, `RSI ${r.toFixed(0)}: overbought, a pullback is likely`);
  else if (r < 40) add(-5, `RSI ${r.toFixed(0)}: weak momentum`);
  const ext = ((price - e20) / e20) * 100;
  if (ext > cfg.ext) add(-8, `Price is ${ext.toFixed(0)}% above its ${cfg.f}-${unit} average: chasing risk`);
  const m1 = pctChange(daily, 21);
  if (m1 > 4 && m1 < 25) add(4, `Up ${m1.toFixed(0)}% in a month`);

  const technical = Math.max(0, Math.min(100, Math.round(score)));
  const sw = swingLevels(candles, frame === "daily" ? 5 : 3);

  let plan: Plan | null = null;
  if (Number.isFinite(a) && a > 0) {
    const nearTrend = ext <= (frame === "daily" ? 3 : frame === "weekly" ? 5 : 8);
    const entry = nearTrend ? price : Math.max(e20, price * (frame === "daily" ? 0.97 : 0.95));
    const swingLow = Math.min(...candles.slice(-cfg.stopBars).map((c) => c.low));
    let stop = Math.min(swingLow * 0.995, entry - 1.2 * a);
    stop = Math.max(stop, entry - 3 * a); // never wider than 3 ATR
    if (stop < entry) {
      const risk = entry - stop;
      const resistance = sw.resistance[n];
      const target1 = Number.isFinite(resistance) && resistance > entry + 2 * risk ? resistance * 0.995 : entry + 2 * risk;
      const target2 = Math.max(entry * cfg.t2, target1 * 1.02);
      plan = {
        entry, entryKind: nearTrend ? "now" : "pullback", stop, target1, target2,
        riskPct: (risk / entry) * 100, rewardPct1: ((target1 - entry) / entry) * 100, rr1: (target1 - entry) / risk, rr2: (target2 - entry) / risk,
      };
    }
  }

  return {
    symbol, price: last(daily).close, technical, score: technical, verdict: verdictOf(technical, plan),
    frames: { daily: dFrame, weekly: wFrame, monthly: mFrame },
    ret: { w1: pctChange(daily, 5), m1, m3: pctChange(daily, 63), m6 },
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
