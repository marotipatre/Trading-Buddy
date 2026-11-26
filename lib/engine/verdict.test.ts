import { describe, it, expect } from "vitest";
import { explainAnalysis } from "./verdict";
import type { Analysis } from "./analyze";

const metrics = (o: Record<string, unknown> = {}) => ({ trades: 80, wins: 40, losses: 40, winRate: 0.5, winRateCI: [0.39, 0.61], avgWinPct: 6, avgLossPct: -3, payoffRatio: 2, profitFactor: 1.8, expectancyPct: 1.5, expectancyR: 0.4, totalReturnPct: 120, cagrPct: 15, maxDrawdownPct: 18, sharpe: 1, maxConsecutiveLosses: 6, avgBarsHeld: 9, totalCharges: 1000, exitReasons: {}, lowSample: false, ...o });
const an = (m: Record<string, unknown>, o: Partial<Analysis> = {}, oos?: { inE: number; outE: number; outTrades: number }): Analysis => ({
  symbol: "X", metrics: metrics(m), buyHoldReturnPct: 80, warnings: [], monteCarlo: null, stopStudy: {} as never, result: {} as never,
  outOfSample: oos ? { splitTime: 0, inSample: metrics({ expectancyPct: oos.inE }), outSample: metrics({ expectancyPct: oos.outE, trades: oos.outTrades }) } : null, ...o,
} as unknown as Analysis);

describe("explainAnalysis", () => {
  it("says promising when it makes money, holds up later and beats holding", () => {
    const v = explainAnalysis(an({}, {}, { inE: 1.6, outE: 1.2, outTrades: 20 }));
    expect(v.tone).toBe("good");
    expect(v.points.join(" ")).toContain("beat holding");
    expect(v.points.join(" ")).toContain("still");
  });
  it("is mixed when holding did better, and warns when the edge vanished later", () => {
    expect(explainAnalysis(an({ totalReturnPct: 40 }, {}, { inE: 1.6, outE: 1.2, outTrades: 20 })).tone).toBe("mixed");
    const v = explainAnalysis(an({}, {}, { inE: 1.6, outE: -0.8, outTrades: 20 }));
    expect(v.tone).toBe("mixed");
    expect(v.headline).toContain("Worked early");
  });
  it("is bad on a losing strategy and thin on a small sample or no trades", () => {
    expect(explainAnalysis(an({ expectancyPct: -0.7, profitFactor: 0.8 })).tone).toBe("bad");
    expect(explainAnalysis(an({ trades: 12, lowSample: true })).tone).toBe("thin");
    expect(explainAnalysis(an({ trades: 0 })).tone).toBe("thin");
  });
});
