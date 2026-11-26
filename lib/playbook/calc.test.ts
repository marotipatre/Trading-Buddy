import { describe, it, expect } from "vitest";
import { expectancy, intradayBreakEven, positionSize, recoveryNeeded, streakProbability } from "./calc";

describe("playbook calculators", () => {
  it("sizes a position by risk and shows margin", () => {
    const s = positionSize(100000, 1, 500, 495, 5);
    expect(s.qty).toBe(200);
    expect(s.riskAmt).toBe(1000);
    expect(s.notional).toBe(100000);
    expect(s.margin).toBe(20000);
    expect(s.perSharePct).toBeCloseTo(1);
    expect(positionSize(100000, 1, 500, 500).qty).toBe(0);
  });
  it("computes expectancy, break-even win rate and profit factor", () => {
    const e = expectancy(0.4, 2, 1);
    expect(e.perTrade).toBeCloseTo(0.2);
    expect(e.breakEvenWinRate).toBeCloseTo(1 / 3);
    expect(e.profitFactor).toBeCloseTo(1.333, 2);
    expect(expectancy(0.7, 0.3, 1).perTrade).toBeCloseTo(-0.09);
  });
  it("streak probability matches known cases", () => {
    expect(streakProbability(0.5, 2, 2)).toBeCloseTo(0.25);
    expect(streakProbability(0.5, 3, 2)).toBeCloseTo(0.375); // HH, HHx, xHH out of 8: 3/8
    expect(streakProbability(0.5, 100, 5)).toBeGreaterThan(0.75);
    expect(streakProbability(0.5, 100, 5)).toBeLessThan(0.85);
    expect(streakProbability(0.5, 3, 5)).toBe(0);
    expect(streakProbability(1, 5, 3)).toBeCloseTo(1);
  });
  it("recovery needed after a loss", () => {
    expect(recoveryNeeded(10)).toBeCloseTo(11.11, 1);
    expect(recoveryNeeded(50)).toBeCloseTo(100);
    expect(recoveryNeeded(100)).toBe(Infinity);
  });
  it("intraday break-even includes charges and slippage", () => {
    const a = intradayBreakEven(500, 200);
    expect(a.charges).toBeGreaterThan(0);
    expect(a.breakEvenPct).toBeGreaterThan(0.02);
    expect(a.breakEvenPct).toBeLessThan(0.2);
    expect(intradayBreakEven(500, 200, undefined, 5).total).toBeGreaterThan(a.total);
    expect(intradayBreakEven(0, 1).total).toBe(0);
  });
});
