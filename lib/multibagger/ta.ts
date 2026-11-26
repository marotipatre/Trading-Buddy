import type { Candle } from "@/lib/data/types";
import type { FaScore } from "./fa";

export interface Ta {
  score: number; reasons: string[]; flags: string[];
  ret6m: number | null; ret12m: number | null; fromHighPct: number; maxDd1y: number;
  stage2: boolean; volTrend: number | null; avgTurnoverCr: number;
}
const sma = (c: number[], n: number, end = c.length) => (end >= n ? c.slice(end - n, end).reduce((s, v) => s + v, 0) / n : NaN);
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/**
 * Technical health of a small stock from daily candles. The pattern that precedes most big winners is a "stage 2" uptrend:
 * price above a rising 150-day (about 30-week) average, which is above the 200-day, and near its high with volume
 * picking up. Thin trading, wild falls and stocks far below their highs are flagged.
 */
export function analyseTa(candles: Candle[]): Ta | null {
  const n = candles.length;
  if (n < 160) return null;
  const close = candles.map((c) => c.close), price = close[n - 1];
  const s50 = sma(close, 50), s150 = sma(close, 150), s200 = n >= 200 ? sma(close, 200) : NaN, s150ago = sma(close, 150, n - 20);
  const hi = Math.max(...candles.slice(-252).map((c) => c.high)), lo = Math.min(...candles.slice(-252).map((c) => c.low));
  const fromHighPct = (1 - price / hi) * 100;
  const ret = (k: number) => (n > k ? (price / close[n - 1 - k] - 1) * 100 : null);
  const ret6m = ret(126), ret12m = ret(252);
  let peak = 0, maxDd1y = 0;
  for (const c of candles.slice(-252)) { peak = Math.max(peak, c.close); maxDd1y = Math.max(maxDd1y, (1 - c.close / peak) * 100); }
  const v20 = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20, v100 = candles.slice(-100).reduce((s, c) => s + c.volume, 0) / 100;
  const volTrend = v100 > 0 ? v20 / v100 : null;
  const avgTurnoverCr = (candles.slice(-20).reduce((s, c) => s + c.close * c.volume, 0) / 20) / 1e7;
  const stage2 = price > s150 && s150 > s150ago && (Number.isNaN(s200) || s150 > s200) && price > s50;

  const reasons: string[] = [], flags: string[] = [];
  let score = 0;
  if (stage2) { score += 32; reasons.push("In a stage 2 uptrend (above a rising 30-week average)"); }
  else if (price > s150) score += 12;
  score += clamp(25 - fromHighPct, 0, 25); // up to 25 points for being near the high
  if (fromHighPct <= 10) reasons.push(`Only ${fromHighPct.toFixed(0)}% below its 1-year high`);
  if (ret6m !== null) { score += clamp(ret6m / 2, -10, 18); if (ret6m >= 30) reasons.push(`Up ${ret6m.toFixed(0)}% in 6 months`); }
  if (volTrend !== null && volTrend >= 1.15) { score += 10; reasons.push("Trading volume rising against its 100-day norm"); }
  if (price >= lo * 1.5) score += 8;
  score += clamp(7 - maxDd1y / 8, 0, 7);
  if (avgTurnoverCr < 0.25) { flags.push(`Thinly traded (about ₹${(avgTurnoverCr * 100).toFixed(0)} lakh a day): hard to exit`); score -= 15; }
  if (maxDd1y > 45) { flags.push(`Fell ${maxDd1y.toFixed(0)}% from peak within the year`); score -= 6; }
  if (fromHighPct > 40) { flags.push(`${fromHighPct.toFixed(0)}% below its high: not in an uptrend`); score -= 10; }
  if (ret6m !== null && ret6m > 150) flags.push(`Already up ${ret6m.toFixed(0)}% in 6 months: a late entry is risky`);
  return { score: Math.round(clamp(score)), reasons, flags, ret6m, ret12m, fromHighPct, maxDd1y, stage2, volTrend, avgTurnoverCr };
}

export type Call = "strong" | "watch" | "avoid" | "pending";
/** Combine the two scores. Both must be decent: great fundamentals in a broken chart, or a hot chart on weak numbers, is not a candidate. */
export function combine(fa: FaScore | null, ta: Ta): { score: number | null; call: Call } {
  if (!fa) return { score: null, call: "pending" };
  const score = Math.round(fa.score * 0.55 + ta.score * 0.45);
  const redFlags = fa.flags.filter((f) => !f.startsWith("Too little")).length + ta.flags.length;
  const call: Call = fa.score >= 60 && ta.score >= 55 && redFlags <= 1 ? "strong" : fa.score >= 45 && ta.score >= 40 && redFlags <= 3 ? "watch" : "avoid";
  return { score, call };
}
