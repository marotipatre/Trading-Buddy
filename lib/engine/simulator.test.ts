import { describe, it, expect } from "vitest";
import { runBacktest, resolveDistances, sizePosition } from "./simulator";
import { StrategyDef } from "./strategy";
import { DEFAULT_COSTS, type CostConfig } from "./costs";
import type { Candle } from "@/lib/data/types";

const zero: CostConfig = {
  ...DEFAULT_COSTS, brokeragePct: 0, brokerageCap: 0, sttDeliveryPct: 0, sttIntradaySellPct: 0, exchangeTxnPct: 0,
  sebiPct: 0, stampDeliveryBuyPct: 0, stampIntradayBuyPct: 0, dpChargePerSell: 0, slippageBps: 0,
};
const bar = (t: number, o: number, h: number, l: number, c: number): Candle => ({ time: t, open: o, high: h, low: l, close: c, volume: 1000 });

// Entry when close > 100 (fires on the close of bar 1, fill at open of bar 2).
const strat = (extra: object = {}) =>
  StrategyDef.parse({
    name: "t",
    entry: { conditions: [{ left: { kind: "price", field: "close" }, op: ">", right: { kind: "number", value: 100 } }] },
    ...extra,
  });

describe("runBacktest", () => {
  const candles = [
    bar(0, 99, 100, 98, 99),
    bar(1, 100, 103, 99, 102), // signal at close
    bar(2, 105, 106, 104, 105), // fill at 105 open (NOT 102 close)
    bar(3, 105, 112, 105, 110),
  ];

  it("fills at next open, not the signal close", () => {
    const r = runBacktest("X", candles, strat({ maxHoldBars: 1 }), zero);
    expect(r.trades[0].entryPrice).toBe(105);
    expect(r.trades[0].entryIdx).toBe(2);
  });

  it("realises P&L and updates equity", () => {
    const r = runBacktest("X", candles, strat(), zero);
    const t = r.trades[0];
    expect(t.exitReason).toBe("end");
    expect(t.exitPrice).toBe(110);
    expect(t.netPnl).toBeCloseTo((110 - 105) * t.qty);
    expect(r.finalEquity).toBeCloseTo(r.initialCapital + t.netPnl);
    expect(r.equity).toHaveLength(candles.length);
    expect(r.equity.at(-1)!.equity).toBeCloseTo(r.finalEquity);
  });

  it("marks equity to market on open bars", () => {
    const r = runBacktest("X", candles, strat(), zero);
    const q = r.trades[0].qty;
    expect(r.equity[2].equity).toBeCloseTo(r.initialCapital + (105 - 105) * q);
    expect(r.equity[1].equity).toBe(r.initialCapital);
  });

  it("never lets cash go negative and sizes to whole shares", () => {
    const r = runBacktest("X", candles, strat(), DEFAULT_COSTS);
    const t = r.trades[0];
    expect(Number.isInteger(t.qty)).toBe(true);
    expect(t.qty * t.entryPrice).toBeLessThanOrEqual(r.initialCapital);
  });

  it("does not enter on the last bar (no next open)", () => {
    const r = runBacktest("X", [bar(0, 99, 100, 98, 99), bar(1, 100, 103, 99, 102)], strat(), zero);
    expect(r.trades).toHaveLength(0);
  });

  it("does not re-enter on the same bar a position exited", () => {
    const up = [bar(0, 99, 100, 98, 99), bar(1, 100, 103, 99, 102), bar(2, 105, 106, 104, 105), bar(3, 105, 107, 104, 106), bar(4, 106, 108, 105, 107), bar(5, 107, 108, 106, 107)];
    const r = runBacktest("X", up, strat({ maxHoldBars: 1 }), zero);
    for (let k = 1; k < r.trades.length; k++) expect(r.trades[k].entryIdx).toBeGreaterThan(r.trades[k - 1].exitIdx);
  });

  it("records R multiple from the initial stop", () => {
    const r = runBacktest("X", candles, strat({ stopLoss: { type: "percent", value: 5 } }), zero);
    const t = r.trades[0];
    expect(t.rMultiple).toBeCloseTo(t.netPnl / (105 * 0.05 * t.qty));
  });
});

describe("sizing & distances", () => {
  it("risk sizing: qty = risk / stop distance", () => {
    const s = strat({ stopLoss: { type: "percent", value: 5 }, sizing: { type: "risk_percent", value: 1 } });
    // risk = 10,000 on 1,000,000; stop dist = 5 on price 100 => 2000 shares, capped by cash (10,000 shares max)
    expect(sizePosition(s, 1_000_000, 100, 5, zero)).toBe(2000);
  });
  it("returns 0 when cash is insufficient for one share", () => {
    expect(sizePosition(strat(), 50, 100, undefined, zero)).toBe(0);
  });
  it("ATR stops use ATR at the signal bar; rr targets multiply the stop", () => {
    const s = strat({ stopLoss: { type: "atr", value: 2 }, target: { type: "rr", value: 3 } });
    const d = resolveDistances(s, 100, 4);
    expect(d.stopDist).toBe(8);
    expect(d.targetDist).toBe(24);
  });
});
