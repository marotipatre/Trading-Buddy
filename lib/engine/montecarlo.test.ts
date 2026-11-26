import { describe, it, expect } from "vitest";
import { monteCarlo, equityReturns } from "./montecarlo";
import type { Trade } from "./types";

describe("monteCarlo", () => {
  it("returns null for no trades", () => {
    expect(monteCarlo([])).toBeNull();
  });
  it("all-winning trades: always profit, never ruin, zero drawdown", () => {
    const r = monteCarlo(new Array(10).fill(0.02), { sims: 500 })!;
    expect(r.probProfit).toBe(1);
    expect(r.probRuin).toBe(0);
    expect(r.maxDrawdownPct.p95).toBe(0);
    expect(r.returnPct.p50).toBeCloseTo((1.02 ** 10 - 1) * 100, 6);
  });
  it("all-losing trades: never profit", () => {
    const r = monteCarlo(new Array(10).fill(-0.05), { sims: 500 })!;
    expect(r.probProfit).toBe(0);
    expect(r.returnPct.p95).toBeLessThan(0);
  });
  it("is reproducible for the same seed and differs across seeds", () => {
    const rs = [0.05, -0.03, 0.02, -0.04, 0.06, -0.01, 0.03, -0.05, 0.04, 0.01];
    expect(monteCarlo(rs, { seed: 7 })).toEqual(monteCarlo(rs, { seed: 7 }));
    expect(monteCarlo(rs, { seed: 7 })!.returnPct.p5).not.toBe(monteCarlo(rs, { seed: 8 })!.returnPct.p5);
  });
  it("a positive-expectancy edge has a high but not certain profit probability", () => {
    const rs = [0.1, 0.1, 0.1, -0.05, -0.05, -0.05, -0.05];
    const r = monteCarlo(rs, { sims: 2000 })!;
    expect(r.probProfit).toBeGreaterThan(0.5);
    expect(r.returnPct.p5).toBeLessThan(r.returnPct.p95);
  });
  it("equityReturns divides P&L by equity before each trade", () => {
    const t = (netPnl: number) => ({ netPnl }) as Trade;
    const r = equityReturns([t(100), t(-110)], 1000);
    expect(r[0]).toBeCloseTo(0.1);
    expect(r[1]).toBeCloseTo(-110 / 1100);
  });
});
