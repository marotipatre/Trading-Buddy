import { z } from "zod";

export const IndicatorName = z.enum([
  "sma", "ema", "rsi", "atr",
  "macd", "macd_signal", "macd_hist",
  "bb_upper", "bb_mid", "bb_lower",
  "donchian_upper", "donchian_lower",
  "supertrend", "supertrend_dir",
  "volume_sma",
  "support", "resistance", "trend_support", "trend_resistance",
]);
export type IndicatorName = z.infer<typeof IndicatorName>;

export const Operand = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("price"), field: z.enum(["open", "high", "low", "close", "volume"]), shift: z.number().int().min(0).max(250).default(0), pct: z.number().min(-50).max(50).optional() }),
  z.object({
    kind: z.literal("indicator"),
    name: IndicatorName,
    period: z.number().int().min(1).max(500).optional(),
    mult: z.number().positive().max(20).optional(),
    fast: z.number().int().min(1).max(200).optional(),
    slow: z.number().int().min(2).max(400).optional(),
    signal: z.number().int().min(1).max(100).optional(),
    shift: z.number().int().min(0).max(250).default(0),
    /** Move the value up (+) or down (-) by this percent, e.g. +1 on support = "1% above support". */
    pct: z.number().min(-50).max(50).optional(),
  }),
  z.object({ kind: z.literal("number"), value: z.number() }),
]);
export type Operand = z.infer<typeof Operand>;

export const Comparator = z.enum([">", "<", ">=", "<=", "crosses_above", "crosses_below"]);
export type Comparator = z.infer<typeof Comparator>;

export const Condition = z.object({ left: Operand, op: Comparator, right: Operand });
export type Condition = z.infer<typeof Condition>;

export const ConditionGroup = z.object({
  logic: z.enum(["all", "any"]).default("all"),
  conditions: z.array(Condition).min(1),
});
export type ConditionGroup = z.infer<typeof ConditionGroup>;

export const StopLoss = z.object({
  /** support / swing_low: place the stop just beyond a structure level; `value` is the buffer in percent. */
  type: z.enum(["percent", "atr", "support", "swing_low"]),
  value: z.number().positive(),
  trailing: z.boolean().default(false),
  atrPeriod: z.number().int().min(1).max(100).default(14),
  /** Pivot strength for support, or lookback bars for swing_low. */
  period: z.number().int().min(2).max(60).optional(),
});
export type StopLoss = z.infer<typeof StopLoss>;

export const Target = z.object({
  type: z.enum(["percent", "rr", "resistance"]), // rr = multiple of initial risk (needs a stop-loss); resistance = just below the next resistance
  value: z.number().positive(),
});
export type Target = z.infer<typeof Target>;

export const Sizing = z.object({
  type: z.enum(["fixed_amount", "percent_equity", "risk_percent"]),
  value: z.number().positive(),
});
export type Sizing = z.infer<typeof Sizing>;

export const StrategyDef = z
  .object({
    name: z.string().min(1).max(80),
    direction: z.enum(["long", "short"]).default("long"),
    product: z.enum(["delivery", "intraday"]).default("delivery"),
    entry: ConditionGroup,
    exit: ConditionGroup.optional(),
    stopLoss: StopLoss.optional(),
    target: Target.optional(),
    maxHoldBars: z.number().int().min(1).max(1000).optional(),
    sizing: Sizing.default({ type: "percent_equity", value: 100 }),
    initialCapital: z.number().positive().default(1_000_000),
  })
  .superRefine((s, ctx) => {
    if (s.target?.type === "rr" && !s.stopLoss) {
      ctx.addIssue({ code: "custom", path: ["target"], message: "An R-multiple target needs a stop-loss" });
    }
    if (s.direction === "short" && s.product !== "intraday") {
      ctx.addIssue({
        code: "custom",
        path: ["direction"],
        message: "NSE cash equity shorts must be intraday; use F&O for swing shorts",
      });
    }
    if (s.sizing.type === "risk_percent" && !s.stopLoss) {
      ctx.addIssue({ code: "custom", path: ["sizing"], message: "Risk-based sizing needs a stop-loss" });
    }
  });
export type StrategyDef = z.infer<typeof StrategyDef>;
