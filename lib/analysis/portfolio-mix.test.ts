import { describe, it, expect } from "vitest";
import { buildMixedPortfolio, type MixInput } from "./portfolio-mix";
import type { StockView } from "./stock-view";

const item = (symbol: string, sector: string, score: number, verdict: StockView["verdict"] = "buy", entry = 100): MixInput => ({
  symbol, name: symbol, sector,
  view: { symbol, price: entry, technical: score, score, verdict, frames: { daily: "up", weekly: "up", monthly: "up" }, ret: { w1: 1, m1: 1, m3: 1, m6: 1 }, rsi: 55, aboveEma50: true, reasons: [],
    plan: { entry, entryKind: "now", stop: entry * 0.95, target1: entry * 1.1, target2: entry * 1.2, riskPct: 5, rewardPct1: 10, rr1: 2, rr2: 4 } },
});

describe("mixed portfolio", () => {
  it("limits names per sector, skips non-buys and keeps a cash reserve", () => {
    const items = [item("A", "Banks", 90), item("B", "Banks", 85), item("C", "Banks", 80), item("D", "IT", 70), item("E", "Auto", 60, "watch"), item("F", "FMCG", 55)];
    const m = buildMixedPortfolio(items, 300000, 1, { maxPerSector: 2, maxNames: 8, reservePct: 10 });
    expect(m.picks.map((p) => p.symbol)).toEqual(["A", "B", "D", "F"]);
    expect(m.invested).toBeLessThanOrEqual(270000);
    expect(m.cash).toBeGreaterThanOrEqual(30000);
    expect(m.sectors.find((s) => s.sector === "Banks")!.names).toBe(2);
  });
  it("sizes each pick to the risk budget", () => {
    const m = buildMixedPortfolio([item("A", "Banks", 90)], 300000, 1);
    expect(m.picks[0].qty).toBe(600); // 3000 risk / 5 per share, within the 20% cap of 60,000
    expect(m.riskIfAllStopped).toBeCloseTo(3000);
    expect(m.rewardIfTarget1).toBeCloseTo(6000);
  });
  it("returns an empty mix when nothing qualifies", () => {
    expect(buildMixedPortfolio([item("A", "Banks", 40, "avoid")], 300000, 1).picks).toHaveLength(0);
  });
});

describe("small-cap cap", () => {
  it("keeps at most two small caps in a mix", () => {
    const items = ["A", "B", "C", "D", "E"].map((s, i) => ({ ...item(s, `Sector${i}`, 90 - i), cap: "small" }));
    expect(buildMixedPortfolio(items, 300000, 1).picks).toHaveLength(2);
    const mixed = [...items, { ...item("L", "SectorL", 50), cap: "large" }];
    expect(buildMixedPortfolio(mixed, 300000, 1).picks.map((p) => p.symbol)).toContain("L");
  });
});
