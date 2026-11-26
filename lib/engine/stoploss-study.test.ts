import { describe, it, expect } from "vitest";
import { stopLossStudy, summarize, type StudyTrade } from "./stoploss-study";
import { StrategyDef } from "./strategy";
import { DEFAULT_COSTS, type CostConfig } from "./costs";
import type { Candle } from "@/lib/data/types";

const zero: CostConfig = {
  ...DEFAULT_COSTS, brokeragePct: 0, brokerageCap: 0, sttDeliveryPct: 0, sttIntradaySellPct: 0, exchangeTxnPct: 0,
  sebiPct: 0, stampDeliveryBuyPct: 0, stampIntradayBuyPct: 0, dpChargePerSell: 0, slippageBps: 0,
};
const bar = (o: number, h: number, l: number, c: number): Candle => ({ time: 0, open: o, high: h, low: l, close: c, volume: 1 });
const flat = (n: number) => Array.from({ length: n }, () => bar(100, 100.5, 99.5, 100));
const strat = (stopPct?: number) =>
  StrategyDef.parse({
    name: "t",
    entry: { conditions: [{ left: { kind: "price", field: "close" }, op: ">", right: { kind: "number", value: 0 } }] },
    maxHoldBars: 8,
    ...(stopPct ? { stopLoss: { type: "percent", value: stopPct } } : {}),
  });

// Dips 6% on the entry bar, then recovers to +15%.
const dipThenRecover = (): Candle[] => {
  const c = [...flat(6), bar(100, 101, 94, 101)];
  let p = 101;
  for (let i = 0; i < 9; i++) { c.push(bar(p, p + 2.5, p - 0.5, p + 2)); p += 2; }
  return c;
};
// Slides steadily from 100 to ~70.
const crash = (): Candle[] => {
  const c = [...flat(6), bar(100, 100.5, 99, 98)];
  let p = 98;
  for (let i = 0; i < 9; i++) { c.push(bar(p, p + 0.2, p - 3.2, p - 3)); p -= 3; }
  return c;
};

describe("stopLossStudy", () => {
  it("a too-tight stop kills a trade that would have recovered", () => {
    const s = stopLossStudy(dipThenRecover(), strat(3), [5], zero);
    expect(s.none.totalPnl).toBeGreaterThan(0);
    expect(s.user!.totalPnl).toBeLessThan(0);
    expect(s.impact).toMatchObject({ stoppedTrades: 1, wouldHaveRecovered: 1 });
    expect(s.impact!.profitForgone).toBeGreaterThan(0);
    expect(s.verdict).toContain("costing more than it protects");
    expect(s.winnersMaeP90).toBeCloseTo(6, 0);
  });

  it("a stop in a crash saves money and is judged helpful", () => {
    const s = stopLossStudy(crash(), strat(5), [5], zero);
    expect(s.user!.totalPnl).toBeGreaterThan(s.none.totalPnl);
    expect(s.impact!.lossSaved).toBeGreaterThan(0);
    expect(s.impact!.wouldHaveRecovered).toBe(0);
    expect(s.verdict).toContain("the stop is helping");
    expect(s.user!.worstTradePct).toBeGreaterThan(s.none.worstTradePct);
  });

  it("without a user stop it reports the no-stop baseline and still builds the grid", () => {
    const s = stopLossStudy(crash(), strat(), [5], zero);
    expect(s.user).toBeNull();
    expect(s.impact).toBeNull();
    expect(s.grid).toHaveLength(12);
    expect(s.verdict).toContain("No stop-loss is defined");
  });

  it("warns about tiny samples", () => {
    const s = stopLossStudy(crash(), strat(5), [5], zero);
    expect(s.caveats[0]).toContain("Only 1 entries");
  });

  it("ignores entries with no next bar", () => {
    const c = crash();
    expect(stopLossStudy(c, strat(5), [c.length - 1], zero).entries).toBe(0);
  });
});

describe("summarize", () => {
  const t = (exitIdx: number, pnl: number): StudyTrade => ({
    entryIdx: 0, exitIdx, returnPct: pnl / 10, pnl, reason: "signal", maePct: 0, mfePct: 0,
  });
  it("computes drawdown over exit-ordered cumulative P&L", () => {
    const s = summarize("x", null, [t(1, 100), t(2, -300), t(3, 50)], 1000);
    expect(s.maxDrawdownPct).toBeCloseTo((300 / 1100) * 100);
    expect(s.totalPnl).toBe(-150);
    expect(s.winRate).toBeCloseTo(2 / 3);
    expect(s.profitFactor).toBeCloseTo(150 / 300);
  });
});
