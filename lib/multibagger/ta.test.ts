import { describe, it, expect } from "vitest";
import { analyseTa, combine } from "./ta";
import type { Candle } from "@/lib/data/types";

const mk = (n: number, f: (i: number) => number, vol: (i: number) => number = () => 400_000): Candle[] => Array.from({ length: n }, (_, i) => { const p = f(i); return { time: 1_600_000_000 + i * 86400, open: p, high: p * 1.01, low: p * 0.99, close: p, volume: vol(i) }; });

describe("analyseTa", () => {
  it("needs enough history", () => { expect(analyseTa(mk(100, () => 10))).toBeNull(); });
  it("likes a steady stage 2 uptrend near its high with rising volume", () => {
    const t = analyseTa(mk(300, (i) => 20 * Math.pow(1.005, i), (i) => 300_000 + i * 3000))!;
    expect(t.stage2).toBe(true); expect(t.score).toBeGreaterThan(65); expect(t.flags).toEqual([]);
  });
  it("dislikes a stock far below its high", () => {
    const t = analyseTa(mk(300, (i) => (i < 150 ? 100 - i * 0.2 : 70 - (i - 150) * 0.3)))!;
    expect(t.stage2).toBe(false); expect(t.score).toBeLessThan(35); expect(t.flags.some((f) => f.includes("below its high"))).toBe(true);
  });
  it("flags thin trading", () => {
    const t = analyseTa(mk(300, (i) => 20 * Math.pow(1.004, i), () => 1000))!;
    expect(t.flags.some((f) => f.includes("Thinly"))).toBe(true);
  });
});

describe("combine", () => {
  const ta = (score: number, flags: string[] = []) => ({ score, flags, reasons: [], ret6m: 0, ret12m: 0, fromHighPct: 5, maxDd1y: 10, stage2: true, volTrend: 1, avgTurnoverCr: 2 });
  it("needs both halves to be good for a strong call", () => {
    expect(combine({ score: 75, reasons: [], flags: [] }, ta(70)).call).toBe("strong");
    expect(combine({ score: 85, reasons: [], flags: [] }, ta(30)).call).toBe("avoid");
    expect(combine({ score: 30, reasons: [], flags: [] }, ta(80)).call).toBe("avoid");
  });
  it("is pending until fundamentals arrive", () => { expect(combine(null, ta(70))).toEqual({ score: null, call: "pending" }); });
});
