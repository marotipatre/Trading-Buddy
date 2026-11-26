import { describe, it, expect } from "vitest";
import { equityVsBuyHold, downsample, monthlyReturns } from "./chart-data";
import type { Candle } from "@/lib/data/types";

const c = (close: number): Candle => ({ time: 0, open: close, high: close, low: close, close, volume: 0 });
const day = 86400;

describe("chart-data", () => {
  it("indexes buy-and-hold to the same starting capital", () => {
    const rows = equityVsBuyHold([c(50), c(100)], [{ time: 0, equity: 1000 }, { time: day, equity: 900 }], 1000);
    expect(rows.map((r) => r.buyHold)).toEqual([1000, 2000]);
    expect(rows[1].drawdown).toBeCloseTo(-10);
  });
  it("returns [] when lengths mismatch", () => {
    expect(equityVsBuyHold([c(1)], [], 100)).toEqual([]);
  });
  it("downsample keeps endpoints and caps length", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => i);
    const d = downsample(rows, 100);
    expect(d).toHaveLength(100);
    expect(d[0]).toBe(0);
    expect(d.at(-1)).toBe(4999);
    expect(downsample([1, 2, 3], 100)).toEqual([1, 2, 3]);
  });
  it("monthly returns chain from month to month", () => {
    const t = (y: number, m: number, d: number) => Date.UTC(y, m, d) / 1000;
    const eq = [
      { time: t(2024, 0, 2), equity: 100 },
      { time: t(2024, 0, 30), equity: 110 }, // Jan: +10%
      { time: t(2024, 1, 2), equity: 110 },
      { time: t(2024, 1, 28), equity: 99 }, // Feb: 99/110 - 1 = -10%
    ];
    const r = monthlyReturns(eq);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ year: 2024, month: 0 });
    expect(r[0].returnPct).toBeCloseTo(10);
    expect(r[1].returnPct).toBeCloseTo(-10);
  });
});
