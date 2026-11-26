import { describe, it, expect } from "vitest";
import { CHART_RANGES, cleanBars, istDay, lastSessionOf, moveOver, snapToBar, toChartTime } from "./chart-ranges";
import type { Candle } from "@/lib/data/types";

const IST = 19800;
const at = (y: number, m: number, d: number, h: number, mi: number) => Date.UTC(y, m, d, h, mi) / 1000 - IST;
const bar = (time: number, o = 1, c = 1): Candle => ({ time, open: o, high: Math.max(o, c), low: Math.min(o, c), close: c, volume: 1 });

describe("ranges", () => {
  it("has unique ids, intraday for short ranges and daily for long ones", () => {
    expect(new Set(CHART_RANGES.map((r) => r.id)).size).toBe(CHART_RANGES.length);
    expect(CHART_RANGES.find((r) => r.id === "1d")).toMatchObject({ interval: "5m", lastSession: true });
    expect(CHART_RANGES.find((r) => r.id === "5y")?.interval).toBe("1d");
    // every range stays inside what the data layer can serve in a request
    for (const r of CHART_RANGES) expect(r.days).toBeLessThanOrEqual(3650);
  });
});

describe("lastSessionOf", () => {
  it("keeps only the latest trading day", () => {
    const bars = [bar(at(2026, 10, 25, 15, 25)), bar(at(2026, 10, 26, 9, 15)), bar(at(2026, 10, 26, 9, 20))];
    expect(lastSessionOf(bars)).toHaveLength(2);
    expect(lastSessionOf([])).toEqual([]);
  });
  it("uses the IST calendar day, not UTC", () => {
    // 00:30 IST on the 27th is still the 26th in UTC; it belongs to the 27th session
    const bars = [bar(at(2026, 10, 26, 23, 0)), bar(at(2026, 10, 27, 0, 30))];
    expect(istDay(bars[0].time)).not.toBe(istDay(bars[1].time));
    expect(lastSessionOf(bars)).toHaveLength(1);
  });
});

describe("time handling", () => {
  it("shifts intraday bars to IST and leaves daily bars alone", () => {
    expect(toChartTime(1000, true)).toBe(1000 + IST);
    expect(toChartTime(1000, false)).toBe(1000);
  });
  it("snaps to the latest bar at or before a time", () => {
    const t = [10, 20, 30];
    expect(snapToBar(t, 25)).toBe(20);
    expect(snapToBar(t, 30)).toBe(30);
    expect(snapToBar(t, 99)).toBe(30);
    expect(snapToBar(t, 5)).toBeNull();
    expect(snapToBar([], 5)).toBeNull();
  });
  it("cleans bars into strictly ascending order, last duplicate wins", () => {
    const c = cleanBars([bar(30, 3, 3), bar(10, 1, 1), bar(20, 2, 2), bar(20, 9, 9)]);
    expect(c.map((x) => x.time)).toEqual([10, 20, 30]);
    expect(c[1].close).toBe(9);
  });
});

describe("moveOver", () => {
  it("measures first open to last close", () => {
    const m = moveOver([bar(1, 100, 101), bar(2, 101, 110)])!;
    expect(m.change).toBe(10);
    expect(m.changePct).toBeCloseTo(10);
  });
  it("is null with fewer than two bars", () => {
    expect(moveOver([bar(1)])).toBeNull();
  });
});
