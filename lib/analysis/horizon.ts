import type { Candle } from "@/lib/data/types";
import { sma } from "@/lib/engine/indicators";

export interface HorizonStats {
  /** Trading days in the holding window (calendar days x 5/7). */
  bars: number;
  samples: number;
  /** Share of start days where the target was reached inside the window before the stop. 0-1. */
  hitRate: number;
  stopRate: number;
  /** Neither target nor stop: closed out at the end of the window. */
  timeoutRate: number;
  /** Average result per trade if each one is exited at target, stop or the end of the window, in percent. */
  expectancyPct: number;
  medianPct: number;
  /** 10th percentile of the end-of-window return: a bad-but-not-worst outcome. */
  p10Pct: number;
  /** The same hit rate counting only start days when price was above its 50-day average. NaN if too few. */
  hitRateUptrend: number;
  samplesUptrend: number;
}

export const barsFor = (calendarDays: number) => Math.max(1, Math.round((calendarDays * 5) / 7));

/**
 * How this stock behaved in its own past: starting on each day with a buy at that close, a stop `stopPct` below and a
 * target `targetPct` above, held for `days` calendar days. If a bar touches both the stop and the target, the stop
 * is assumed to come first. It is history for this one stock, not a forecast.
 */
export function horizonStats(candles: Candle[], days: number, targetPct: number, stopPct: number, lookback = 750): HorizonStats | null {
  const bars = barsFor(days);
  const n = candles.length;
  const from = Math.max(50, n - lookback);
  if (n - bars - from < 60 || !(targetPct > 0) || !(stopPct > 0)) return null;
  const s50 = sma(candles.map((c) => c.close), 50);
  let hit = 0, stop = 0, timeout = 0, upN = 0, upHit = 0;
  const results: number[] = [], ends: number[] = [];
  for (let i = from; i + bars < n; i++) {
    const entry = candles[i].close;
    const tp = entry * (1 + targetPct / 100), sl = entry * (1 - stopPct / 100);
    let out: "hit" | "stop" | "time" = "time";
    for (let j = i + 1; j <= i + bars; j++) {
      if (candles[j].low <= sl) { out = "stop"; break; }
      if (candles[j].high >= tp) { out = "hit"; break; }
    }
    const end = (candles[i + bars].close / entry - 1) * 100;
    ends.push(end);
    results.push(out === "hit" ? targetPct : out === "stop" ? -stopPct : end);
    if (out === "hit") hit++; else if (out === "stop") stop++; else timeout++;
    if (Number.isFinite(s50[i]) && entry > s50[i]) { upN++; if (out === "hit") upHit++; }
  }
  const total = results.length;
  const sorted = [...ends].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    bars, samples: total, hitRate: hit / total, stopRate: stop / total, timeoutRate: timeout / total,
    expectancyPct: results.reduce((s, x) => s + x, 0) / total, medianPct: q(0.5), p10Pct: q(0.1),
    hitRateUptrend: upN >= 30 ? upHit / upN : NaN, samplesUptrend: upN,
  };
}
