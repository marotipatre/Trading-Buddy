import { describe, it, expect } from "vitest";
import { reviewHolding, reviewPortfolio } from "./holding-review";
import type { StockView } from "./stock-view";

const view = (o: Partial<StockView> = {}): StockView => ({
  symbol: "X", price: 100, technical: 70, score: 70, verdict: "buy", frames: { daily: "up", weekly: "up", monthly: "up" }, ret: { w1: 2, m1: 5, m3: 10, m6: 20 }, rsi: 60, aboveEma50: true, reasons: [],
  plan: { entry: 100, entryKind: "now", stop: 94, target1: 112, target2: 120, riskPct: 6, rewardPct1: 12, rr1: 2, rr2: 3.3 }, ...o,
});

describe("reviewHolding", () => {
  it("exits a stock in a clear downtrend", () => {
    const r = reviewHolding({ symbol: "A.NS", qty: 10, avg: 120 }, view({ verdict: "avoid", aboveEma50: false, frames: { daily: "down", weekly: "down", monthly: "down" }, plan: null }), "IT", 1000);
    expect(r.action).toBe("exit");
    expect(r.pnlPct).toBeCloseTo(-16.67, 1);
    expect(r.reasons.join(" ")).toContain("weekly trend is down");
  });
  it("trims an oversized position", () => {
    expect(reviewHolding({ symbol: "A.NS", qty: 10, avg: 90 }, view(), "IT", 2000).action).toBe("trim"); // 1000 of 2000 = 50%
  });
  it("trims after a big overbought run", () => {
    expect(reviewHolding({ symbol: "A.NS", qty: 10, avg: 70 }, view({ rsi: 82 }), "IT", 10000).action).toBe("trim");
  });
  it("adds to a buy setup that is a small share of the portfolio and near its entry", () => {
    expect(reviewHolding({ symbol: "A.NS", qty: 5, avg: 98 }, view(), "IT", 10000).action).toBe("add");
  });
  it("holds when signals are mixed, and copes with missing data", () => {
    expect(reviewHolding({ symbol: "A.NS", qty: 5, avg: 98 }, view({ verdict: "watch", score: 50 }), "IT", 10000).action).toBe("hold");
    const none = reviewHolding({ symbol: "A.NS", qty: 5, avg: 98 }, null, "?", 10000);
    expect(none.action).toBe("hold");
    expect(none.price).toBe(98);
  });
  it("suggests a stop below the price", () => {
    expect(reviewHolding({ symbol: "A.NS", qty: 5, avg: 98 }, view(), "IT", 10000).stop).toBe(94);
  });
});

describe("reviewPortfolio", () => {
  const views = new Map<string, StockView | null>([
    ["A.NS", view({ price: 100, ret: { w1: 5, m1: 0, m3: 0, m6: 0 } })],
    ["B.NS", view({ price: 200, ret: { w1: -5, m1: 0, m3: 0, m6: 0 }, verdict: "avoid", aboveEma50: false, frames: { daily: "down", weekly: "down", monthly: "down" }, plan: null })],
  ]);
  const r = reviewPortfolio([{ symbol: "A.NS", qty: 10, avg: 90 }, { symbol: "B.NS", qty: 5, avg: 220 }], views, () => "Banks", 1);
  it("totals value, profit and the week", () => {
    expect(r.value).toBe(2000);
    expect(r.cost).toBe(2000);
    expect(r.weekPnl).toBeCloseTo(1000 - 1000 / 1.05 + (1000 - 1000 / 0.95), 5);
    expect(r.rows[0].value).toBeGreaterThanOrEqual(r.rows[1].value);
  });
  it("flags concentration, few holdings, downtrends and the market comparison", () => {
    const text = r.notes.join(" | ");
    expect(text).toContain("Banks is 100%");
    expect(text).toContain("Only 2 holdings");
    expect(text).toContain("downtrend");
    expect(text).toContain("Nifty 50");
  });
});
