import { describe, it, expect } from "vitest";
import { paperMetrics, toEngineTrade } from "./analytics";
import { newAccount } from "./broker";
import type { ClosedTrade } from "./types";

const t = (id: number, netPnl: number, reason: ClosedTrade["reason"] = "manual"): ClosedTrade => ({
  id, symbol: "ABC", direction: "long", product: "delivery", qty: 10, entryPrice: 100, exitPrice: 100 + netPnl / 10,
  entryTime: id * 86400, exitTime: (id + 3) * 86400, grossPnl: netPnl, charges: 0, netPnl, returnPct: netPnl / 10, reason,
});

describe("paper analytics", () => {
  it("maps close reasons and holding days", () => {
    const e = toEngineTrade(t(1, 50, "stop"));
    expect(e.exitReason).toBe("stop");
    expect(e.barsHeld).toBe(3);
    expect(toEngineTrade(t(1, 50, "squareoff")).exitReason).toBe("signal");
  });
  it("computes win rate and expectancy from the journal", () => {
    const s = { ...newAccount(100000), trades: [t(1, 100), t(2, -50), t(3, 200), t(4, -50)] };
    const m = paperMetrics(s);
    expect(m.trades).toBe(4);
    expect(m.winRate).toBe(0.5);
    expect(m.profitFactor).toBeCloseTo(3);
    expect(m.lowSample).toBe(true);
  });
  it("is safe with an empty journal", () => {
    const m = paperMetrics(newAccount(100000));
    expect(m.trades).toBe(0);
    expect(m.winRate).toBeNaN();
  });
});
