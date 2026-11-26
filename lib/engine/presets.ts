import { StrategyDef } from "./strategy";

const price = (field: "open" | "high" | "low" | "close" | "volume", shift = 0) => ({ kind: "price" as const, field, shift });
const ind = (name: string, o: Record<string, number> = {}, shift = 0) => ({ kind: "indicator" as const, name, shift, ...o });
const num = (value: number) => ({ kind: "number" as const, value });

type Raw = Record<string, unknown>;
export interface Preset { id: string; label: string; description: string; strategy: StrategyDef }

function preset(id: string, label: string, description: string, raw: Raw): Preset {
  return { id, label, description, strategy: StrategyDef.parse({ name: label, product: "delivery", direction: "long", ...raw }) };
}

export const PRESETS: Preset[] = [
  preset("ema-cross", "EMA 20/50 trend", "Buy when the 20 EMA crosses above the 50 EMA; exit on the reverse cross.", {
    entry: { conditions: [{ left: ind("ema", { period: 20 }), op: "crosses_above", right: ind("ema", { period: 50 }) }] },
    exit: { conditions: [{ left: ind("ema", { period: 20 }), op: "crosses_below", right: ind("ema", { period: 50 }) }] },
    stopLoss: { type: "percent", value: 6 },
    maxHoldBars: 30,
  }),
  preset("rsi-pullback", "RSI pullback in uptrend", "Buy oversold dips (RSI < 35) while price is above the 200 SMA; exit when RSI recovers above 55.", {
    entry: { conditions: [
      { left: ind("rsi", { period: 14 }), op: "<", right: num(35) },
      { left: price("close"), op: ">", right: ind("sma", { period: 200 }) },
    ] },
    exit: { conditions: [{ left: ind("rsi", { period: 14 }), op: ">", right: num(55) }] },
    stopLoss: { type: "percent", value: 6 },
    maxHoldBars: 15,
  }),
  preset("donchian-breakout", "20-day breakout", "Buy a close above the prior 20-day high; exit below the prior 10-day low; trailing ATR stop.", {
    entry: { conditions: [{ left: price("close"), op: "crosses_above", right: ind("donchian_upper", { period: 20 }, 1) }] },
    exit: { conditions: [{ left: price("close"), op: "<", right: ind("donchian_lower", { period: 10 }, 1) }] },
    stopLoss: { type: "atr", value: 2.5, trailing: true },
    maxHoldBars: 40,
  }),
  preset("bb-reversion", "Bollinger mean reversion", "Buy closes below the lower band in an uptrend; exit at the middle band.", {
    entry: { conditions: [
      { left: price("close"), op: "<", right: ind("bb_lower", { period: 20, mult: 2 }) },
      { left: price("close"), op: ">", right: ind("sma", { period: 200 }) },
    ] },
    exit: { conditions: [{ left: price("close"), op: ">", right: ind("bb_mid", { period: 20 }) }] },
    stopLoss: { type: "percent", value: 5 },
    maxHoldBars: 10,
  }),
  preset("macd-trend", "MACD + trend filter", "Buy MACD crossing above its signal while price is above the 50 EMA.", {
    entry: { conditions: [
      { left: ind("macd"), op: "crosses_above", right: ind("macd_signal") },
      { left: price("close"), op: ">", right: ind("ema", { period: 50 }) },
    ] },
    exit: { conditions: [{ left: ind("macd"), op: "crosses_below", right: ind("macd_signal") }] },
    stopLoss: { type: "percent", value: 5 },
    target: { type: "rr", value: 2 },
    maxHoldBars: 15,
  }),
  preset("supertrend-flip", "Supertrend flip", "Buy when Supertrend turns bullish; exit when it turns bearish.", {
    entry: { conditions: [{ left: ind("supertrend_dir", { period: 10, mult: 3 }), op: "crosses_above", right: num(0) }] },
    exit: { conditions: [{ left: ind("supertrend_dir", { period: 10, mult: 3 }), op: "crosses_below", right: num(0) }] },
    stopLoss: { type: "atr", value: 3 },
    maxHoldBars: 40,
  }),
];

export const getPreset = (id: string) => PRESETS.find((p) => p.id === id);
