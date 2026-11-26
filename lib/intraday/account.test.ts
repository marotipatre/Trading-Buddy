import { describe, it, expect } from "vitest";
import { addToPot, newIntradayAccount, pnlByDay, potView } from "./account";
import { placeOrder, closePosition } from "@/lib/paper/broker";

const T = Date.parse("2023-11-15T05:00:00Z") / 1000; // Wed 10:30 IST, inside the session
describe("intraday account", () => {
  it("gives five times the pot as buying power", () => {
    const a = newIntradayAccount(100000);
    expect(a.state.cash).toBe(500000);
    expect(potView(a, {}).buyingPower).toBe(500000);
    expect(potView(a, {}).value).toBe(100000);
  });
  it("adding to the pot adds leveraged buying power and raises the pot", () => {
    const r = addToPot(newIntradayAccount(100000), 20000, T);
    expect(r.acc.pot).toBe(120000);
    expect(r.acc.state.cash).toBe(600000);
    expect(addToPot(newIntradayAccount(100000), 0, T).error).toBeTruthy();
  });
  it("refuses an order larger than the margin allows", () => {
    const a = newIntradayAccount(10000); // 50,000 buying power
    const r = placeOrder(a.state, { symbol: "X.NS", side: "buy", qty: 100, type: "market", product: "intraday" }, 600, T, { intradayClock: T });
    expect(r.error).toBeTruthy();
  });
  it("tracks profit and margin used against the pot", () => {
    const a = newIntradayAccount(100000);
    const r = placeOrder(a.state, { symbol: "X.NS", side: "buy", qty: 400, type: "market", product: "intraday" }, 500, T, { intradayClock: T });
    expect(r.error).toBeUndefined();
    const open = { ...a, state: r.state };
    const v = potView(open, { "X.NS": 510 });
    expect(v.marginUsed).toBeCloseTo((400 * 510) / 5);
    expect(v.pnl).toBeGreaterThan(3000);
    const pos = r.state.positions[0];
    const closed = closePosition(r.state, pos.id, pos.qty, 510, T + 600, "manual");
    expect(pnlByDay(closed.state)).toHaveLength(1);
  });
});
