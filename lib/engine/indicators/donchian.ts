export function rollingMax(values: number[], period: number): number[] {
  return rolling(values, period, Math.max);
}
export function rollingMin(values: number[], period: number): number[] {
  return rolling(values, period, Math.min);
}

function rolling(values: number[], period: number, fn: (...n: number[]) => number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    out[i] = fn(...values.slice(i - period + 1, i + 1));
  }
  return out;
}

/** Donchian channel over `period` bars (includes the current bar). */
export function donchian(high: number[], low: number[], period = 20) {
  const upper = rollingMax(high, period);
  const lower = rollingMin(low, period);
  return { upper, lower, mid: upper.map((u, i) => (u + lower[i]) / 2) };
}
