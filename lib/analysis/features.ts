import type { Candle } from "@/lib/data/types";
import { ema, rsi, sma } from "@/lib/engine/indicators";

export interface Features {
  /** Percent below the 52-week high (0 = at the high). */
  offHighPct: number;
  /** Latest volume divided by its 20-day average. */
  volRatio: number;
  /** Closed above the highest high of the previous 20 sessions. */
  breakout20: boolean;
  /** Above the 200-day average with RSI cooled under 48 and price at or under the 20-day average: a dip in an uptrend. */
  pullback: boolean;
  /** Up at least 3 of the last 4 sessions on volume above average. */
  accumulation: boolean;
}

export type ScreenId = "high" | "volume" | "breakout" | "pullback" | "accumulation";
export const SCREENS: { id: ScreenId; label: string; hint: string }[] = [
  { id: "high", label: "Near 52-week high", hint: "Within 3% of the highest price of the last year" },
  { id: "volume", label: "Volume surge", hint: "Today's volume at least 1.8 times its 20-day average" },
  { id: "breakout", label: "Fresh breakout", hint: "Closed above the highest high of the previous 20 sessions" },
  { id: "pullback", label: "Pullback in uptrend", hint: "Above the 200-day average, RSI cooled under 48, back at the 20-day average" },
  { id: "accumulation", label: "Steady buying", hint: "Up on 3 of the last 4 sessions with above-average volume" },
];
export const matchesScreen = (f: Features | undefined, id: ScreenId): boolean =>
  !!f && (id === "high" ? f.offHighPct <= 3 : id === "volume" ? f.volRatio >= 1.8 : id === "breakout" ? f.breakout20 : id === "pullback" ? f.pullback : f.accumulation);

/** Quick facts that classic screeners filter on, from daily candles. Null without about a year of history. */
export function computeFeatures(c: Candle[]): Features | null {
  const n = c.length - 1;
  if (n < 210) return null;
  const closes = c.map((x) => x.close);
  const year = c.slice(-252);
  const hi = Math.max(...year.map((x) => x.high));
  const avgVol = c.slice(n - 20, n).reduce((s, x) => s + x.volume, 0) / 20;
  const prior20 = Math.max(...c.slice(n - 20, n).map((x) => x.high));
  const r = rsi(closes, 14)[n], e20 = ema(closes, 20)[n], s200 = sma(closes, 200)[n];
  const last4 = c.slice(n - 3, n + 1);
  const upDays = last4.filter((x, i) => (i === 0 ? x.close > c[n - 4].close : x.close > last4[i - 1].close)).length;
  return {
    offHighPct: ((hi - closes[n]) / hi) * 100,
    volRatio: avgVol > 0 ? c[n].volume / avgVol : 0,
    breakout20: closes[n] > prior20,
    pullback: closes[n] > s200 && r < 48 && closes[n] <= e20 * 1.005,
    accumulation: upDays >= 3 && last4.every((x) => x.volume >= avgVol * 0.9) && avgVol > 0,
  };
}
