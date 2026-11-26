import type { Candle } from "@/lib/data/types";

export function trueRange(c: Candle[]): number[] {
  return c.map((b, i) =>
    i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - c[i - 1].close), Math.abs(b.low - c[i - 1].close)),
  );
}

/** Wilder's average true range. */
export function atr(c: Candle[], period = 14): number[] {
  const tr = trueRange(c);
  const out = new Array<number>(c.length).fill(NaN);
  if (c.length < period) return out;
  let prev = 0;
  for (let i = 0; i < period; i++) prev += tr[i];
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < c.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}
