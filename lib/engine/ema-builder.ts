import { StrategyDef, type Operand } from "./strategy";
import { ema, sma } from "./indicators";
import type { Candle } from "@/lib/data/types";

/** The few choices a trader makes for a moving-average strategy. Turned into a full strategy by `buildEmaStrategy`. */
export interface EmaSpec {
  entry: "cross" | "price_cross" | "pullback";
  fast: number;
  slow: number;
  exitOnReverse: boolean;
  stop: "percent" | "ema" | "atr";
  stopPct: number;
  stopEma: number;
  target: "none" | "percent" | "rr" | "next_ema";
  targetPct: number;
  targetRr: number;
  targetEmas: number[];
  maxHold: number;
}

export const DEFAULT_EMA_SPEC: EmaSpec = {
  entry: "cross", fast: 20, slow: 50, exitOnReverse: true,
  stop: "percent", stopPct: 6, stopEma: 50,
  target: "none", targetPct: 10, targetRr: 2, targetEmas: [20, 50, 100, 200],
  maxHold: 30,
};

const price = (field: "close" | "low"): Operand => ({ kind: "price", field, shift: 0 });
const e = (period: number, pct?: number): Operand => ({ kind: "indicator", name: "ema", period, shift: 0, ...(pct ? { pct } : {}) });

export function describeEmaSpec(s: EmaSpec): string {
  const buy = s.entry === "cross" ? `the ${s.fast} EMA crosses above the ${s.slow} EMA`
    : s.entry === "price_cross" ? `price closes above the ${s.slow} EMA`
    : `price pulls back to the ${s.fast} EMA while above the ${s.slow} EMA and closes back above it`;
  const stop = s.stop === "percent" ? `${s.stopPct}% below entry` : s.stop === "atr" ? `${s.stopPct}× ATR below entry` : `just below the ${s.stopEma} EMA`;
  const target = s.target === "none" ? "no fixed target" : s.target === "percent" ? `${s.targetPct}% above entry`
    : s.target === "rr" ? `${s.targetRr}× the risk` : `just before the next EMA above price (${[...s.targetEmas].sort((a, b) => a - b).join(", ")})`;
  return `Buy when ${buy}. Stop ${stop}. Target: ${target}.${s.exitOnReverse ? " Sell early if the signal reverses." : ""} Hold at most ${s.maxHold} days.`;
}

export function buildEmaStrategy(s: EmaSpec): StrategyDef {
  const entry = s.entry === "cross" ? [{ left: e(s.fast), op: "crosses_above" as const, right: e(s.slow) }]
    : s.entry === "price_cross" ? [{ left: price("close"), op: "crosses_above" as const, right: e(s.slow) }]
    : [
        { left: price("close"), op: ">" as const, right: e(s.slow) },
        { left: price("low"), op: "<=" as const, right: e(s.fast, 0.5) },
        { left: price("close"), op: ">" as const, right: e(s.fast) },
      ];
  const exit = !s.exitOnReverse ? undefined
    : s.entry === "cross" ? [{ left: e(s.fast), op: "crosses_below" as const, right: e(s.slow) }]
    : [{ left: price("close"), op: "crosses_below" as const, right: e(s.slow) }];
  const stopLoss = s.stop === "percent" ? { type: "percent", value: s.stopPct }
    : s.stop === "atr" ? { type: "atr", value: s.stopPct }
    : { type: "ema", value: 0.5, period: s.stopEma };
  const target = s.target === "none" ? undefined : s.target === "percent" ? { type: "percent", value: s.targetPct }
    : s.target === "rr" ? { type: "rr", value: s.targetRr } : { type: "next_ema", value: 0.3, periods: s.targetEmas };
  return StrategyDef.parse({
    name: "EMA strategy", product: "delivery", direction: "long",
    entry: { conditions: entry }, ...(exit ? { exit: { conditions: exit } } : {}), stopLoss, target, maxHoldBars: s.maxHold,
  });
}

/** Moving averages a strategy refers to, so the chart can draw them. */
export function averagesOf(strat: StrategyDef): { kind: "ema" | "sma"; period: number }[] {
  const out = new Map<string, { kind: "ema" | "sma"; period: number }>();
  const add = (kind: "ema" | "sma", period?: number) => { if (period) out.set(`${kind}${period}`, { kind, period }); };
  const visit = (o: Operand) => { if (o.kind === "indicator" && (o.name === "ema" || o.name === "sma")) add(o.name, o.period ?? (o.name === "ema" ? 20 : 20)); };
  for (const g of [strat.entry, strat.exit]) g?.conditions.forEach((c) => { visit(c.left); visit(c.right); });
  if (strat.stopLoss?.type === "ema") add("ema", strat.stopLoss.period ?? 50);
  if (strat.target?.type === "next_ema") (strat.target.periods ?? [10, 20, 50, 100, 200]).forEach((p) => add("ema", p));
  return [...out.values()].sort((a, b) => a.period - b.period).slice(0, 6);
}

export function averageSeries(candles: Candle[], kind: "ema" | "sma", period: number): { time: number; value: number }[] {
  const closes = candles.map((c) => c.close);
  const v = kind === "ema" ? ema(closes, period) : sma(closes, period);
  return candles.flatMap((c, i) => (Number.isFinite(v[i]) ? [{ time: c.time, value: v[i] }] : []));
}
