import { describe, it, expect } from "vitest";
import { computeInsights } from "./insights";
import type { ClosedTrade } from "./types";

let id = 0;
const t = (o: Partial<ClosedTrade>): ClosedTrade => ({
  id: ++id, symbol: "ABC", direction: "long", product: "delivery", qty: 10, entryPrice: 100, exitPrice: 100,
  entryTime: 0, exitTime: 1, grossPnl: 0, charges: 0, netPnl: 0, returnPct: 0, reason: "manual", ...o,
});
// A stop-protected loser: 1R = 50 on 1000 deployed (5% stop)
const loss = (o: Partial<ClosedTrade> = {}) => t({ netPnl: -50, returnPct: -5, initialRisk: 50, rMultiple: -1, reason: "stop", maePct: 5, mfePct: 1, ...o });
const gain = (o: Partial<ClosedTrade> = {}) => t({ netPnl: 100, returnPct: 10, initialRisk: 50, rMultiple: 2, reason: "target", maePct: 1, mfePct: 10, ...o });
const many = (n: number, f: () => ClosedTrade) => Array.from({ length: n }, f);

describe("computeInsights", () => {
  it("gives a starter message with no trades and a caution with very few", () => {
    expect(computeInsights({ trades: [] }).tips[0]).toMatch(/Place and close/);
    expect(computeInsights({ trades: [gain(), loss()] }).tips[0]).toMatch(/at least 30/);
  });

  it("computes R statistics and stop usage", () => {
    const i = computeInsights({ trades: [...many(6, gain), ...many(4, loss), ...many(2, () => t({ netPnl: 10, returnPct: 1 }))] });
    expect(i.n).toBe(12);
    expect(i.withStop).toBe(10);
    expect(i.stopUsagePct).toBeCloseTo((10 / 12) * 100);
    expect(i.avgWinR).toBeCloseTo(2);
    expect(i.avgLossR).toBeCloseTo(-1);
    expect(i.avgStopPct).toBeCloseTo(5);
    expect(i.expectancyR).toBeCloseTo((6 * 2 - 4) / 10);
  });

  it("warns when stops are used on too few trades and compares protected vs unprotected", () => {
    const trades = [...many(4, gain), ...many(6, () => t({ netPnl: -80, returnPct: -8 }))];
    const i = computeInsights({ trades });
    expect(i.stopUsagePct).toBe(40);
    expect(i.tips.join(" ")).toMatch(/Only 40% of your trades had a stop-loss/);
    expect(i.tips.join(" ")).toMatch(/without averaged -8\.00%/);
  });

  it("detects losers that had been 1R in profit (gave back winners)", () => {
    const trades = [...many(4, () => loss({ mfePct: 7 })), ...many(2, loss), ...many(6, gain)];
    const i = computeInsights({ trades });
    expect(i.gaveBack).toEqual({ count: 4, of: 6 });
    expect(i.tips.join(" ")).toMatch(/4 of your 6 losing trades were at least 1R in profit/);
  });

  it("flags stops tighter than the typical dip of winners", () => {
    const trades = [...many(7, () => gain({ maePct: 8 })), ...many(3, loss)];
    const i = computeInsights({ trades });
    expect(i.winnersAvgMaePct).toBeCloseTo(8);
    expect(i.tips.join(" ")).toMatch(/stops average 5\.0%/);
  });

  it("flags losses bigger than 1R", () => {
    const trades = [...many(6, () => loss({ rMultiple: -1.6, netPnl: -80 })), ...many(6, gain)];
    expect(computeInsights({ trades }).tips.join(" ")).toMatch(/average loss is -1\.60R/);
  });

  it("reports negative expectancy only with 20+ trades", () => {
    const bad = [...many(14, () => loss()), ...many(6, () => gain({ rMultiple: 0.5, netPnl: 25 }))];
    expect(computeInsights({ trades: bad }).tips.join(" ")).toMatch(/Expectancy is -/);
    expect(computeInsights({ trades: bad.slice(0, 15) }).tips.join(" ")).not.toMatch(/Expectancy is/);
  });

  it("surfaces your worst and best tags", () => {
    const trades = [
      ...many(4, () => loss({ tags: ["FOMO"] })),
      ...many(4, () => gain({ tags: ["Followed plan"] })),
      ...many(3, gain),
    ];
    const tips = computeInsights({ trades }).tips.join(" ");
    expect(tips).toMatch(/tagged "FOMO" lost ₹200 over 4 trades/);
    expect(tips).toMatch(/best tag is "Followed plan"/);
  });

  it("notices manual losses bigger than stop losses", () => {
    const trades = [...many(4, () => loss()), ...many(4, () => t({ netPnl: -150, returnPct: -15, reason: "manual" })), ...many(4, gain)];
    expect(computeInsights({ trades }).tips.join(" ")).toMatch(/closed by hand \(-15\.00% avg\) are bigger/);
  });

  it("praises disciplined, profitable trading", () => {
    const trades = [...many(8, gain), ...many(4, loss)];
    expect(computeInsights({ trades }).tips.join(" ")).toMatch(/Good discipline/);
  });

  it("groups by exit reason, symbol and product", () => {
    const i = computeInsights({ trades: [gain(), loss(), loss({ symbol: "XYZ", product: "intraday" })] });
    expect(i.byExit.find((g) => g.key === "stop")?.n).toBe(2);
    expect(i.bySymbol.map((g) => g.key).sort()).toEqual(["ABC", "XYZ"]);
    expect(i.byProduct.find((g) => g.key === "intraday")?.n).toBe(1);
  });

  it("does not crash on legacy trades without risk fields", () => {
    const i = computeInsights({ trades: many(12, () => t({ netPnl: 5, returnPct: 0.5 })) });
    expect(i.avgWinR).toBeUndefined();
    expect(i.stopUsagePct).toBe(0);
    expect(i.gaveBack).toEqual({ count: 0, of: 0 });
  });
});
