import { describe, it, expect } from "vitest";
import { poolTrades, sampleEvenly, scanSymbol, summarizeScan } from "./scan";
import { getPreset } from "./presets";
import { mulberry32 } from "./stats";
import type { Candle } from "@/lib/data/types";
import type { Trade } from "./types";

function series(seed: number, n = 900, drift = 0): Candle[] {
  const rand = mulberry32(seed);
  let p = 100;
  return Array.from({ length: n }, (_, i) => {
    const o = p;
    p = Math.max(5, p * (1 + (rand() - 0.49 + drift) * 0.03 + Math.sin(i / 20) * 0.004));
    return { time: 1_500_000_000 + i * 86400, open: o, high: Math.max(o, p) * 1.005, low: Math.min(o, p) * 0.995, close: p, volume: 1e5 };
  });
}
const t = (returnPct: number, netPnl = returnPct * 10): Trade => ({ returnPct, netPnl } as Trade);

describe("poolTrades", () => {
  it("computes win rate, its confidence range, expectancy and profit factor", () => {
    const p = poolTrades([t(10), t(5), t(-5), t(-5)]);
    expect(p).toMatchObject({ trades: 4, wins: 2, winRate: 0.5 });
    expect(p.expectancyPct).toBeCloseTo(1.25);
    expect(p.avgWinPct).toBeCloseTo(7.5);
    expect(p.avgLossPct).toBeCloseTo(-5);
    expect(p.profitFactor).toBeCloseTo(150 / 100);
    expect(p.winRateCI[0]).toBeLessThan(0.5);
    expect(p.winRateCI[1]).toBeGreaterThan(0.5);
  });
  it("is safe with no trades and with only winners", () => {
    expect(poolTrades([]).winRate).toBeNaN();
    expect(poolTrades([t(5)]).profitFactor).toBe(Infinity);
  });
});

describe("sampleEvenly", () => {
  it("spreads picks through the list and is deterministic", () => {
    const l = Array.from({ length: 100 }, (_, i) => i);
    expect(sampleEvenly(l, 4)).toEqual([0, 25, 50, 75]);
    expect(sampleEvenly(l, 4)).toEqual(sampleEvenly(l, 4));
  });
  it("handles n larger than the list and non-positive n", () => {
    expect(sampleEvenly([1, 2, 3], 10)).toEqual([1, 2, 3]);
    expect(sampleEvenly([1, 2, 3], 0)).toEqual([]);
  });
});

describe("scanSymbol and summarizeScan", () => {
  const strat = getPreset("ema-cross")!.strategy;
  const rows = [
    scanSymbol({ symbol: "A.NS", sector: "IT", cap: "large" }, series(1), strat),
    scanSymbol({ symbol: "B.NS", sector: "IT", cap: "large" }, series(2), strat),
    scanSymbol({ symbol: "C.NS", sector: "Auto", cap: "mid" }, series(3), strat),
  ];
  const s = summarizeScan(rows);

  it("runs each stock independently and keeps its trades", () => {
    expect(rows.every((r) => r.bars === 900)).toBe(true);
    expect(rows.reduce((a, r) => a + r.trades.length, 0)).toBe(s.pooled.trades);
    expect(s.symbols).toBe(3);
  });
  it("splits each stock's trades at 70% of its own history, with no overlap", () => {
    expect(s.inSample.trades + s.outSample.trades).toBe(s.pooled.trades);
  });
  it("groups results by sector and by size class", () => {
    expect(s.bySector.map((g) => [g.key, g.symbols])).toEqual([["IT", 2], ["Auto", 1]]);
    expect(s.byCap.find((g) => g.key === "large")?.symbols).toBe(2);
    expect(s.bySector.reduce((a, g) => a + g.trades, 0)).toBe(s.pooled.trades);
  });
  it("compares with buy and hold and reports shares between 0 and 1", () => {
    for (const x of [s.profitableShare, s.beatBuyHoldShare]) expect(x >= 0 && x <= 1).toBe(true);
    expect(Number.isFinite(s.medianBuyHoldPct)).toBe(true);
  });
  it("sums the stop-loss effect across stocks that have a stop", () => {
    expect(s.stop).not.toBeNull();
    expect(s.stop!.stocks).toBe(3);
    expect(s.stop!.helped).toBeLessThanOrEqual(3);
    expect(Number.isFinite(s.stop!.totalNone + s.stop!.totalUser)).toBe(true);
  });
  it("warns about small groups and few trades", () => {
    expect(s.warnings.join(" ")).toMatch(/Only 3 stocks/);
  });
  it("has no stop summary when the strategy has no stop", () => {
    const noStop = { ...strat, stopLoss: undefined };
    const r = scanSymbol({ symbol: "A.NS" }, series(1), noStop);
    expect(r.stop).toBeNull();
    expect(summarizeScan([r]).stop).toBeNull();
  });
  it("copes with an empty scan", () => {
    const e = summarizeScan([]);
    expect(e.symbols).toBe(0);
    expect(e.pooled.trades).toBe(0);
    expect(e.profitableShare).toBeNaN();
  });
});
