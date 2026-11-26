import { describe, it, expect } from "vitest";
import { cancelOrder, catchUp, expireOrders, modifyOrder, newAccount, nextSessionEnd, onPrice, placeOrder, setExits } from "./broker";
import { DEFAULT_COSTS, type CostConfig } from "@/lib/engine/costs";
import type { OrderRequest, PaperState } from "./types";

const zero: CostConfig = {
  ...DEFAULT_COSTS, brokeragePct: 0, brokerageCap: 0, sttDeliveryPct: 0, sttIntradaySellPct: 0, exchangeTxnPct: 0,
  sebiPct: 0, stampDeliveryBuyPct: 0, stampIntradayBuyPct: 0, dpChargePerSell: 0, slippageBps: 0,
};
const req = (o: Partial<OrderRequest> = {}): OrderRequest => ({ symbol: "ABC.NS", side: "buy", qty: 10, type: "market", product: "delivery", ...o });
const ok = (r: { state: PaperState; error?: string }) => { expect(r.error).toBeUndefined(); return r.state; };
/** An account holding 10 shares bought at 100. */
const holding = (costs = zero, cash = 100000) => ok(placeOrder(newAccount(cash, costs), req(), 100, 1));
const events = (s: PaperState) => (s.events ?? []).map((e) => e.kind + ":" + e.text);
const at = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo, d, h, mi) / 1000 - 5.5 * 3600;

describe("take-profit (limit sell on a holding)", () => {
  it("rests until the price reaches it, then sells at the limit and journals it as a target", () => {
    let s = ok(placeOrder(holding(), req({ side: "sell", type: "limit", limitPrice: 110 }), 100, 2));
    expect(s.orders).toHaveLength(1);
    expect(s.orders[0]).toMatchObject({ kind: "limit", limitPrice: 110 });
    s = onPrice(s, "ABC.NS", 105, 3);
    expect(s.positions).toHaveLength(1);
    s = onPrice(s, "ABC.NS", 110, 4);
    expect(s.positions).toHaveLength(0);
    expect(s.orders).toHaveLength(0);
    expect(s.trades[0]).toMatchObject({ exitPrice: 110, reason: "target", netPnl: 100 });
    expect(events(s).at(-1)).toMatch(/filled:Take-profit order executed: sold 10 ABC @ 110\.00/);
  });
  it("a gap above the limit fills at the better opening price", () => {
    let s = ok(placeOrder(holding(), req({ side: "sell", type: "limit", limitPrice: 110 }), 100, 2));
    s = catchUp(s, "ABC.NS", [{ time: 5, open: 118, high: 120, low: 117, close: 119 }]);
    expect(s.trades[0].exitPrice).toBe(118);
  });
  it("a sell limit at or below the market just sells now", () => {
    const s = ok(placeOrder(holding(), req({ side: "sell", type: "limit", limitPrice: 99 }), 100, 2));
    expect(s.positions).toHaveLength(0);
    expect(s.orders).toHaveLength(0);
  });
  it("cannot exceed the quantity held", () => {
    expect(placeOrder(holding(), req({ side: "sell", type: "limit", limitPrice: 110, qty: 11 }), 100, 2).error).toMatch(/only hold 10/);
  });
  it("sells only what is left if the position shrank in the meantime", () => {
    let s = ok(placeOrder(holding(), req({ side: "sell", type: "limit", limitPrice: 110 }), 100, 2));
    s = ok(placeOrder(s, req({ side: "sell", qty: 6 }), 101, 3));
    s = onPrice(s, "ABC.NS", 110, 4);
    expect(s.trades.at(-1)).toMatchObject({ qty: 4, exitPrice: 110 });
    expect(s.positions).toHaveLength(0);
  });
});

