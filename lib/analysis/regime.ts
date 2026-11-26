import type { Candle } from "@/lib/data/types";
import { sma } from "@/lib/engine/indicators";

export type Regime = "bull" | "bear" | "sideways";
export interface MarketRegime {
  regime: Regime;
  /** Distance of the close from its 200-day average, percent. */
  vs200: number;
  /** 50-day average above (+) or below (-) the 200-day, percent. */
  trend: number;
  /** Plain-language guidance for position size and style. */
  advice: string;
  /** Suggested multiplier on normal position size. */
  sizeFactor: number;
}

/**
 * Market regime from an index's daily candles. Bull: close above a rising stack (50-day above 200-day) and more than 3%
 * above the 200-day. Bear: below, with the 50-day under the 200-day. Anything else is sideways. The same simple rule
 * set used by popular open-source NSE tools; it describes the past, it does not predict.
 */
export function marketRegime(index: Candle[], band = 3): MarketRegime | null {
  if (index.length < 210) return null;
  const closes = index.map((c) => c.close);
  const n = closes.length - 1;
  const s50 = sma(closes, 50)[n], s200 = sma(closes, 200)[n];
  if (!Number.isFinite(s50) || !Number.isFinite(s200)) return null;
  const vs200 = (closes[n] / s200 - 1) * 100;
  const trend = (s50 / s200 - 1) * 100;
  if (vs200 > band && s50 > s200) return { regime: "bull", vs200, trend, sizeFactor: 1, advice: "Healthy market: normal position size, favour breakouts and trend continuation." };
  if (vs200 < -band && s50 < s200) return { regime: "bear", vs200, trend, sizeFactor: 0.4, advice: "Market in a downtrend: cut position size sharply, take only the best setups, keep more cash." };
  return { regime: "sideways", vs200, trend, sizeFactor: 0.6, advice: "Choppy or transitioning market: halve size, prefer pullbacks and quick profits, expect false breakouts." };
}
