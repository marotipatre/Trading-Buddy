import type { Candle } from "@/lib/data/types";
import { atr } from "./atr";

export interface SupertrendResult {
  line: number[];
  /** 1 = uptrend (line below price), -1 = downtrend */
  direction: number[];
}

export function supertrend(c: Candle[], period = 10, mult = 3): SupertrendResult {
  const a = atr(c, period);
  const n = c.length;
  const line = new Array<number>(n).fill(NaN);
  const direction = new Array<number>(n).fill(0);
  let finalUpper = NaN;
  let finalLower = NaN;
  let dir = 1;
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(a[i])) continue;
    const hl2 = (c[i].high + c[i].low) / 2;
    const basicUpper = hl2 + mult * a[i];
    const basicLower = hl2 - mult * a[i];
    const prevClose = i > 0 ? c[i - 1].close : c[i].close;
    finalUpper = Number.isNaN(finalUpper) || basicUpper < finalUpper || prevClose > finalUpper ? basicUpper : finalUpper;
    finalLower = Number.isNaN(finalLower) || basicLower > finalLower || prevClose < finalLower ? basicLower : finalLower;
    if (dir === 1 && c[i].close < finalLower) dir = -1;
    else if (dir === -1 && c[i].close > finalUpper) dir = 1;
    direction[i] = dir;
    line[i] = dir === 1 ? finalLower : finalUpper;
  }
  return { line, direction };
}
