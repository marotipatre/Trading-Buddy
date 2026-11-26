import type { Candle } from "@/lib/data/types";
import { sma } from "@/lib/engine/indicators";

export type Regime = "bull" | "bear" | "sideways";
export interface MarketRegime {
  regime: Regime;
  /** Short name for display: Uptrend, Downtrend, Recovering, Weakening or Choppy. */
  label: string;
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
  if (vs200 > band && s50 > s200) return { regime: "bull", label: "Uptrend", vs200, trend, sizeFactor: 1, advice: "Healthy market: normal position size, favour breakouts and trend continuation." };
  if (vs200 < -band && s50 < s200) return { regime: "bear", label: "Downtrend", vs200, trend, sizeFactor: 0.4, advice: "Market in a downtrend: cut position size sharply, take only the best setups, keep more cash." };
  if (vs200 > band) return { regime: "sideways", label: "Recovering", vs200, trend, sizeFactor: 0.7, advice: "Early recovery: the index is back above its 200-day average but the 50-day has not crossed yet. Build positions gradually (about 70% size) and favour clear leaders." };
  if (vs200 < -band) return { regime: "sideways", label: "Weakening", vs200, trend, sizeFactor: 0.5, advice: "Weakening: the index is below its 200-day average but the trend is not confirmed down. Trade at about half size and keep stops tight." };
  return { regime: "sideways", label: "Choppy", vs200, trend, sizeFactor: 0.6, advice: "Choppy market: halve size, prefer pullbacks and quick profits, expect false breakouts." };
}
