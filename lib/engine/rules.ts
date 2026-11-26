import type { Candle } from "@/lib/data/types";
import * as ind from "./indicators";
import type { Condition, ConditionGroup, Operand } from "./strategy";

type IndicatorOperand = Extract<Operand, { kind: "indicator" }>;

/** Computes each distinct indicator once per run; `shift` is applied at lookup. */
export class SeriesCache {
  private cache = new Map<string, number[]>();
  private fields: Record<string, number[]>;

  constructor(readonly candles: Candle[]) {
    this.fields = {
      open: candles.map((c) => c.open),
      high: candles.map((c) => c.high),
      low: candles.map((c) => c.low),
      close: candles.map((c) => c.close),
      volume: candles.map((c) => c.volume),
    };
  }

  private indicator(op: IndicatorOperand): number[] {
    const period = op.period;
    const key = [op.name, period, op.mult, op.fast, op.slow, op.signal].join("|");
    const hit = this.cache.get(key);
    if (hit) return hit;
    const { close, high, low, volume } = this.fields;
    let out: number[];
    switch (op.name) {
      case "sma": out = ind.sma(close, period ?? 20); break;
      case "ema": out = ind.ema(close, period ?? 20); break;
      case "rsi": out = ind.rsi(close, period ?? 14); break;
      case "atr": out = ind.atr(this.candles, period ?? 14); break;
      case "volume_sma": out = ind.sma(volume, period ?? 20); break;
      case "macd": out = ind.macd(close, op.fast ?? 12, op.slow ?? 26, op.signal ?? 9).macd; break;
      case "macd_signal": out = ind.macd(close, op.fast ?? 12, op.slow ?? 26, op.signal ?? 9).signal; break;
      case "macd_hist": out = ind.macd(close, op.fast ?? 12, op.slow ?? 26, op.signal ?? 9).hist; break;
      case "bb_upper": out = ind.bollinger(close, period ?? 20, op.mult ?? 2).upper; break;
      case "bb_mid": out = ind.bollinger(close, period ?? 20, op.mult ?? 2).mid; break;
      case "bb_lower": out = ind.bollinger(close, period ?? 20, op.mult ?? 2).lower; break;
      case "donchian_upper": out = ind.donchian(high, low, period ?? 20).upper; break;
      case "donchian_lower": out = ind.donchian(high, low, period ?? 20).lower; break;
      case "supertrend": out = ind.supertrend(this.candles, period ?? 10, op.mult ?? 3).line; break;
      case "supertrend_dir": out = ind.supertrend(this.candles, period ?? 10, op.mult ?? 3).direction; break;
    }
    this.cache.set(key, out);
    return out;
  }

  /** Value of an operand as seen at bar `i`. Never reads beyond bar i. NaN if unavailable. */
  value(op: Operand, i: number): number {
    if (op.kind === "number") return op.value;
    const j = i - op.shift;
    if (j < 0 || j >= this.candles.length) return NaN;
    return op.kind === "price" ? this.fields[op.field][j] : this.indicator(op)[j];
  }
}

export function evalCondition(cache: SeriesCache, cond: Condition, i: number): boolean {
  const l = cache.value(cond.left, i);
  const r = cache.value(cond.right, i);
  if (Number.isNaN(l) || Number.isNaN(r)) return false;
  switch (cond.op) {
    case ">": return l > r;
    case "<": return l < r;
    case ">=": return l >= r;
    case "<=": return l <= r;
    case "crosses_above":
    case "crosses_below": {
      const pl = cache.value(cond.left, i - 1);
      const pr = cache.value(cond.right, i - 1);
      if (Number.isNaN(pl) || Number.isNaN(pr)) return false;
      return cond.op === "crosses_above" ? pl <= pr && l > r : pl >= pr && l < r;
    }
  }
}

/** signal[i] is true when the group holds at the CLOSE of bar i. */
export function buildSignals(cache: SeriesCache, group: ConditionGroup): boolean[] {
  const n = cache.candles.length;
  const out = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    out[i] =
      group.logic === "all"
        ? group.conditions.every((c) => evalCondition(cache, c, i))
        : group.conditions.some((c) => evalCondition(cache, c, i));
  }
  return out;
}
