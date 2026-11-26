import { describe, it, expect } from "vitest";
import { compareRuns, parseRun, SavedConfig, summaryFromOptimize, summaryFromScan, type SavedRun, type Summary } from "./saved-backtests";
import { getPreset } from "./engine/presets";
import { analyze } from "./engine/analyze";
import { scanSymbol, summarizeScan } from "./engine/scan";
import { mulberry32 } from "./engine/stats";
import type { Candle } from "@/lib/data/types";

const strategy = getPreset("ema-cross")!.strategy;
function series(seed: number): Candle[] {
  const r = mulberry32(seed);
  let p = 100;
  return Array.from({ length: 900 }, (_, i) => {
    const o = p;
    p = Math.max(5, p * (1 + (r() - 0.49) * 0.03 + Math.sin(i / 20) * 0.004));
    return { time: 1_500_000_000 + i * 86400, open: o, high: Math.max(o, p) * 1.005, low: Math.min(o, p) * 0.995, close: p, volume: 1e5 };
  });
}
const cfg = { mode: "one" as const, symbol: "RELIANCE.NS", years: 5, strategy, slippageBps: 5, zeroBrokerage: true };

describe("SavedConfig", () => {
  it("accepts a full config and rejects nonsense", () => {
    expect(SavedConfig.safeParse(cfg).success).toBe(true);
    expect(SavedConfig.safeParse({ ...cfg, years: 99 }).success).toBe(false);
    expect(SavedConfig.safeParse({ ...cfg, mode: "weird" }).success).toBe(false);
    expect(SavedConfig.safeParse({ ...cfg, strategy: { name: "x" } }).success).toBe(false);
  });
});

describe("summaries", () => {
  it("builds a group summary from a scan", () => {
    const s = summarizeScan([scanSymbol({ symbol: "A.NS" }, series(1), strategy), scanSymbol({ symbol: "B.NS" }, series(2), strategy)]);
    const sum = summaryFromScan(s, "test");
    expect(sum).toMatchObject({ kind: "group", stocks: 2, trades: s.pooled.trades });
    expect(sum.winRateLow! <= sum.winRate! && sum.winRate! <= sum.winRateHigh!).toBe(true);
  });
  it("turns non-finite numbers into null so they save and reload cleanly", () => {
    const a = analyze("X", series(3).slice(0, 80), strategy, undefined, { mcSims: 10 });
    const sum = JSON.parse(JSON.stringify(summaryFromScan(summarizeScan([]), "empty")));
    expect(sum.winRate).toBeNull();
    expect(JSON.stringify(a)).toBeDefined();
  });
  it("describes an optimize run", () => {
    expect(summaryFromOptimize("lbl", "5%", 1.2, 40, 20)).toMatchObject({ kind: "optimize", note: "Recommended 5%", unseenExpectancyPct: 1.2 });
    expect(summaryFromOptimize("lbl", null, null, 0, 1).note).toMatch(/No stable/);
  });
});

describe("compareRuns", () => {
  const run = (id: string, s: Partial<Summary>): SavedRun => ({ id, name: id, createdAt: 0, config: cfg, summary: { kind: "one", label: id, trades: 10, winRate: null, winRateLow: null, winRateHigh: null, expectancyPct: null, profitFactor: null, ...s } });
  it("marks the best run per metric, with lower drawdown being better", () => {
    const r = compareRuns([run("a", { winRate: 0.5, expectancyPct: 1, maxDrawdownPct: 30 }), run("b", { winRate: 0.4, expectancyPct: 2, maxDrawdownPct: 20 })]);
    expect(r).toMatchObject({ winRate: "a", expectancy: "b", drawdown: "b" });
  });
  it("returns null when fewer than two runs have the number", () => {
    const r = compareRuns([run("a", { profitFactor: 1.5 }), run("b", {})]);
    expect(r.profitFactor).toBeNull();
  });
});

describe("parseRun", () => {
  const row = { id: "1", name: "n", created_at: "2026-11-26T10:00:00Z", strategy: { config: cfg }, summary: { kind: "one", label: "x", trades: 3 } };
  it("reads a good row", () => {
    expect(parseRun(row)).toMatchObject({ id: "1", name: "n", config: { symbol: "RELIANCE.NS" } });
  });
  it("skips corrupt or old-format rows instead of throwing", () => {
    expect(parseRun({ ...row, strategy: {} })).toBeNull();
    expect(parseRun({ ...row, strategy: null })).toBeNull();
    expect(parseRun({ ...row, summary: null })).toBeNull();
    expect(parseRun({ ...row, strategy: { config: { ...cfg, years: 500 } } })).toBeNull();
  });
});
