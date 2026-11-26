import { describe, it, expect } from "vitest";
import { newAccount, placeOrder, closePosition, onPrice, catchUp, equity, squareOffIntraday, cancelOrder, evaluateBar, isSquareOffTime } from "./broker";
import { DEFAULT_COSTS, type CostConfig } from "@/lib/engine/costs";
import type { OrderRequest, PaperState } from "./types";

const zero: CostConfig = {
  ...DEFAULT_COSTS, brokeragePct: 0, brokerageCap: 0, sttDeliveryPct: 0, sttIntradaySellPct: 0, exchangeTxnPct: 0,
  sebiPct: 0, stampDeliveryBuyPct: 0, stampIntradayBuyPct: 0, dpChargePerSell: 0, slippageBps: 0,
};
const acct = (cash = 100000, costs = zero) => newAccount(cash, costs);
const buy = (o: Partial<OrderRequest> = {}): OrderRequest => ({ symbol: "ABC", side: "buy", qty: 10, type: "market", product: "delivery", ...o });
const must = (r: { state: PaperState; error?: string }) => { expect(r.error).toBeUndefined(); return r.state; };

describe("placing orders", () => {
  it("market buy opens a position and debits cash", () => {
    const s = must(placeOrder(acct(), buy(), 100, 1));
    expect(s.positions[0]).toMatchObject({ symbol: "ABC", direction: "long", qty: 10, entryPrice: 100 });
    expect(s.cash).toBe(100000 - 1000);
  });
  it("applies slippage against you and charges", () => {
    const s = must(placeOrder(newAccount(100000, { ...DEFAULT_COSTS, slippageBps: 100 }), buy(), 100, 1));
    expect(s.positions[0].entryPrice).toBeCloseTo(101);
    expect(s.positions[0].entryCharges).toBeGreaterThan(0);
  });
  it("rejects bad quantity, missing price and insufficient funds", () => {
    expect(placeOrder(acct(), buy({ qty: 0 }), 100, 1).error).toMatch(/whole number/);
    expect(placeOrder(acct(), buy({ qty: 1.5 }), 100, 1).error).toMatch(/whole number/);
    expect(placeOrder(acct(), buy({ type: "limit" }), 100, 1).error).toMatch(/limit price/);
    expect(placeOrder(acct(500), buy(), 100, 1).error).toMatch(/Insufficient funds/);
    expect(placeOrder(acct(), buy(), 0, 1).error).toMatch(/No live price/);
  });
  it("rejects stops and targets on the wrong side", () => {
    expect(placeOrder(acct(), buy({ stop: 105 }), 100, 1).error).toMatch(/Stop-loss/);
    expect(placeOrder(acct(), buy({ target: 95 }), 100, 1).error).toMatch(/Target/);
  });
  it("forbids delivery shorts but allows intraday shorts", () => {
    expect(placeOrder(acct(), buy({ side: "sell" }), 100, 1).error).toMatch(/delivery shorts/);
    const s = must(placeOrder(acct(), buy({ side: "sell", product: "intraday" }), 100, 1));
    expect(s.positions[0].direction).toBe("short");
  });
  it("adding to a position averages the price", () => {
    let s = must(placeOrder(acct(), buy(), 100, 1));
    s = must(placeOrder(s, buy(), 110, 2));
    expect(s.positions).toHaveLength(1);
    expect(s.positions[0]).toMatchObject({ qty: 20, entryPrice: 105 });
  });
});

