import { describe, it, expect } from "vitest";
import { settleStale, type Bar } from "./replay";
import { newAccount, placeOrder } from "@/lib/paper/broker";

const ENTRY = Date.parse("2023-11-15T05:00:00Z") / 1000; // Wed 10:30 IST
const NEXT_DAY = Date.parse("2023-11-16T04:00:00Z") / 1000; // Thu 09:30 IST
const bar = (min: number, o: number, h: number, l: number, c: number): Bar => ({ time: ENTRY + min * 60, open: o, high: h, low: l, close: c });

function holding(stop?: number, target?: number) {
  const r = placeOrder(newAccount(500000), { symbol: "X.NS", side: "buy", qty: 100, type: "market", product: "intraday", stop, target }, 500, ENTRY, { intradayClock: ENTRY });
  expect(r.error).toBeUndefined();
  return r.state;
}

describe("settleStale", () => {
  it("closes at the last price before 3:15, not at today's price", () => {
    const flat = Array.from({ length: 40 }, (_, i) => bar(5 * i, 501, 502, 500, 501)); // 10:30 .. 13:45
    const late = bar(4 * 60 + 35, 540, 541, 539, 540); // 15:05 IST: before square-off
    const after = { ...bar(4 * 60 + 50, 600, 600, 600, 600) }; // 15:20 IST: after square-off, must be ignored
    const r = settleStale(holding(), { "X.NS": [...flat, late, after] }, NEXT_DAY);
    expect(r.settled).toBe(1);
    expect(r.state.positions).toHaveLength(0);
    expect(r.state.trades[0].exitPrice).toBeCloseTo(540, 0);
    expect(r.state.trades[0].reason).toBe("squareoff");
  });
  it("honours a stop that was hit during that session", () => {
    const bars = [bar(10, 500, 501, 499, 500), bar(20, 499, 499.5, 490, 492), bar(30, 492, 493, 491, 492)];
    const r = settleStale(holding(495, 520), { "X.NS": bars }, NEXT_DAY);
    expect(r.state.trades[0].reason).toBe("stop");
    expect(r.state.trades[0].exitPrice).toBeLessThanOrEqual(495);
  });
  it("closes flat and reports when there is no candle data", () => {
    const r = settleStale(holding(), {}, NEXT_DAY);
    expect(r.noData).toEqual(["X.NS"]);
    expect(r.state.positions).toHaveLength(0);
    expect(r.state.trades[0].exitPrice).toBeCloseTo(500, 0);
  });
  it("leaves today's positions alone", () => {
    const r = settleStale(holding(), {}, ENTRY + 600);
    expect(r.settled).toBe(0);
    expect(r.state.positions).toHaveLength(1);
  });
});
