import type { Candle } from "@/lib/data/types";

const IST = 19800;

export const istDay = (sec: number) => Math.floor((sec + IST) / 86400);

/** Keep only the most recent trading day's bars (for the 1D view). */
export function lastSessionOf(candles: Candle[]): Candle[] {
  if (!candles.length) return [];
  const day = istDay(candles.at(-1)!.time);
  return candles.filter((c) => istDay(c.time) === day);
}

/**
 * Chart time for a bar. Intraday bars are shifted by +5:30 so the axis reads in IST (the chart library
 * shows UTC). Daily bars are stamped 09:15 IST = 03:45 UTC, which is already the right calendar date.
 */
export const toChartTime = (sec: number, intraday: boolean) => (intraday ? sec + IST : sec);

/** Latest bar time at or before `t` (markers must sit on a bar). Returns null if `t` is before the first bar. */
export function snapToBar(times: number[], t: number): number | null {
  let lo = 0, hi = times.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 ? times[ans] : null;
}

/** Strictly ascending, de-duplicated bars (the chart library throws otherwise). */
export function cleanBars(candles: Candle[]): Candle[] {
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const out: Candle[] = [];
  for (const c of sorted) {
    if (out.length && out[out.length - 1].time === c.time) out[out.length - 1] = c;
    else out.push(c);
  }
  return out;
}

export interface PriceMove { change: number; changePct: number }

/** Change from the first to the last bar in view, for the header next to the chart. */
export function moveOver(candles: Candle[]): PriceMove | null {
  if (candles.length < 2) return null;
  const a = candles[0].open;
  const b = candles.at(-1)!.close;
  return { change: b - a, changePct: a ? ((b - a) / a) * 100 : 0 };
}