describe("closing and accounting", () => {
  it("selling realises P&L, journals the trade and restores cash", () => {
    let s = must(placeOrder(acct(), buy(), 100, 1));
    s = must(placeOrder(s, buy({ side: "sell" }), 110, 2));
    expect(s.positions).toHaveLength(0);
    expect(s.trades[0]).toMatchObject({ grossPnl: 100, netPnl: 100, reason: "manual" });
    expect(s.cash).toBe(100100);
  });
  it("partial close keeps the remainder and splits charges pro rata", () => {
    let s = must(placeOrder(newAccount(100000, { ...DEFAULT_COSTS, slippageBps: 0 }), buy({ qty: 10 }), 100, 1));
    const entryCharges = s.positions[0].entryCharges;
    s = must(closePosition(s, s.positions[0].id, 4, 100, 2, "manual"));
    expect(s.positions[0].qty).toBe(6);
    expect(s.positions[0].entryCharges).toBeCloseTo(entryCharges * 0.6);
    expect(s.trades[0].qty).toBe(4);
  });
  it("cannot sell more than held", () => {
    const s = must(placeOrder(acct(), buy(), 100, 1));
    expect(placeOrder(s, buy({ side: "sell", qty: 11 }), 100, 2).error).toMatch(/only hold 10/);
  });
  it("short P&L is inverted", () => {
    let s = must(placeOrder(acct(), buy({ side: "sell", product: "intraday" }), 100, 1));
    s = must(placeOrder(s, buy({ side: "buy", product: "intraday" }), 90, 2));
    expect(s.trades[0]).toMatchObject({ direction: "short", grossPnl: 100 });
    expect(s.cash).toBe(100100);
  });
  it("equity marks open positions to market", () => {
    const s = must(placeOrder(acct(), buy(), 100, 1));
    expect(equity(s, { ABC: 120 })).toBe(100000 + 200);
    expect(equity(s, {})).toBe(100000);
  });
  it("cash plus open cost basis is conserved with zero costs", () => {
    const s = must(placeOrder(acct(), buy(), 100, 1));
    expect(equity(s, { ABC: 100 })).toBe(100000);
  });
});

describe("limit orders", () => {
  it("rests when not marketable, then fills when price reaches it", () => {
    let s = must(placeOrder(acct(), buy({ type: "limit", limitPrice: 95 }), 100, 1));
    expect(s.orders).toHaveLength(1);
    expect(s.positions).toHaveLength(0);
    s = onPrice(s, "ABC", 97, 2);
    expect(s.positions).toHaveLength(0);
    s = onPrice(s, "ABC", 94, 3);
    expect(s.orders).toHaveLength(0);
    expect(s.positions[0].entryPrice).toBe(94);
  });
  it("a marketable limit fills immediately at the current price", () => {
    const s = must(placeOrder(acct(), buy({ type: "limit", limitPrice: 105 }), 100, 1));
    expect(s.positions[0].entryPrice).toBe(100);
  });
  it("can be cancelled", () => {
    const s = must(placeOrder(acct(), buy({ type: "limit", limitPrice: 95 }), 100, 1));
    expect(cancelOrder(s, s.orders[0].id).orders).toHaveLength(0);
  });
});

