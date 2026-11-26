import { ema } from "./ema";

export interface MacdResult { macd: number[]; signal: number[]; hist: number[] }

export function macd(closes: number[], fast = 12, slow = 26, signalP = 9): MacdResult {
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line = closes.map((_, i) => (Number.isNaN(f[i]) || Number.isNaN(s[i]) ? NaN : f[i] - s[i]));
  const start = line.findIndex((v) => !Number.isNaN(v));
  const signal = new Array<number>(closes.length).fill(NaN);
  if (start >= 0) {
    const sig = ema(line.slice(start), signalP);
    sig.forEach((v, i) => (signal[start + i] = v));
  }
  const hist = line.map((v, i) => (Number.isNaN(v) || Number.isNaN(signal[i]) ? NaN : v - signal[i]));
  return { macd: line, signal, hist };
}
