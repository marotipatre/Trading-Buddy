import type { Candle } from "@/lib/data/types";
import { ema, rsi, sma } from "@/lib/engine/indicators";
import { assessStock, verdictOf, type Frame, type Reason, type StockView } from "./stock-view";

/**
 * Published, widely used stock-picking ideas, each reduced to rules a computer can check on price data alone.
 * They are screens: they tell you what fits the idea today, not that it will make money. Fundamentals-based
 * methods (value, quality, earnings growth) need data this app does not have and are not included.
 */
export type Method = "trend" | "minervini" | "momentum" | "pullback";
export const METHODS: { id: Method; label: string; blurb: string; source: string }[] = [
  { id: "trend", label: "Trend + strength (default)", blurb: "Averages, Supertrend, RSI and how the stock ranks against the others scanned.", source: "Classic trend following" },
  { id: "minervini", label: "Minervini trend template", blurb: "Eight checks for a stock in a confirmed stage-2 uptrend, near its 52-week high with strong relative performance.", source: "Mark Minervini, Trade Like a Stock Market Wizard" },
  { id: "momentum", label: "Momentum (12-1 month)", blurb: "Ranks by the last 12 months' return, skipping the most recent month, per unit of volatility. The idea behind the NSE's Nifty200 Momentum 30 index.", source: "Jegadeesh & Titman momentum; NSE strategy index" },
  { id: "pullback", label: "Pullback in an uptrend", blurb: "A long-term uptrend that has dipped (RSI cooled) to its 20-day or 50-day average: a cheaper entry in a strong stock.", source: "Connors-style RSI pullback" },
];

const last = <T,>(a: T[]) => a[a.length - 1];
const pt = (pass: boolean, w: number, ok: string, bad: string): Reason => ({ text: pass ? ok : bad, points: pass ? w : -Math.round(w / 2) });

function baseView(symbol: string, daily: Candle[]): StockView | null { return assessStock(symbol, daily, "daily"); }

function finish(v: StockView, score: number, reasons: Reason[]): StockView {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return { ...v, technical: s, score: s, reasons, verdict: verdictOf(s, v.plan) };
}

export function assessMethod(symbol: string, daily: Candle[], method: Method, frame: Frame = "daily"): StockView | null {
  if (method === "trend") return assessStock(symbol, daily, frame);
  const v = baseView(symbol, daily);
  if (!v || daily.length < 260) return null;
  const closes = daily.map((c) => c.close);
  const n = closes.length - 1;
  const price = closes[n];
  const s50 = sma(closes, 50)[n], s150 = sma(closes, 150)[n], s200 = sma(closes, 200)[n], s200ago = sma(closes, 200)[n - 21];
  const year = daily.slice(-252);
  const hi = Math.max(...year.map((c) => c.high)), lo = Math.min(...year.map((c) => c.low));

  if (method === "minervini") {
    const checks: [boolean, string, string][] = [
      [price > s150 && price > s200, "Price is above the 150-day and 200-day averages", "Price is not above both the 150-day and 200-day averages"],
      [s150 > s200, "150-day average is above the 200-day", "150-day average is below the 200-day"],
      [s200 > s200ago, "200-day average has been rising for a month", "200-day average is not rising"],
      [s50 > s150 && s50 > s200, "50-day average is above the 150-day and 200-day", "50-day average is not above both longer averages"],
      [price > s50, "Price is above the 50-day average", "Price is below the 50-day average"],
      [price >= lo * 1.25, `Price is ${((price / lo - 1) * 100).toFixed(0)}% above its 52-week low (needs 25%+)`, `Price is only ${((price / lo - 1) * 100).toFixed(0)}% above its 52-week low (needs 25%+)`],
      [price >= hi * 0.75, `Price is ${((1 - price / hi) * 100).toFixed(0)}% below its 52-week high (within 25%)`, `Price is ${((1 - price / hi) * 100).toFixed(0)}% below its 52-week high (needs within 25%)`],
      [v.ret.m6 >= 15 && v.ret.m3 > 0, `Strong relative performance: ${v.ret.m6.toFixed(0)}% in six months`, `Six-month return ${Number.isFinite(v.ret.m6) ? v.ret.m6.toFixed(0) : "?"}% is not strong enough`],
    ];
    const reasons = checks.map(([ok, y, no]) => pt(ok, 12, y, no));
    const passed = checks.filter((c) => c[0]).length;
    reasons.unshift({ text: `${passed} of 8 template checks pass`, points: 0 });
    return finish(v, (passed / 8) * 100 - (passed < 7 ? 5 : 0), reasons);
  }

  if (method === "momentum") {
    const back = (k: number) => closes[n - k];
    const m12 = n >= 252 ? back(21) / back(252) - 1 : NaN;
    const rets = closes.slice(-253).map((c, i, a) => (i ? c / a[i - 1] - 1 : 0)).slice(1);
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
    const vol = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / rets.length) * Math.sqrt(252);
    const mom = Number.isFinite(m12) && vol > 0 ? m12 / vol : NaN;
    if (!Number.isFinite(mom)) return null;
    const score = 50 + mom * 28; // about 1.0 risk-adjusted momentum maps to ~78
    const reasons: Reason[] = [
      { text: `12-month return skipping the last month: ${(m12 * 100).toFixed(0)}% on ${(vol * 100).toFixed(0)}% yearly volatility = momentum ${mom.toFixed(2)}`, points: Math.round(mom * 28) },
      pt(price > s200, 8, "Price is above its 200-day average (momentum names above it fail less often)", "Price is below its 200-day average"),
    ];
    return finish(v, score + (price > s200 ? 8 : -8), reasons);
  }

  // pullback
  const r = rsi(closes, 14)[n];
  const e20 = ema(closes, 20)[n], e50 = ema(closes, 50)[n];
  const dip = r >= 28 && r <= 48;
  const atAvg = price <= e20 * 1.005 && price >= e50 * 0.97;
  const reasons: Reason[] = [
    pt(price > s200 && s50 > s200, 20, "Long-term uptrend: above the 200-day and 50-day above 200-day", "Not in a long-term uptrend"),
    pt(dip, 30, `RSI ${r.toFixed(0)}: cooled off (28–48), a dip rather than a collapse`, `RSI ${r.toFixed(0)}: not in the 28–48 dip zone`),
    pt(atAvg, 30, "Price has pulled back to its 20-day average, still above the 50-day", "Price is not at its 20/50-day average"),
    pt(v.ret.m6 > 5, 10, `Up ${v.ret.m6.toFixed(0)}% in six months: a leader`, "Not a six-month leader"),
  ];
  return finish(v, 10 + reasons.reduce((s, x) => s + Math.max(0, x.points), 0), reasons);
}
void last;
