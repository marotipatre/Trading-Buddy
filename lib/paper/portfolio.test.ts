import { describe, it, expect } from "vitest";
import { positionStats, summarizePositions } from "./portfolio";
import type { PaperPosition } from "./types";

const DAY = 86400;
const IST = 5.5 * 3600;
// 2026-03-10 11:00 IST
const now = Date.UTC(2026, 2, 10, 11, 0) / 1000 - IST;
const pos = (o: Partial<PaperPosition> = {}): PaperPosition => ({
  id: 1, symbol: "A.NS", direction: "long", product: "delivery", qty: 10, entryPrice: 100, entryTime: now - 5 * DAY,
  entryCharges: 0, best: 100, lastCheckedAt: 0, ...o,
});

describe("positionStats", () => {
  it("computes invested, current and P&L for a long", () => {
    const s = positionStats(pos(), 110, 105, now);
    expect(s).toMatchObject({ invested: 1000, current: 1100, pnl: 100 });
    expect(s.pnlPct).toBeCloseTo(10);
  });
  it("measures today's move from yesterday's close for older positions", () => {
    const s = positionStats(pos(), 110, 105, now);
    expect(s.dayPnl).toBeCloseTo(50);
    expect(s.dayPct).toBeCloseTo((50 / 1050) * 100);
  });
  it("measures today's move from the entry price when opened today", () => {
    const s = positionStats(pos({ entryTime: now - 3600 }), 110, 105, now);
    expect(s.dayPnl).toBeCloseTo(100);
  });
  it("falls back to entry when there is no previous close", () => {
    expect(positionStats(pos(), 110, undefined, now).dayPnl).toBeCloseTo(100);
  });
  it("inverts everything for shorts", () => {
    const s = positionStats(pos({ direction: "short", product: "intraday", entryTime: now - 60 }), 90, 100, now);
    expect(s.pnl).toBeCloseTo(100);
    expect(s.current).toBeCloseTo(1100);
    expect(s.dayPnl).toBeCloseTo(100);
  });
});

describe("summarizePositions", () => {
  const state = { positions: [pos(), pos({ id: 2, symbol: "B.NS", qty: 5, entryPrice: 200, product: "intraday" })] };
  const prices = { "A.NS": { price: 110, prevClose: 105 }, "B.NS": { price: 190, prevClose: 195 } };
  it("totals across positions and can filter by product", () => {
    const all = summarizePositions(state, prices, now);
    expect(all.invested).toBe(2000);
    expect(all.pnl).toBeCloseTo(100 - 50);
    const del = summarizePositions(state, prices, now, "delivery");
    expect(del.invested).toBe(1000);
    expect(del.pnl).toBe(100);
    expect(summarizePositions(state, prices, now, "intraday").pnl).toBe(-50);
  });
  it("values positions with no live price at cost", () => {
    const s = summarizePositions(state, {}, now);
    expect(s.pnl).toBe(0);
    expect(s.current).toBe(2000);
  });
  it("is zero for an empty portfolio", () => {
    expect(summarizePositions({ positions: [] }, {}, now)).toEqual({ invested: 0, current: 0, pnl: 0, pnlPct: 0, dayPnl: 0, dayPct: 0 });
  });
});
