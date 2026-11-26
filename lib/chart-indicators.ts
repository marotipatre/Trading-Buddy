import type { Candle } from "@/lib/data/types";
import { bollinger, ema, rsi, sma, supertrend } from "@/lib/engine/indicators";

export type IndicatorKind = "ema" | "sma" | "bb" | "supertrend" | "rsi";
export interface IndicatorSpec { id: string; kind: IndicatorKind; period: number; mult?: number }
export interface Pt { time: number; value: number; color?: string }
export interface IndicatorLine { label: string; color: string; points: Pt[]; pane: number; levels?: number[]; dashed?: boolean }

export const INDICATOR_LABEL: Record<IndicatorKind, string> = { ema: "EMA", sma: "SMA", bb: "Bollinger Bands", supertrend: "Supertrend", rsi: "RSI" };
/** One-line explanations shown on hover, for people new to indicators. */
export const INDICATOR_HELP: Record<IndicatorKind, string> = {
  ema: "Exponential moving average: the average price over the last N bars, weighting recent bars more. Price above a rising EMA suggests an uptrend.",
  sma: "Simple moving average: the plain average of the last N closes. The 50 and 200 SMA are widely watched trend lines.",
  bb: "Bollinger Bands: an average with bands two standard deviations away. Price touching a band shows a stretched move, not a signal by itself.",
  supertrend: "Supertrend: a volatility-based trend line. Green below price means uptrend, red above price means downtrend; it flips when price closes through it.",
  rsi: "Relative Strength Index (0 to 100): above 70 is often called overbought, below 30 oversold. In strong trends it can stay extreme for a long time.",
};
export const PRESETS: IndicatorSpec[] = [
  { id: "ema9", kind: "ema", period: 9 }, { id: "ema20", kind: "ema", period: 20 }, { id: "ema50", kind: "ema", period: 50 },
  { id: "ema100", kind: "ema", period: 100 }, { id: "ema200", kind: "ema", period: 200 },
  { id: "sma50", kind: "sma", period: 50 }, { id: "sma200", kind: "sma", period: 200 },
  { id: "bb20", kind: "bb", period: 20, mult: 2 }, { id: "st10", kind: "supertrend", period: 10, mult: 3 }, { id: "rsi14", kind: "rsi", period: 14 },
];
const COLORS = ["#2563eb", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899", "#64748b", "#84cc16"];

export const specId = (kind: IndicatorKind, period: number, mult?: number) => `${kind}${period}${mult && kind === "supertrend" ? `x${mult}` : ""}`;
export const specLabel = (s: IndicatorSpec) =>
  s.kind === "bb" ? `BB ${s.period}, ${s.mult ?? 2}` : s.kind === "supertrend" ? `Supertrend ${s.period}, ${s.mult ?? 3}` : `${INDICATOR_LABEL[s.kind]} ${s.period}`;

const series = (candles: Candle[], v: number[], color?: (i: number) => string | undefined): Pt[] =>
  candles.flatMap((c, i) => (Number.isFinite(v[i]) ? [{ time: c.time, value: v[i], color: color?.(i) }] : []));

/** Lines for every active indicator, computed on whatever candles the chart shows (so they follow the timeframe). */
export function computeIndicators(candles: Candle[], specs: IndicatorSpec[]): IndicatorLine[] {
  const closes = candles.map((c) => c.close);
  const out: IndicatorLine[] = [];
  specs.forEach((s, n) => {
    const color = COLORS[n % COLORS.length];
    if (s.kind === "ema") out.push({ label: specLabel(s), color, pane: 0, points: series(candles, ema(closes, s.period)) });
    else if (s.kind === "sma") out.push({ label: specLabel(s), color, pane: 0, points: series(candles, sma(closes, s.period)) });
    else if (s.kind === "bb") {
      const b = bollinger(closes, s.period, s.mult ?? 2);
      out.push({ label: `${specLabel(s)} upper`, color, pane: 0, points: series(candles, b.upper), dashed: true });
      out.push({ label: `${specLabel(s)} mid`, color, pane: 0, points: series(candles, b.mid) });
      out.push({ label: `${specLabel(s)} lower`, color, pane: 0, points: series(candles, b.lower), dashed: true });
    } else if (s.kind === "supertrend") {
      const st = supertrend(candles, s.period, s.mult ?? 3);
      out.push({ label: specLabel(s), color: "#0f9d73", pane: 0, points: series(candles, st.line, (i) => (st.direction[i] >= 0 ? "#0f9d73" : "#e5484d")) });
    } else out.push({ label: specLabel(s), color, pane: 1, points: series(candles, rsi(closes, s.period)), levels: [30, 70] });
  });
  return out;
}

export function parseSpecs(raw: unknown): IndicatorSpec[] {
  if (!Array.isArray(raw)) return [];
  const kinds = new Set<string>(["ema", "sma", "bb", "supertrend", "rsi"]);
  return raw.flatMap((r) => {
    const o = r as Partial<IndicatorSpec>;
    if (!o || !kinds.has(String(o.kind)) || !Number.isInteger(o.period) || o.period! < 2 || o.period! > 500) return [];
    return [{ id: specId(o.kind!, o.period!, o.mult), kind: o.kind!, period: o.period!, ...(o.mult ? { mult: o.mult } : {}) }];
  }).slice(0, 10);
}
const KEY = "tb.chart.indicators";
export function loadSpecs(): IndicatorSpec[] { try { return parseSpecs(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { return []; } }
export function saveSpecs(s: IndicatorSpec[]) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }
