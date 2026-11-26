import { describe, it, expect } from "vitest";
import { SeriesCache, buildSignals, evalCondition } from "./rules";
import type { Candle } from "@/lib/data/types";
import type { Condition, ConditionGroup } from "./strategy";

const mk = (closes: number[]): Candle[] =>
  closes.map((c, i) => ({ time: i, open: c, high: c + 1, low: c - 1, close: c, volume: 100 }));

const close = { kind: "price", field: "close", shift: 0 } as const;
const num = (value: number) => ({ kind: "number", value }) as const;

describe("rules", () => {
  it("compares price to a number", () => {
    const cache = new SeriesCache(mk([1, 5, 10]));
    const cond: Condition = { left: close, op: ">", right: num(4) };
    expect([0, 1, 2].map((i) => evalCondition(cache, cond, i))).toEqual([false, true, true]);
  });

  it("any NaN comparison is false", () => {
    const cache = new SeriesCache(mk([1, 2, 3, 4]));
    const sma5 = { kind: "indicator", name: "sma", period: 5, shift: 0 } as const;
    expect(evalCondition(cache, { left: close, op: ">", right: sma5 }, 3)).toBe(false);
    expect(evalCondition(cache, { left: close, op: "<", right: sma5 }, 3)).toBe(false);
  });

  it("crossover fires only on the crossing bar", () => {
    const cache = new SeriesCache(mk([1, 2, 5, 6]));
    const cond: Condition = { left: close, op: "crosses_above", right: num(3) };
    const sig = buildSignals(cache, { logic: "all", conditions: [cond] });
    expect(sig).toEqual([false, false, true, false]);
  });

  it("crossover is false on bar 0 (no previous value)", () => {
    const cache = new SeriesCache(mk([10, 11]));
    expect(evalCondition(cache, { left: close, op: "crosses_above", right: num(5) }, 0)).toBe(false);
  });

  it("shift reads earlier bars only", () => {
    const cache = new SeriesCache(mk([1, 2, 3]));
    const prev = { kind: "price", field: "close", shift: 1 } as const;
    expect(cache.value(prev, 0)).toBeNaN();
    expect(cache.value(prev, 2)).toBe(2);
  });

  it("all vs any logic", () => {
    const cache = new SeriesCache(mk([1, 5, 10]));
    const a: Condition = { left: close, op: ">", right: num(4) };
    const b: Condition = { left: close, op: ">", right: num(8) };
    const all: ConditionGroup = { logic: "all", conditions: [a, b] };
    const any: ConditionGroup = { logic: "any", conditions: [a, b] };
    expect(buildSignals(cache, all)).toEqual([false, false, true]);
    expect(buildSignals(cache, any)).toEqual([false, true, true]);
  });

  it("signals never depend on future bars", () => {
    const base = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 10);
    const group: ConditionGroup = {
      logic: "all",
      conditions: [{ left: close, op: "crosses_above", right: { kind: "indicator", name: "sma", period: 10, shift: 0 } }],
    };
    const full = buildSignals(new SeriesCache(mk(base)), group);
    const cut = buildSignals(new SeriesCache(mk(base.slice(0, 40))), group);
    expect(full.slice(0, 40)).toEqual(cut);
  });
});

describe("supertrend flip preset logic", () => {
  it("does not signal a bullish flip at the end of warmup in a steady uptrend", () => {
    const cache = new SeriesCache(mk(Array.from({ length: 60 }, (_, i) => 100 + i * 2)));
    const dir = { kind: "indicator", name: "supertrend_dir", period: 10, mult: 3, shift: 0 } as const;
    const sig = buildSignals(cache, { logic: "all", conditions: [{ left: dir, op: "crosses_above", right: num(0) }] });
    expect(sig.some(Boolean)).toBe(false);
  });
});
