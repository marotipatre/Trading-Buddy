import { sma } from "./sma";

export interface BollingerResult { mid: number[]; upper: number[]; lower: number[] }

export function bollinger(closes: number[], period = 20, mult = 2): BollingerResult {
  const mid = sma(closes, period);
  const upper = new Array<number>(closes.length).fill(NaN);
  const lower = new Array<number>(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) v += (closes[j] - mid[i]) ** 2;
    const sd = Math.sqrt(v / period); // population std dev, as in most charting tools
    upper[i] = mid[i] + mult * sd;
    lower[i] = mid[i] - mult * sd;
  }
  return { mid, upper, lower };
}
