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

PRESETS.push(
  preset("support-bounce", "Support bounce", "Buy when price dips to within 1% of the nearest swing-low support in an uptrend and closes back above it. Stop just under support, target just under the next resistance.", {
    entry: { conditions: [
      { left: price("close"), op: ">", right: ind("ema", { period: 50 }) },
      { left: price("low"), op: "<=", right: { ...ind("support", { period: 5 }), pct: 1 } },
      { left: price("close"), op: ">", right: ind("support", { period: 5 }) },
    ] },
    stopLoss: { type: "support", value: 1.5, period: 5 },
    target: { type: "resistance", value: 1 },
    maxHoldBars: 20,
  }),
  preset("trendline-bounce", "Trendline bounce", "Buy when price touches the rising trendline through the last two swing lows and closes back above it. Stop under the recent swing low, target at 2R.", {
    entry: { conditions: [
      { left: price("close"), op: ">", right: ind("ema", { period: 50 }) },
      { left: price("low"), op: "<=", right: { ...ind("trend_support", { period: 5 }), pct: 0.5 } },
      { left: price("close"), op: ">", right: ind("trend_support", { period: 5 }) },
    ] },
    stopLoss: { type: "swing_low", value: 1, period: 10 },
    target: { type: "rr", value: 2 },
    maxHoldBars: 20,
  }),
  preset("resistance-breakout", "Resistance breakout", "Buy a close above the last known swing-high resistance on above-average volume. Stop under support, target at 2.5R.", {
    entry: { conditions: [
      { left: price("close"), op: ">", right: ind("resistance", { period: 5 }, 1) },
      { left: price("volume"), op: ">", right: ind("volume_sma", { period: 20 }) },
    ] },
    stopLoss: { type: "support", value: 1.5, period: 5 },
    target: { type: "rr", value: 2.5 },
    maxHoldBars: 25,
  }),
);

PRESETS.push(
  preset("minervini-template", "Minervini trend template", "Buy a stock in a confirmed uptrend: above rising 150/200-day averages, 50-day above both, 25%+ above its 52-week low and within 25% of its high. 7% stop, 3R target. The same checks the Ideas page uses.", {
    entry: { conditions: [
      { left: price("close"), op: ">", right: ind("sma", { period: 150 }) },
      { left: price("close"), op: ">", right: ind("sma", { period: 200 }) },
      { left: ind("sma", { period: 150 }), op: ">", right: ind("sma", { period: 200 }) },
      { left: ind("sma", { period: 200 }), op: ">", right: ind("sma", { period: 200 }, 21) },
      { left: ind("sma", { period: 50 }), op: ">", right: ind("sma", { period: 150 }) },
      { left: price("close"), op: ">", right: ind("sma", { period: 50 }) },
      { left: price("close"), op: ">", right: { ...ind("donchian_lower", { period: 252 }), pct: 25 } },
      { left: price("close"), op: ">", right: { ...ind("donchian_upper", { period: 252 }), pct: -25 } },
    ] },
    stopLoss: { type: "percent", value: 7 },
    target: { type: "rr", value: 3 },
    maxHoldBars: 40,
  }),
  preset("pullback-uptrend", "Pullback in an uptrend", "Buy a dip in a long-term uptrend: above the 200-day with the 50-day above it, RSI cooled under 48, price back at its 20-day average but still above the 50-day. 5% stop, 2R target.", {
    entry: { conditions: [
      { left: price("close"), op: ">", right: ind("sma", { period: 200 }) },
      { left: ind("sma", { period: 50 }), op: ">", right: ind("sma", { period: 200 }) },
      { left: ind("rsi", { period: 14 }), op: "<", right: num(48) },
      { left: price("close"), op: "<=", right: { ...ind("ema", { period: 20 }), pct: 0.5 } },
      { left: price("close"), op: ">", right: { ...ind("ema", { period: 50 }), pct: -3 } },
    ] },
    stopLoss: { type: "percent", value: 5 },
    target: { type: "rr", value: 2 },
    maxHoldBars: 15,
  }),
  preset("momentum-filter", "Momentum (12-1) filter", "Buy a stock that has risen over the last year excluding the latest month, and is in an uptrend. Trailing 3-ATR stop, no fixed target. A one-stock version of the idea behind momentum indices.", {
    entry: { conditions: [
      { left: price("close", 21), op: ">", right: price("close", 250) },
      { left: price("close"), op: ">", right: ind("sma", { period: 200 }) },
      { left: ind("sma", { period: 50 }), op: ">", right: ind("sma", { period: 200 }) },
    ] },
    exit: { conditions: [{ left: price("close"), op: "<", right: ind("sma", { period: 100 }) }] },
    stopLoss: { type: "atr", value: 3, trailing: true },
    maxHoldBars: 60,
  }),
);

export const getPreset = (id: string) => PRESETS.find((p) => p.id === id);
