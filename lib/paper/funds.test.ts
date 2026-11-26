import { describe, it, expect } from "vitest";
import { addMoney, bankOf, capitalOf, normalizeState, tradingPnl, transferMoney, validateAmount, withdrawMoney } from "./funds";
import { equity, newAccount, placeOrder } from "./broker";
import { recordEquity } from "./journal";
import { DEFAULT_COSTS } from "@/lib/engine/costs";

const zero = { ...DEFAULT_COSTS, brokeragePct: 0, brokerageCap: 0, sttDeliveryPct: 0, sttIntradaySellPct: 0, exchangeTxnPct: 0, sebiPct: 0, stampDeliveryBuyPct: 0, stampIntradayBuyPct: 0, dpChargePerSell: 0, slippageBps: 0 };
const ok = (r: { state: ReturnType<typeof newAccount>; error?: string }) => { expect(r.error).toBeUndefined(); return r.state; };

describe("validateAmount", () => {
  it("accepts normal rupee amounts and rejects nonsense", () => {
    expect(validateAmount(5000)).toBeUndefined();
    expect(validateAmount(10.5)).toBeUndefined();
    for (const bad of [0, -5, NaN, Infinity, 1e12]) expect(validateAmount(bad)).toBeDefined();
    expect(validateAmount(1.005)).toMatch(/2 decimal/);
  });
});

describe("pots", () => {
  it("a new account has a trading pot and an empty bank pot", () => {
    const s = newAccount(100000, zero, 25000);
    expect(s.cash).toBe(100000);
    expect(bankOf(s)).toBe(25000);
    expect(capitalOf(s)).toBe(100000);
  });
  it("adding money to the trading pot raises cash AND capital (so it is not counted as profit)", () => {
    let s = newAccount(100000, zero);
    s = ok(addMoney(s, "trading", 50000, 1));
    expect(s.cash).toBe(150000);
    expect(capitalOf(s)).toBe(150000);
    expect(tradingPnl(s, equity(s, {})).pnl).toBe(0);
  });
  it("adding money to the bank pot leaves trading untouched", () => {
    const s = ok(addMoney(newAccount(100000, zero), "bank", 40000, 1));
    expect(bankOf(s)).toBe(40000);
    expect(s.cash).toBe(100000);
    expect(capitalOf(s)).toBe(100000);
  });
  it("bank -> trading moves money and increases trading capital", () => {
    let s = ok(addMoney(newAccount(100000, zero), "bank", 40000, 1));
    s = ok(transferMoney(s, "bank", 15000, 2));
    expect(bankOf(s)).toBe(25000);
    expect(s.cash).toBe(115000);
    expect(capitalOf(s)).toBe(115000);
  });
  it("trading -> bank only moves free cash and lowers trading capital", () => {
    let s = newAccount(100000, zero);
    const r = placeOrder(s, { symbol: "A", side: "buy", qty: 800, type: "market", product: "delivery" }, 100, 1);
    s = r.state; // 80,000 invested, 20,000 free
    expect(transferMoney(s, "trading", 30000, 2).error).toMatch(/free cash/);
    s = ok(transferMoney(s, "trading", 20000, 2));
    expect(s.cash).toBe(0);
    expect(bankOf(s)).toBe(20000);
    expect(capitalOf(s)).toBe(80000);
  });
  it("cannot overdraw either pot", () => {
    const s = newAccount(1000, zero, 500);
    expect(transferMoney(s, "bank", 501, 1).error).toMatch(/Bank balance is ₹500/);
    expect(withdrawMoney(s, "bank", 501, 1).error).toBeDefined();
    expect(withdrawMoney(s, "trading", 1001, 1).error).toBeDefined();
  });
  it("withdrawing from trading lowers capital so it is not counted as a loss", () => {
    const s = ok(withdrawMoney(newAccount(100000, zero), "trading", 30000, 1));
    expect(s.cash).toBe(70000);
    expect(capitalOf(s)).toBe(70000);
    expect(tradingPnl(s, equity(s, {})).pnl).toBe(0);
  });
  it("profit and loss are measured against capital put in, across deposits", () => {
    let s = newAccount(100000, zero);
    s = placeOrder(s, { symbol: "A", side: "buy", qty: 100, type: "market", product: "delivery" }, 100, 1).state; // 10,000 invested
    s = ok(addMoney(s, "trading", 100000, 2)); // deposit mid-trade
    const mark = equity(s, { A: 110 }); // +1,000 on the position
    const { pnl, pct } = tradingPnl(s, mark);
    expect(pnl).toBeCloseTo(1000);
    expect(pct).toBeCloseTo(0.5);
  });
  it("money moves are logged with ids and capped in length", () => {
    let s = newAccount(100000, zero);
    s = ok(addMoney(s, "bank", 100, 1));
    s = ok(withdrawMoney(s, "bank", 50, 2));
    expect(s.transfers!.map((t) => t.type)).toEqual(["deposit", "withdraw"]);
    expect(new Set(s.transfers!.map((t) => t.id)).size).toBe(2);
    for (let i = 0; i < 600; i++) s = ok(addMoney(s, "bank", 1, 10 + i));
    expect(s.transfers!.length).toBe(500);
  });
  it("rounds to paise and rejects bad amounts without changing state", () => {
    const s = newAccount(1000, zero);
    expect(addMoney(s, "bank", -1, 1)).toEqual({ state: s, error: expect.any(String) });
    expect(bankOf(ok(addMoney(s, "bank", 10.25, 1)))).toBe(10.25);
  });
  it("normalizeState upgrades legacy accounts without changing balances", () => {
    const legacy = { ...newAccount(50000, zero), bank: undefined, tradingCapital: undefined, transfers: undefined };
    const n = normalizeState(legacy);
    expect(n.bank).toBe(0);
    expect(n.tradingCapital).toBe(50000);
    expect(n.cash).toBe(50000);
    expect(normalizeState(n)).toEqual(n);
  });
  it("equity history records the capital at that moment", () => {
    let s = newAccount(100000, zero);
    s = recordEquity(s, 100000, 1000, { force: true });
    s = ok(addMoney(s, "trading", 50000, 1100));
    s = recordEquity(s, 150000, 2000, { force: true });
    expect(s.equityHistory!.map((p) => p.capital)).toEqual([100000, 150000]);
  });
});