describe("stops, targets, trailing and catch-up", () => {
  const withStop = (o: Partial<OrderRequest> = {}) => must(placeOrder(acct(), buy({ stop: 95, target: 110, ...o }), 100, 1));
  it("a tick through the stop closes the trade as a stop", () => {
    const s = onPrice(withStop(), "ABC", 94, 2);
    expect(s.positions).toHaveLength(0);
    expect(s.trades[0].reason).toBe("stop");
  });
  it("a tick through the target closes at target", () => {
    const s = onPrice(withStop(), "ABC", 111, 2);
    expect(s.trades[0].reason).toBe("target");
  });
  it("a tick between stop and target does nothing", () => {
    const s = onPrice(withStop(), "ABC", 102, 2);
    expect(s.positions).toHaveLength(1);
  });
  it("catch-up: stop wins when one bar spans both, and gaps fill at the open", () => {
    const wide = catchUp(withStop(), "ABC", [{ time: 5, open: 100, high: 115, low: 90, close: 100 }]);
    expect(wide.trades[0]).toMatchObject({ reason: "stop", exitPrice: 95 });
    const gap = catchUp(withStop(), "ABC", [{ time: 5, open: 88, high: 90, low: 85, close: 89 }]);
    expect(gap.trades[0].exitPrice).toBe(88);
  });
  it("catch-up ignores bars at or before the last check", () => {
    const s = catchUp(withStop(), "ABC", [{ time: 1, open: 100, high: 100, low: 50, close: 60 }]);
    expect(s.positions).toHaveLength(1);
  });
  it("trailing stop ratchets up and then exits on a pullback", () => {
    let s = must(placeOrder(acct(), buy({ stop: 95, trailing: true }), 100, 1));
    s = onPrice(s, "ABC", 110, 2);
    expect(s.positions[0].stop).toBe(105);
    s = onPrice(s, "ABC", 108, 3);
    expect(s.positions[0].stop).toBe(105);
    s = onPrice(s, "ABC", 104, 4);
    expect(s.trades[0]).toMatchObject({ reason: "stop", exitPrice: 104 });
  });
  it("evaluateBar never lowers a long stop", () => {
    const pos = withStop({ trailing: true }).positions[0];
    const { pos: p2 } = evaluateBar({ ...pos, stop: 105 }, { time: 9, open: 108, high: 108, low: 106, close: 107 });
    expect(p2.stop).toBeGreaterThanOrEqual(105);
  });
  it("resting limit buy fills during catch-up at the better of limit/open", () => {
    const s0 = must(placeOrder(acct(), buy({ type: "limit", limitPrice: 95 }), 100, 1));
    const s = catchUp(s0, "ABC", [{ time: 5, open: 93, high: 96, low: 92, close: 95 }]);
    expect(s.positions[0].entryPrice).toBe(93);
  });
});

describe("intraday square-off", () => {
  it("closes intraday positions, cancels intraday orders, leaves delivery alone", () => {
    let s = must(placeOrder(acct(), buy({ product: "intraday" }), 100, 1));
    s = must(placeOrder(s, buy({ symbol: "XYZ", product: "delivery" }), 50, 1));
    s = must(placeOrder(s, buy({ symbol: "LMN", product: "intraday", type: "limit", limitPrice: 10 }), 20, 1));
    s = squareOffIntraday(s, { ABC: 101, XYZ: 50 }, 9);
    expect(s.positions.map((p) => p.symbol)).toEqual(["XYZ"]);
    expect(s.orders).toHaveLength(0);
    expect(s.trades[0].reason).toBe("squareoff");
  });
  it("square-off time is 15:15 IST", () => {
    expect(isSquareOffTime(15 * 60 + 14)).toBe(false);
    expect(isSquareOffTime(15 * 60 + 15)).toBe(true);
  });
});

import { intradayDue, istMinutes, istStartOfDay } from "./broker";

describe("IST helpers and intraday due", () => {
  // 2026-03-10 09:30 IST = 04:00 UTC
  const t = (h: number, m: number, d = 10) => Date.UTC(2026, 2, d, h, m) / 1000 - 5.5 * 3600;
  it("computes IST minutes and day start", () => {
    expect(istMinutes(t(9, 30))).toBe(9 * 60 + 30);
    expect(istStartOfDay(t(23, 59))).toBe(t(0, 0));
    expect(istStartOfDay(t(0, 1))).toBe(t(0, 0));
  });
  it("intraday positions are due after 15:15 or on a later day, delivery never", () => {
    const base = must(placeOrder(acct(), buy({ product: "intraday" }), 100, t(10, 0)));
    expect(intradayDue(base, t(12, 0))).toBe(false);
    expect(intradayDue(base, t(15, 15))).toBe(true);
    expect(intradayDue(base, t(9, 20, 11))).toBe(true);
    const del = must(placeOrder(acct(), buy({ product: "delivery" }), 100, t(10, 0)));
    expect(intradayDue(del, t(15, 20))).toBe(false);
    expect(intradayDue(del, t(9, 20, 12))).toBe(false);
  });
});
