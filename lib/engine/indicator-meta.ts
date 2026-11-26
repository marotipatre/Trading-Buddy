import { IndicatorName, type Operand } from "./strategy";

type ParamKey = "period" | "mult" | "fast" | "slow" | "signal";
export interface ParamSpec { key: ParamKey; label: string; default: number; min: number; step?: number }
export interface IndicatorMeta { name: IndicatorName; label: string; group: string; params: ParamSpec[] }

const period = (d: number): ParamSpec => ({ key: "period", label: "Period", default: d, min: 1 });
const mult = (d: number): ParamSpec => ({ key: "mult", label: "Multiplier", default: d, min: 0.1, step: 0.1 });
const macdParams: ParamSpec[] = [
  { key: "fast", label: "Fast", default: 12, min: 1 },
  { key: "slow", label: "Slow", default: 26, min: 2 },
  { key: "signal", label: "Signal", default: 9, min: 1 },
];

export const INDICATORS: IndicatorMeta[] = [
  { name: "sma", label: "SMA", group: "Trend", params: [period(20)] },
  { name: "ema", label: "EMA", group: "Trend", params: [period(20)] },
  { name: "supertrend", label: "Supertrend line", group: "Trend", params: [period(10), mult(3)] },
  { name: "supertrend_dir", label: "Supertrend direction (+1/-1)", group: "Trend", params: [period(10), mult(3)] },
  { name: "rsi", label: "RSI", group: "Momentum", params: [period(14)] },
  { name: "macd", label: "MACD line", group: "Momentum", params: macdParams },
  { name: "macd_signal", label: "MACD signal", group: "Momentum", params: macdParams },
  { name: "macd_hist", label: "MACD histogram", group: "Momentum", params: macdParams },
  { name: "atr", label: "ATR", group: "Volatility", params: [period(14)] },
  { name: "bb_upper", label: "Bollinger upper", group: "Volatility", params: [period(20), mult(2)] },
  { name: "bb_mid", label: "Bollinger middle", group: "Volatility", params: [period(20), mult(2)] },
  { name: "bb_lower", label: "Bollinger lower", group: "Volatility", params: [period(20), mult(2)] },
  { name: "donchian_upper", label: "Donchian high", group: "Volatility", params: [period(20)] },
  { name: "donchian_lower", label: "Donchian low", group: "Volatility", params: [period(20)] },
  { name: "volume_sma", label: "Volume SMA", group: "Volume", params: [period(20)] },
  { name: "support", label: "Support (nearest swing low below)", group: "Levels", params: [{ key: "period", label: "Pivot strength", default: 5, min: 2 }] },
  { name: "resistance", label: "Resistance (nearest swing high above)", group: "Levels", params: [{ key: "period", label: "Pivot strength", default: 5, min: 2 }] },
  { name: "trend_support", label: "Rising trendline (through last 2 swing lows)", group: "Levels", params: [{ key: "period", label: "Pivot strength", default: 5, min: 2 }] },
  { name: "trend_resistance", label: "Falling trendline (through last 2 swing highs)", group: "Levels", params: [{ key: "period", label: "Pivot strength", default: 5, min: 2 }] },
];

export const indicatorMeta = (name: IndicatorName) => INDICATORS.find((i) => i.name === name)!;

type IndicatorOperand = Extract<Operand, { kind: "indicator" }>;

/** A new indicator operand with every parameter set to its default. */
export function defaultIndicator(name: IndicatorName): IndicatorOperand {
  const op: IndicatorOperand = { kind: "indicator", name, shift: 0 };
  for (const p of indicatorMeta(name).params) op[p.key] = p.default;
  return op;
}

export function describeOperand(op: Operand): string {
  if (op.kind === "number") return String(op.value);
  const shift = op.shift ? ` [${op.shift} bar${op.shift > 1 ? "s" : ""} ago]` : "";
  const off = op.pct ? ` ${op.pct > 0 ? "+" : ""}${op.pct}%` : "";
  if (op.kind === "price") return `${op.field}${off}${shift}`;
  const meta = indicatorMeta(op.name);
  const args = meta.params.map((p) => op[p.key] ?? p.default).join(",");
  return `${meta.label}(${args})${off}${shift}`;
}