describe("stop-loss (stop order)", () => {
  it("triggers when the price falls to the trigger and fills there", () => {
    let s = ok(placeOrder(holding(), req({ side: "sell", type: "stop", triggerPrice: 95 }), 100, 2));
    s = onPrice(s, "ABC.NS", 97, 3);
    expect(s.positions).toHaveLength(1);
    s = catchUp(s, "ABC.NS", [{ time: 4, open: 98, high: 98, low: 94, close: 96 }]);
    expect(s.trades[0]).toMatchObject({ exitPrice: 95, reason: "stop" });
    expect(events(s).at(-1)).toMatch(/Stop-loss order executed/);
  });
  it("a gap down fills at the open, not the trigger", () => {
    let s = ok(placeOrder(holding(), req({ side: "sell", type: "stop", triggerPrice: 95 }), 100, 2));
    s = catchUp(s, "ABC.NS", [{ time: 4, open: 90, high: 92, low: 88, close: 91 }]);
    expect(s.trades[0].exitPrice).toBe(90);
  });
  it("pays slippage because a triggered stop is a market order", () => {
    const costs = { ...zero, slippageBps: 100 };
    let s = ok(placeOrder(holding(costs), req({ side: "sell", type: "stop", triggerPrice: 95 }), 100, 2));
    s = onPrice(s, "ABC.NS", 94, 3);
    expect(s.trades[0].exitPrice).toBeCloseTo(94 * 0.99);
  });
  it("rejects triggers that would fire immediately", () => {
    expect(placeOrder(holding(), req({ side: "sell", type: "stop", triggerPrice: 100 }), 100, 2).error).toMatch(/below the current price/);
    expect(placeOrder(newAccount(100000, zero), req({ side: "buy", type: "stop", triggerPrice: 99 }), 100, 2).error).toMatch(/above the current price/);
    expect(placeOrder(holding(), req({ side: "sell", type: "stop" }), 100, 2).error).toMatch(/trigger price/);
  });
  it("a buy stop is a breakout entry: it opens a position when price rises to the trigger", () => {
    let s = ok(placeOrder(newAccount(100000, zero), req({ type: "stop", triggerPrice: 105 }), 100, 1));
    s = onPrice(s, "ABC.NS", 103, 2);
    expect(s.positions).toHaveLength(0);
    s = onPrice(s, "ABC.NS", 106, 3);
    expect(s.positions[0]).toMatchObject({ direction: "long", qty: 10 });
    expect(s.positions[0].entryPrice).toBe(106); // tick gapped past the trigger: fills at the tick
  });
});

describe("oco and rejections", () => {
  it("when take-profit fills, the stop-loss order cancels itself", () => {
    let s = holding();
    s = ok(placeOrder(s, req({ side: "sell", type: "limit", limitPrice: 110 }), 100, 2));
    s = ok(placeOrder(s, req({ side: "sell", type: "stop", triggerPrice: 95 }), 100, 2));
    expect(s.orders).toHaveLength(2);
    s = onPrice(s, "ABC.NS", 111, 3);
    expect(s.positions).toHaveLength(0);
    expect(s.trades).toHaveLength(1);
    // the leftover stop only gets noticed when its own trigger is touched
    s = onPrice(s, "ABC.NS", 90, 4);
    expect(s.orders).toHaveLength(0);
    expect(events(s).join("|")).toMatch(/cancelled:Stop-loss order cancelled: you no longer hold ABC/);
    expect(s.trades).toHaveLength(1);
  });
  it("a resting buy that cannot be afforded at trigger time is rejected with a reason", () => {
    let s = ok(placeOrder(newAccount(1000, zero), req({ qty: 5, type: "limit", limitPrice: 90 }), 100, 1));
    s = { ...s, cash: 100 }; // money was spent elsewhere in the meantime
    s = onPrice(s, "ABC.NS", 89, 2);
    expect(s.positions).toHaveLength(0);
    expect(s.orders).toHaveLength(0);
    expect(events(s).at(-1)).toMatch(/rejected:Limit order rejected: Insufficient funds/);
  });
  it("orders saved before stop orders existed are treated as limits", () => {
    let s = ok(placeOrder(newAccount(100000, zero), req({ type: "limit", limitPrice: 95 }), 100, 1));
    s = { ...s, orders: s.orders.map((o) => ({ ...o, kind: undefined, validity: undefined, expiresAt: undefined })) };
    s = onPrice(s, "ABC.NS", 94, 2);
    expect(s.positions[0].entryPrice).toBe(94);
  });
});

