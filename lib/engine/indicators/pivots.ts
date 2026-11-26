import type { Candle } from "@/lib/data/types";

/**
 * Swing pivots and the support, resistance and trendline levels built from them.
 *
 * A pivot low at bar i has a lower low than the `strength` bars before it and no higher low than the `strength`
 * bars after it. That needs `strength` future bars, so a pivot is only KNOWN at bar i + strength: every level
 * below uses a pivot only from that bar on. Nothing here looks ahead.
 */

export function isPivotLow(low: number[], i: number, strength: number): boolean {
  if (i < strength || i + strength >= low.length) return false;
  for (let j = 1; j <= strength; j++) if (!(low[i] < low[i - j]) || !(low[i] <= low[i + j])) return false;
  return true;
}

export function isPivotHigh(high: number[], i: number, strength: number): boolean {
  if (i < strength || i + strength >= high.length) return false;
  for (let j = 1; j <= strength; j++) if (!(high[i] > high[i - j]) || !(high[i] >= high[i + j])) return false;
  return true;
}

export interface SwingLevels {
  /** Nearest recent swing low at or below the close. */
  support: number[];
  /** Nearest recent swing high at or above the close. */
  resistance: number[];
  /** Line through the last two swing lows, extended to this bar. */
  trendSupport: number[];
  /** Line through the last two swing highs, extended to this bar. */
  trendResistance: number[];
}

/** Most recent pivots to consider when looking for the nearest level. */
const RECENT = 8;

export function swingLevels(candles: Candle[], strength = 5): SwingLevels {
  const n = candles.length;
  const low = candles.map((c) => c.low);
  const high = candles.map((c) => c.high);
  const support = new Array<number>(n).fill(NaN);
  const resistance = new Array<number>(n).fill(NaN);
  const trendSupport = new Array<number>(n).fill(NaN);
  const trendResistance = new Array<number>(n).fill(NaN);
  const lows: number[] = []; // confirmed pivot-low bar indexes
  const highs: number[] = [];
  const minGap = Math.max(2, strength);

  for (let t = 0; t < n; t++) {
    const p = t - strength; // the pivot at bar p becomes known now
    if (p >= 0) {
      if (isPivotLow(low, p, strength)) lows.push(p);
      if (isPivotHigh(high, p, strength)) highs.push(p);
    }
    for (let k = lows.length - 1, seen = 0; k >= 0 && seen < RECENT; k--, seen++) {
      if (low[lows[k]] <= candles[t].close) { support[t] = low[lows[k]]; break; }
    }
    for (let k = highs.length - 1, seen = 0; k >= 0 && seen < RECENT; k--, seen++) {
      if (high[highs[k]] >= candles[t].close) { resistance[t] = high[highs[k]]; break; }
    }
    if (lows.length >= 2) {
      const a = lows[lows.length - 2], b = lows[lows.length - 1];
      if (b - a >= minGap) trendSupport[t] = low[b] + ((low[b] - low[a]) / (b - a)) * (t - b);
    }
    if (highs.length >= 2) {
      const a = highs[highs.length - 2], b = highs[highs.length - 1];
      if (b - a >= minGap) trendResistance[t] = high[b] + ((high[b] - high[a]) / (b - a)) * (t - b);
    }
  }
  return { support, resistance, trendSupport, trendResistance };
}

/** Lowest low of the last `n` bars including the current one (the "swing low" used for stop placement). */
export function lowestLow(candles: Candle[], n: number): number[] {
  return candles.map((_, i) => (i + 1 < n ? NaN : Math.min(...candles.slice(i - n + 1, i + 1).map((c) => c.low))));
}

export function highestHigh(candles: Candle[], n: number): number[] {
  return candles.map((_, i) => (i + 1 < n ? NaN : Math.max(...candles.slice(i - n + 1, i + 1).map((c) => c.high))));
}
