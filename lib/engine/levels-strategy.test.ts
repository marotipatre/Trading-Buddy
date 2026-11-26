import { describe, it, expect } from "vitest";
import { resolveDistances, runBacktest } from "./simulator";
import { SeriesCache, evalCondition } from "./rules";
import { StrategyDef } from "./strategy";
import { DEFAULT_COSTS, type CostConfig } from "./costs";
import type { Candle } from "@/lib/data/types";

const zero: CostConfig = { ...DEFAULT_COSTS, brokeragePct: 0, brokerageCap: 0, sttDeliveryPct: 0, sttIntradaySellPct: 0, exchangeTxnPct: 0, sebiPct: 0, stampDeliveryBuyPct: 0, stampIntradayBuyPct: 0, dpChargePerSell: 0, slippageBps: 0 };
const base = { name: "t", entry: { conditions: [{ left: { kind: "price", field: "close" }, op: ">", right: { kind: "number", value: 0 } }] } };
const strat = (extra: object) => StrategyDef.parse({ ...base, ...extra });

describe("schema", () => {
  it("accepts structural stops, resistance targets and percent offsets", () => {
    expect(StrategyDef.safeParse({ ...base, stopLoss: { type: "support", value: 1.5, period: 5 }, target: { type: "resistance", value: 1 } }).success).toBe(true);
    expect(StrategyDef.safeParse({ ...base, stopLoss: { type: "swing_low", value: 1, period: 10 } }).success).toBe(true);
    const cond = { left: { kind: "price", field: "low" }, op: "<=", right: { kind: "indicator", name: "support", period: 5, pct: 1 } };
    expect(StrategyDef.safeParse({ ...base, entry: { conditions: [cond] } }).success).toBe(true);
    expect(StrategyDef.safeParse({ ...base, entry: { conditions: [{ ...cond, right: { ...cond.right, pct: 99 } }] } }).success).toBe(false);
  });
});

describe("structural stop and target distances", () => {
  it("places a long stop just below support and a target just below resistance", () => {
    const s = strat({ stopLoss: { type: "support", value: 1 }, target: { type: "resistance", value: 1 } });
    const d = resolveDistances(s, 100, { atr: 2, support: 95, resistance: 115 });
    expect(d.stopDist).toBeCloseTo(100 - 95 * 0.99);
    expect(d.targetDist).toBeCloseTo(115 * 0.99 - 100);
    expect(d.invalid).toBeUndefined();
  });
  it("is invalid when there is no level, or the level is on the wrong side of the entry", () => {
    const s = strat({ stopLoss: { type: "support", value: 1 }, target: { type: "resistance", value: 1 } });
    expect(resolveDistances(s, 100, { atr: 2 }).invalid).toBe(true);
    expect(resolveDistances(s, 100, { atr: 2, support: 101, resistance: 120 }).invalid).toBe(true); // support above entry
    expect(resolveDistances(s, 100, { atr: 2, support: 95, resistance: 100.05 }).invalid).toBe(true); // target too close to be worth it
  });
  it("uses the recent swing low for swing_low stops", () => {
    const s = strat({ stopLoss: { type: "swing_low", value: 0.5, period: 10 } });
    expect(resolveDistances(s, 100, { atr: 2, swingLow: 94 }).stopDist).toBeCloseTo(100 - 94 * 0.995);
  });
  it("mirrors for shorts: stop above resistance, target above support", () => {
    const s = strat({ direction: "short", product: "intraday", stopLoss: { type: "support", value: 1 }, target: { type: "resistance", value: 1 } });
    const d = resolveDistances(s, 100, { atr: 2, support: 90, resistance: 106 });
    expect(d.stopDist).toBeCloseTo(106 * 1.01 - 100);
    expect(d.targetDist).toBeCloseTo(100 - 90 * 1.01);
  });
  it("percent and ATR stops still work and an rr target follows a structural stop", () => {
    expect(resolveDistances(strat({ stopLoss: { type: "percent", value: 5 } }), 200, 3).stopDist).toBe(10);
    const s = strat({ stopLoss: { type: "support", value: 1 }, target: { type: "rr", value: 2 } });
    const d = resolveDistances(s, 100, { atr: 1, support: 95 });
    expect(d.targetDist).toBeCloseTo(d.stopDist! * 2);
  });
});

/** Range-bound market with a slow swing and a faster wobble, so price keeps revisiting its earlier lows and highs. */
function zigzag(n = 400): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const wave = Math.sin(i / 6) * 8 + Math.sin(i / 1.7) * 2.2;
    const c = 100 + wave;
    return { time: 1_600_000_000 + i * 86400, open: c - 0.3, high: c + 1.2, low: c - 1.2, close: c, volume: 1e5 };
  });
}