describe("validity and expiry", () => {
  it("defaults: delivery orders are GTT (a year), intraday orders are day orders", () => {
    const base = newAccount(100000, zero);
    const gtt = ok(placeOrder(base, req({ type: "limit", limitPrice: 90 }), 100, 1000));
    expect(gtt.orders[0]).toMatchObject({ validity: "gtt", expiresAt: 1000 + 365 * 86400 });
    const day = ok(placeOrder(base, req({ type: "limit", limitPrice: 90, product: "intraday" }), 100, 1000));
    expect(day.orders[0].validity).toBe("day");
  });
  it("nextSessionEnd is 15:30 IST that day, the next weekday after close, and skips weekends", () => {
    expect(nextSessionEnd(at(2026, 2, 9, 11, 0))).toBe(at(2026, 2, 9, 15, 30)); // Monday morning
    expect(nextSessionEnd(at(2026, 2, 9, 16, 0))).toBe(at(2026, 2, 10, 15, 30)); // Monday after close
    expect(nextSessionEnd(at(2026, 2, 13, 16, 0))).toBe(at(2026, 2, 16, 15, 30)); // Friday after close -> Monday
    expect(nextSessionEnd(at(2026, 2, 14, 12, 0))).toBe(at(2026, 2, 16, 15, 30)); // Saturday -> Monday
  });
  it("day orders expire at the end of the session while GTT orders stay", () => {
    const t = at(2026, 2, 9, 11, 0);
    let s = ok(placeOrder(newAccount(100000, zero), req({ type: "limit", limitPrice: 90, validity: "day" }), 100, t));
    s = ok(placeOrder(s, req({ type: "limit", limitPrice: 80, validity: "gtt" }), 100, t));
    expect(expireOrders(s, at(2026, 2, 9, 15, 0)).orders).toHaveLength(2);
    const after = expireOrders(s, at(2026, 2, 9, 15, 31));
    expect(after.orders.map((o) => o.validity)).toEqual(["gtt"]);
    expect(events(after).at(-1)).toMatch(/expired:Limit order expired/);
    expect(expireOrders(after, at(2026, 2, 9, 15, 32))).toBe(after); // nothing more to do
  });
  it("GTT orders expire after a year", () => {
    const s = ok(placeOrder(newAccount(100000, zero), req({ type: "limit", limitPrice: 90 }), 100, 1000));
    expect(expireOrders(s, 1000 + 366 * 86400).orders).toHaveLength(0);
  });
});

describe("modifying and cancelling", () => {
  it("changes the price of a resting take-profit and the new price is what triggers", () => {
    let s = ok(placeOrder(holding(), req({ side: "sell", type: "limit", limitPrice: 110 }), 100, 2));
    s = ok(modifyOrder(s, s.orders[0].id, { price: 104 }, 100, 3));
    s = onPrice(s, "ABC.NS", 104, 4);
    expect(s.trades[0].exitPrice).toBe(104);
    expect(events(s).join("|")).toMatch(/updated:Take-profit order changed: 10 ABC @ 104\.00/);
  });
  it("refuses changes that make no sense", () => {
    const s = ok(placeOrder(holding(), req({ side: "sell", type: "limit", limitPrice: 110 }), 100, 2));
    const id = s.orders[0].id;
    expect(modifyOrder(s, id, { price: 99 }, 100, 3).error).toMatch(/above the current price/);
    expect(modifyOrder(s, id, { qty: 20 }, 100, 3).error).toMatch(/only hold 10/);
    expect(modifyOrder(s, id, { qty: 0 }, 100, 3).error).toMatch(/whole number/);
    expect(modifyOrder(s, 999, { price: 120 }, 100, 3).error).toMatch(/not found/);
  });
  it("cancelling removes the order and logs it", () => {
    let s = ok(placeOrder(newAccount(100000, zero), req({ type: "limit", limitPrice: 90 }), 100, 1));
    s = cancelOrder(s, s.orders[0].id, 5);
    expect(s.orders).toHaveLength(0);
    expect(events(s).at(-1)).toMatch(/cancelled:Limit order cancelled: buy 10 ABC @ 90\.00/);
    expect(cancelOrder(s, 12345, 6)).toBe(s);
  });
});

