import { describe, it, expect } from "vitest";
import { graduation } from "./graduation";
import type { ClosedTrade } from "@/lib/paper/types";

const t = (i: number, o: Partial<ClosedTrade> = {}): ClosedTrade => ({ id: i, symbol: "X.NS", direction: "long", product: "delivery", qty: 1, entryPrice: 100, exitPrice: 102, entryTime: 0, exitTime: 1, grossPnl: 2, charges: 0, netPnl: 2, returnPct: 1, reason: "manual", initialRisk: 1, rMultiple: 1, tags: ["Followed plan"], ...o });
describe("graduation checklist", () => {
  it("is not ready with few trades, and shows progress", () => {
    const g = graduation(Array.from({ length: 20 }, (_, i) => t(i)));
    expect(g.ready).toBe(false);
    expect(g.criteria[0].progress).toBeCloseTo(0.4);
    expect(g.criteria[0].met).toBe(false);
  });
  it("is ready when every habit and number is met", () => {
    const g = graduation(Array.from({ length: 60 }, (_, i) => t(i)));
    expect(g.ready).toBe(true);
    expect(g.metCount).toBe(6);
  });
  it("fails on mistakes, missing stops, losing average and a big loss", () => {
    const base = Array.from({ length: 60 }, (_, i) => t(i));
    expect(graduation(base.map((x, i) => (i % 3 ? x : { ...x, tags: ["Revenge trade"] }))).criteria[2].met).toBe(false);
    expect(graduation(base.map((x) => ({ ...x, initialRisk: undefined }))).criteria[3].met).toBe(false);
    expect(graduation(base.map((x) => ({ ...x, returnPct: -0.5 }))).criteria[1].met).toBe(false);
    expect(graduation([...base, t(99, { rMultiple: -3 })]).criteria[5].met).toBe(false);
  });
  it("handles an empty journal", () => { expect(graduation([]).ready).toBe(false); });
});
