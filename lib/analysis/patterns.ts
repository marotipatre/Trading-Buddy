import type { Candle } from "@/lib/data/types";

export type PatternName = "hammer" | "shooting star" | "doji" | "bullish engulfing" | "bearish engulfing" | "morning star" | "evening star";
export interface Pattern { name: PatternName; bias: "bullish" | "bearish" | "neutral"; index: number }

const body = (c: Candle) => Math.abs(c.close - c.open);
const range = (c: Candle) => c.high - c.low;
const upper = (c: Candle) => c.high - Math.max(c.open, c.close);
const lower = (c: Candle) => Math.min(c.open, c.close) - c.low;
const bull = (c: Candle) => c.close > c.open;

/** Classic candlestick patterns at bar `i`, judged against the trend of the five bars before it. */
export function patternsAt(c: Candle[], i: number): Pattern[] {
  if (i < 6 || i >= c.length) return [];
  const k = c[i], p = c[i - 1], p2 = c[i - 2];
  const r = range(k);
  if (!(r > 0)) return [];
  const down = c[i - 1].close < c[i - 6].close; // falling into the bar
  const up = c[i - 1].close > c[i - 6].close;
  const out: Pattern[] = [];
  const add = (name: PatternName, bias: Pattern["bias"]) => out.push({ name, bias, index: i });
  if (body(k) <= r * 0.1) add("doji", "neutral");
  if (down && lower(k) >= 2 * body(k) && upper(k) <= body(k) * 0.5 + r * 0.05 && body(k) > r * 0.05) add("hammer", "bullish");
  if (up && upper(k) >= 2 * body(k) && lower(k) <= body(k) * 0.5 + r * 0.05 && body(k) > r * 0.05) add("shooting star", "bearish");
  if (down && !bull(p) && bull(k) && k.open <= p.close && k.close >= p.open && body(k) > body(p)) add("bullish engulfing", "bullish");
  if (up && bull(p) && !bull(k) && k.open >= p.close && k.close <= p.open && body(k) > body(p)) add("bearish engulfing", "bearish");
  if (down && !bull(p2) && body(p2) > range(p2) * 0.5 && body(p) < body(p2) * 0.4 && bull(k) && k.close > (p2.open + p2.close) / 2) add("morning star", "bullish");
  if (up && bull(p2) && body(p2) > range(p2) * 0.5 && body(p) < body(p2) * 0.4 && !bull(k) && k.close < (p2.open + p2.close) / 2) add("evening star", "bearish");
  return out;
}

/** Patterns on the most recent bar. */
export const latestPatterns = (c: Candle[]): Pattern[] => patternsAt(c, c.length - 1);