describe("setExits on an open position", () => {
  it("adds a stop-loss and take-profit that then trigger", () => {
    let s = holding();
    s = ok(setExits(s, s.positions[0].id, { stop: 95, target: 110 }, 100, 2));
    expect(s.positions[0]).toMatchObject({ stop: 95, target: 110 });
    expect(events(s).at(-1)).toMatch(/Exit orders for ABC: stop-loss 95\.00, take-profit 110\.00/);
    const hit = onPrice(s, "ABC.NS", 111, 3);
    expect(hit.trades[0].reason).toBe("target");
    const stopped = onPrice(s, "ABC.NS", 94, 3);
    expect(stopped.trades[0].reason).toBe("stop");
  });
  it("validates sides against the current price (long and short)", () => {
    const s = holding();
    const id = s.positions[0].id;
    expect(setExits(s, id, { stop: 101 }, 100, 2).error).toMatch(/below the current price/);
    expect(setExits(s, id, { target: 99 }, 100, 2).error).toMatch(/above the current price/);
    expect(setExits(s, id, { stop: -1 }, 100, 2).error).toBeDefined();
    const short = ok(placeOrder(newAccount(100000, zero), req({ side: "sell", product: "intraday" }), 100, 1));
    expect(setExits(short, short.positions[0].id, { stop: 99 }, 100, 2).error).toMatch(/above the current price/);
    expect(setExits(short, short.positions[0].id, { stop: 105, target: 90 }, 100, 2).error).toBeUndefined();
  });
  it("null removes an exit, undefined leaves it alone, and trailing follows the price", () => {
    let s = holding();
    const id = s.positions[0].id;
    s = ok(setExits(s, id, { stop: 95, target: 110 }, 100, 2));
    s = ok(setExits(s, id, { target: null }, 100, 3));
    expect(s.positions[0]).toMatchObject({ stop: 95, target: undefined });
    s = ok(setExits(s, id, { stop: 95, trailing: true }, 100, 4));
    s = onPrice(s, "ABC.NS", 120, 5);
    expect(s.positions[0].stop).toBe(115); // trails 5 behind the new high
  });
  it("records the risk of a stop added after entry, but never overwrites the original", () => {
    let s = holding();
    const id = s.positions[0].id;
    expect(s.positions[0].initialRisk).toBeUndefined();
    s = ok(setExits(s, id, { stop: 95 }, 100, 2));
    expect(s.positions[0].initialRisk).toBe(50);
    s = ok(setExits(s, id, { stop: 98 }, 100, 3));
    expect(s.positions[0].initialRisk).toBe(50);
  });
  it("a profit-locking stop above entry does not invent a risk figure", () => {
    let s = holding();
    s = onPrice(s, "ABC.NS", 120, 2);
    s = ok(setExits(s, s.positions[0].id, { stop: 110 }, 120, 3));
    expect(s.positions[0].initialRisk).toBeUndefined();
  });
  it("reports an unknown position", () => {
    expect(setExits(holding(), 999, { stop: 95 }, 100, 2).error).toMatch(/not found/);
  });
});
