import { describe, it, expect } from "vitest";
import { computeMetrics, maxDrawdown, maxConsecutiveLosses, drawdownSeries, sharpeRatio } from "./metrics";
import type { Trade } from "./types";

const t = (netPnl: number, returnPct: number, extra: Partial<Trade> = {}): Trade => ({
  symbol: "X", direction: "long", entryTime: 0, entryIdx: 0, entryPrice: 100, exitTime: 0, exitIdx: 1, exitPrice: 100,
  qty: 1, grossPnl: netPnl, charges: 0, netPnl, returnPct, rMultiple: NaN, barsHeld: 5, exitReason: "signal",
  maePct: 0, mfePct: 0, product: "delivery", ...extra,
});
const eq = (...v: number[]) => v.map((equity, i) => ({ time: i * 86400, equity }));

describe("metrics", () => {
  it("max drawdown is peak-to-trough in percent", () => {
    expect(maxDrawdown(eq(100, 120, 90, 110))).toBeCloseTo(25);
    expect(maxDrawdown(eq(100, 110, 120))).toBe(0);
  });
  it("drawdown series is zero at new highs and negative below", () => {
    const s = drawdownSeries(eq(100, 50, 100));
    expect(s.map((p) => p.dd)).toEqual([0, -50, 0]);
  });
  it("max consecutive losses", () => {
    expect(maxConsecutiveLosses([t(1, 1), t(-1, -1), t(-2, -2), t(3, 3), t(-1, -1)])).toBe(2);
  });
  it("win rate, payoff, profit factor, expectancy", () => {
    const trades = [t(200, 10), t(100, 5), t(-100, -5), t(-100, -5)];
    const m = computeMetrics({ trades, equity: eq(1000, 1100), initialCapital: 1000, finalEquity: 1100 });
    expect(m.winRate).toBe(0.5);
    expect(m.payoffRatio).toBeCloseTo(7.5 / 5);
    expect(m.profitFactor).toBeCloseTo(300 / 200);
    expect(m.expectancyPct).toBeCloseTo(1.25);
    expect(m.totalReturnPct).toBeCloseTo(10);
    expect(m.lowSample).toBe(true);
  });
  it("profit factor is Infinity with no losing trades", () => {
    const m = computeMetrics({ trades: [t(50, 5)], equity: eq(100, 150), initialCapital: 100, finalEquity: 150 });
    expect(m.profitFactor).toBe(Infinity);
  });
  it("R expectancy ignores trades without a stop", () => {
    const trades = [t(10, 1, { rMultiple: 2 }), t(-5, -1, { rMultiple: -1 }), t(5, 1)];
    const m = computeMetrics({ trades, equity: eq(100, 110), initialCapital: 100, finalEquity: 110 });
    expect(m.expectancyR).toBeCloseTo(0.5);
  });
  it("CAGR annualises over the equity span", () => {
    const e = [{ time: 0, equity: 100 }, { time: 2 * 365.25 * 86400, equity: 144 }];
    const m = computeMetrics({ trades: [], equity: e, initialCapital: 100, finalEquity: 144 });
    expect(m.cagrPct).toBeCloseTo(20, 1);
  });
  it("sharpe is NaN for a flat curve", () => {
    expect(sharpeRatio(eq(100, 100, 100))).toBeNaN();
  });
});