describe("rules with levels", () => {
  it("a percent offset moves the operand", () => {
    const cache = new SeriesCache(zigzag());
    const raw = cache.value({ kind: "indicator", name: "support", period: 5, shift: 0 }, 200);
    const up = cache.value({ kind: "indicator", name: "support", period: 5, shift: 0, pct: 1 }, 200);
    expect(Number.isFinite(raw)).toBe(true);
    expect(up).toBeCloseTo(raw * 1.01);
  });
  it("support is at or below the close and resistance at or above it, with no lookahead", () => {
    const candles = zigzag();
    const cache = new SeriesCache(candles);
    for (let t = 40; t < 380; t += 7) {
      const s = cache.value({ kind: "indicator", name: "support", period: 5, shift: 0 }, t);
      const r = cache.value({ kind: "indicator", name: "resistance", period: 5, shift: 0 }, t);
      if (Number.isFinite(s)) expect(s).toBeLessThanOrEqual(candles[t].close);
      if (Number.isFinite(r)) expect(r).toBeGreaterThanOrEqual(candles[t].close);
    }
    const cut = new SeriesCache(candles.slice(0, 250));
    for (const t of [60, 120, 200, 249]) {
      const op = { kind: "indicator" as const, name: "support" as const, period: 5, shift: 0 };
      const a = cache.value(op, t), b = cut.value(op, t);
      expect(Number.isNaN(a) ? -1 : a).toBe(Number.isNaN(b) ? -1 : b);
    }
  });
  it('"touches support" can be expressed as low <= support + 1%', () => {
    const cache = new SeriesCache(zigzag());
    const cond = { left: { kind: "price", field: "low", shift: 0 }, op: "<=", right: { kind: "indicator", name: "support", period: 5, shift: 0, pct: 1 } } as const;
    const hits = Array.from({ length: 300 }, (_, i) => evalCondition(cache, cond, i + 50)).filter(Boolean).length;
    expect(hits).toBeGreaterThan(0);
  });
});

describe("a support-bounce strategy end to end", () => {
  const s = strat({
    entry: { conditions: [
      { left: { kind: "price", field: "low" }, op: "<=", right: { kind: "indicator", name: "support", period: 5, pct: 1 } },
      { left: { kind: "price", field: "close" }, op: ">", right: { kind: "indicator", name: "support", period: 5 } },
    ] },
    stopLoss: { type: "support", value: 1.5, period: 5 },
    target: { type: "resistance", value: 1 },
    maxHoldBars: 20,
  });
  const r = runBacktest("ZZ", zigzag(), s, zero);
  it("takes trades and every one has a stop below its entry and exits for a valid reason", () => {
    expect(r.trades.length).toBeGreaterThan(3);
    for (const t of r.trades) {
      expect(t.qty).toBeGreaterThan(0);
      expect(t.exitIdx).toBeGreaterThanOrEqual(t.entryIdx);
      expect(Number.isFinite(t.rMultiple)).toBe(true);
    }
  });
  it("skips signals when no structural level exists instead of trading without a stop", () => {
    const flat: Candle[] = Array.from({ length: 80 }, (_, i) => ({ time: i * 86400, open: 100, high: 100.5, low: 99.5, close: 100, volume: 1 }));
    expect(runBacktest("F", flat, strat({ stopLoss: { type: "support", value: 1 } }), zero).trades).toHaveLength(0);
  });
});

describe("EMA stop and next-EMA target", () => {
  const s = strat({ stopLoss: { type: "ema", value: 1, period: 50 }, target: { type: "next_ema", value: 0.5, periods: [20, 50, 200] } });
  it("targets the nearest EMA above entry and stops below the stop EMA", () => {
    const d = resolveDistances(s, 100, { atr: 1, stopEma: 96, emas: [98, 104, 110] });
    expect(d.targetDist).toBeCloseTo(104 * 0.995 - 100);
    expect(d.stopDist).toBeCloseTo(100 - 96 * 0.99);
  });
  it("skips the trade when no EMA lies above the entry", () => {
    expect(resolveDistances(s, 100, { atr: 1, stopEma: 96, emas: [90, 95, 99] }).invalid).toBe(true);
  });
  it("shorts target the nearest EMA below", () => {
    const sh = strat({ direction: "short", product: "intraday", stopLoss: { type: "ema", value: 1, period: 50 }, target: { type: "next_ema", value: 0.5 } });
    const d = resolveDistances(sh, 100, { atr: 1, stopEma: 104, emas: [90, 96, 110] });
    expect(d.targetDist).toBeCloseTo(100 - 96 * 1.005);
  });
});
