import { describe, it, expect } from "vitest";
import { periodOf, periodStats } from "./periods";
import type { EquityPoint, Trade } from "./types";

const d = (s: string) => Date.parse(s + "T10:00:00Z") / 1000;
const eq = (pairs: [string, number][]): EquityPoint[] => pairs.map(([t, equity]) => ({ time: d(t), equity }));
const trade = (exit: string, netPnl: number) => ({ exitTime: d(exit), netPnl }) as Trade;

describe("period stats", () => {
  const equity = eq([["2026-01-05", 100], ["2026-01-30", 110], ["2026-02-10", 99], ["2026-02-27", 108.9], ["2026-03-10", 108.9]]);
  it("measures each month from the previous month's end", () => {
    const s = periodStats(equity, [], "month", 100);
    expect(s.rows.map((r) => r.label)).toEqual(["Jan 2026", "Feb 2026", "Mar 2026"]);
    expect(s.rows[0].returnPct).toBeCloseTo(10);
    expect(s.rows[1].returnPct).toBeCloseTo(-1); // 110 -> 108.9
    expect(s.rows[2].returnPct).toBeCloseTo(0);
    expect(s.profitable).toBe(1);
    expect(s.best?.label).toBe("Jan 2026");
    expect(s.worst?.label).toBe("Feb 2026");
  });
  it("counts trades closed in each period and months that hit the target", () => {
    const s = periodStats(equity, [trade("2026-01-20", 5), trade("2026-01-28", -2), trade("2026-02-15", 3)], "month", 100, 10);
    expect(s.rows[0]).toMatchObject({ trades: 2, wins: 1, pnl: 3 });
    expect(s.rows[1].trades).toBe(1);
    expect(s.hitTarget).toBe(1);
    expect(s.avgTrades).toBeCloseTo(1);
  });
  it("buckets weeks starting Monday", () => {
    expect(periodOf(d("2026-11-23"), "week").key).toBe(periodOf(d("2026-11-29"), "week").key); // Mon and Sun
    expect(periodOf(d("2026-11-29"), "week").key).not.toBe(periodOf(d("2026-11-30"), "week").key);
  });
  it("handles an empty run", () => {
    const s = periodStats([], [], "month", 100);
    expect(s.periods).toBe(0);
    expect(s.best).toBeNull();
  });
});
