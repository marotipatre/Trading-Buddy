import { describe, it, expect, vi } from "vitest";
import { APP_OPEN_GRACE_SEC, inWatchWindow, meaningful, processAccount, runWatcher, type AccountRow, type AlertRow, type WatchData, type WatchStore } from "./watcher";
import { newAccount, placeOrder } from "@/lib/paper/broker";
import { DEFAULT_COSTS } from "@/lib/engine/costs";
import type { PaperState, OrderRequest } from "@/lib/paper/types";
import type { Quote } from "@/lib/data/types";

const zero = { ...DEFAULT_COSTS, brokeragePct: 0, brokerageCap: 0, sttDeliveryPct: 0, sttIntradaySellPct: 0, exchangeTxnPct: 0, sebiPct: 0, stampDeliveryBuyPct: 0, stampIntradayBuyPct: 0, dpChargePerSell: 0, slippageBps: 0 };
const req = (o: Partial<OrderRequest> = {}): OrderRequest => ({ symbol: "A.NS", side: "buy", qty: 10, type: "market", product: "delivery", ...o });
const q = (symbol: string, price: number, time = 0): Quote => ({ symbol, price, prevClose: price, change: 0, changePct: 0, dayHigh: price, dayLow: price, marketState: "", time });
const at = (y: number, m: number, d: number, h: number, mi: number) => Date.UTC(y, m, d, h, mi) / 1000 - 19800;
const NOW = at(2026, 2, 10, 11, 0); // Tuesday 11:00 IST

/** A position bought at 100 a few minutes before NOW, with a take-profit order resting at 110. */
function accountWithTakeProfit(): PaperState {
  let s = placeOrder(newAccount(100000, zero), req(), 100, NOW - 3600).state;
  s = placeOrder(s, req({ side: "sell", type: "limit", limitPrice: 110 }), 100, NOW - 3500).state;
  return s;
}

function fakes(rows: AccountRow[], alerts: AlertRow[] = [], opts: { saveOk?: boolean } = {}) {
  const saved: { id: string; state: PaperState; expected: string }[] = [];
  const triggered: { id: string; price: number }[] = [];
  const store: WatchStore = {
    listAccounts: async () => rows,
    saveAccount: vi.fn(async (id, state, expected) => { saved.push({ id, state, expected }); return opts.saveOk ?? true; }),
    listActiveAlerts: async () => alerts,
    markAlertTriggered: async (id, price) => { triggered.push({ id, price }); },
  };
  return { store, saved, triggered };
}
const data = (price: number, bars: { time: number; open: number; high: number; low: number; close: number }[] = []): WatchData => ({
  quotes: async (symbols) => symbols.map((s) => q(s, price, NOW)),
  bars: async () => bars,
});
const old = new Date((NOW - 3600) * 1000).toISOString();

describe("inWatchWindow", () => {
  it("covers weekday market hours with a margin and nothing else", () => {
    expect(inWatchWindow(at(2026, 2, 10, 9, 0))).toBe(true);
    expect(inWatchWindow(at(2026, 2, 10, 16, 30))).toBe(true);
    expect(inWatchWindow(at(2026, 2, 10, 8, 59))).toBe(false);
    expect(inWatchWindow(at(2026, 2, 10, 17, 0))).toBe(false);
    expect(inWatchWindow(at(2026, 2, 14, 11, 0))).toBe(false); // Saturday
  });
});

describe("processAccount", () => {
  it("fills a take-profit that was touched by a bar while nobody was watching", async () => {
    const s = await processAccount(accountWithTakeProfit(), data(105, [{ time: NOW - 1800, open: 104, high: 112, low: 103, close: 108 }]), NOW);
    expect(s.positions).toHaveLength(0);
    expect(s.trades[0]).toMatchObject({ reason: "target", exitPrice: 110 });
    expect(s.events!.at(-1)!.text).toMatch(/Take-profit order executed: sold 10 A @ 110\.00/);
  });
  it("leaves everything alone when the price never reached the order", async () => {
    const before = accountWithTakeProfit();
    const s = await processAccount(before, data(103, [{ time: NOW - 1800, open: 102, high: 106, low: 101, close: 103 }]), NOW);
    expect(s.positions).toHaveLength(1);
    expect(s.orders).toHaveLength(1);
  });
  it("uses the live price for the bar that is still forming", async () => {
    const s = await processAccount(accountWithTakeProfit(), data(111), NOW);
    expect(s.trades).toHaveLength(1);
  });
  it("survives missing candles and still applies the live price", async () => {
    const d: WatchData = { quotes: async (x) => x.map((sym) => q(sym, 112, NOW)), bars: async () => { throw new Error("no candles"); } };
    expect((await processAccount(accountWithTakeProfit(), d, NOW)).trades).toHaveLength(1);
  });
  it("expires old day orders and squares off intraday positions from a previous day", async () => {
    let s = placeOrder(newAccount(100000, zero), req({ product: "intraday" }), 100, NOW - 86400 - 3600).state; // yesterday
    s = await processAccount(s, data(101), NOW);
    expect(s.positions).toHaveLength(0);
    expect(s.trades[0].reason).toBe("squareoff");
  });
  it("does nothing for an account with no positions or orders", async () => {
    const s = newAccount(1000, zero);
    expect(await processAccount(s, data(1), NOW)).toMatchObject({ cash: 1000, positions: [], orders: [] });
  });
});

