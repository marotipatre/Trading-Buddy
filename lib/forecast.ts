/** Summarise several sampled price paths into a median path and a 10-90% band. */
export interface ForecastSummary {
  median: number[];
  p10: number[];
  p90: number[];
  /** Share of sampled paths that end above the last close. */
  upShare: number;
  endMedianPct: number;
  samples: number;
}

const q = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];

export function summarizePaths(paths: number[][], lastClose: number): ForecastSummary | null {
  const valid = paths.filter((p) => p.length > 0 && p.every(Number.isFinite));
  if (!valid.length || !(lastClose > 0)) return null;
  const len = Math.min(...valid.map((p) => p.length));
  const median: number[] = [], p10: number[] = [], p90: number[] = [];
  for (let i = 0; i < len; i++) {
    const col = valid.map((p) => p[i]).sort((a, b) => a - b);
    median.push(q(col, 0.5)); p10.push(q(col, 0.1)); p90.push(q(col, 0.9));
  }
  const ends = valid.map((p) => p[len - 1]);
  return { median, p10, p90, upShare: ends.filter((e) => e > lastClose).length / ends.length, endMedianPct: (median[len - 1] / lastClose - 1) * 100, samples: valid.length };
}