describe("runWatcher", () => {
  const idle: AccountRow = { id: "acct-1", state: accountWithTakeProfit(), updatedAt: old };

  it("saves a changed account using the row's updated_at as the guard", async () => {
    const { store, saved } = fakes([idle]);
    const sum = await runWatcher(store, data(115), NOW);
    expect(sum).toMatchObject({ accounts: 1, changedAccounts: 1, conflicts: 0, skippedOpenApp: 0 });
    expect(sum.newEvents).toBe(1);
    expect(saved[0].expected).toBe(old);
    expect(saved[0].state.trades).toHaveLength(1);
  });
  it("skips accounts the open app is looking after", async () => {
    const fresh = { ...idle, updatedAt: new Date((NOW - APP_OPEN_GRACE_SEC + 10) * 1000).toISOString() };
    const { store, saved } = fakes([fresh]);
    const sum = await runWatcher(store, data(115), NOW);
    expect(sum.skippedOpenApp).toBe(1);
    expect(saved).toHaveLength(0);
  });
  it("does not write when nothing changed", async () => {
    const { store, saved } = fakes([idle]);
    const sum = await runWatcher(store, data(103), NOW);
    expect(sum.changedAccounts).toBe(0);
    expect(saved).toHaveLength(0);
  });
  it("counts a conflict instead of overwriting when the row changed underneath it", async () => {
    const { store } = fakes([idle], [], { saveOk: false });
    const sum = await runWatcher(store, data(115), NOW);
    expect(sum).toMatchObject({ conflicts: 1, changedAccounts: 0 });
  });
  it("triggers price alerts that were hit", async () => {
    const { store, triggered } = fakes([], [{ id: "a1", symbol: "A.NS", direction: "above", price: 110 }, { id: "a2", symbol: "A.NS", direction: "below", price: 90 }]);
    const sum = await runWatcher(store, data(112), NOW);
    expect(sum.alertsTriggered).toBe(1);
    expect(triggered).toEqual([{ id: "a1", price: 112 }]);
  });
  it("one failing account does not stop the others", async () => {
    const bad: AccountRow = { id: "bad", state: accountWithTakeProfit(), updatedAt: old };
    const good: AccountRow = { id: "good", state: accountWithTakeProfit(), updatedAt: old };
    let n = 0;
    const d: WatchData = { quotes: async (s) => { if (n++ === 0) throw new Error("boom"); return s.map((x) => q(x, 115, NOW)); }, bars: async () => [] };
    const { store, saved } = fakes([bad, good]);
    const sum = await runWatcher(store, d, NOW);
    expect(sum.errors[0]).toMatch(/boom/);
    expect(saved.map((x) => x.id)).toEqual(["good"]);
  });
});

describe("meaningful", () => {
  it("ignores internal bookkeeping but notices fills, moved stops and cash", async () => {
    const a = accountWithTakeProfit();
    const bookkeeping = { ...a, positions: a.positions.map((p) => ({ ...p, lastCheckedAt: p.lastCheckedAt + 500, best: p.best + 3, worst: 1 })) };
    expect(meaningful(bookkeeping)).toBe(meaningful(a));
    expect(meaningful({ ...a, positions: a.positions.map((p) => ({ ...p, stop: 95 })) })).not.toBe(meaningful(a));
    expect(meaningful({ ...a, cash: a.cash + 1 })).not.toBe(meaningful(a));
    expect(meaningful(await processAccount(a, data(115), NOW))).not.toBe(meaningful(a));
  });
});
