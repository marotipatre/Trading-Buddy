import { describe, it, expect } from "vitest";
import { align, quadrantOf, returnsOf, rrg, sectorOutlook, valuation, type Bar } from "./outlook";

const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10));
const series = (n: number, f: (i: number) => number, pe?: (i: number) => number): Bar[] => days(n).map((date, i) => ({ date, close: f(i), pe: pe?.(i) }));

describe("returns", () => {
  it("measures close-to-close over trading-day offsets", () => {
    const c = Array.from({ length: 300 }, (_, i) => 100 + i);
    const r = returnsOf(c);
    expect(r.d1).toBeCloseTo((399 / 398 - 1) * 100);
    expect(r.m1).toBeCloseTo((399 / 378 - 1) * 100);
    expect(Number.isNaN(returnsOf([1, 2, 3]).y1)).toBe(true);
  });
});

describe("quadrants", () => {
  it("maps ratio and momentum to the four quadrants", () => {
    expect(quadrantOf({ ratio: 105, momentum: 102 })).toBe("leading");
    expect(quadrantOf({ ratio: 105, momentum: 98 })).toBe("weakening");
    expect(quadrantOf({ ratio: 95, momentum: 98 })).toBe("lagging");
    expect(quadrantOf({ ratio: 95, momentum: 102 })).toBe("improving");
  });
});

describe("sectorOutlook", () => {
  const bench = series(320, (i) => 100 + i * 0.1);
  it("calls an accelerating outperformer overweight and leading", () => {
    const hot = series(320, (i) => 100 * Math.pow(1.0018, i), (i) => 20 + i * 0.002);
    const o = sectorOutlook("Hot", "Hot", hot, bench)!;
    expect(o.quadrant).toBe("leading");
    expect(o.trend).toBe("up");
    expect(o.vsBench.m3).toBeGreaterThan(0);
    expect(o.stance).toBe("overweight");
    expect(o.rrg.length).toBeGreaterThan(3);
  });
  it("calls a persistent laggard underweight", () => {
    const cold = series(320, (i) => 100 * Math.pow(0.9992, i));
    const o = sectorOutlook("Cold", "Cold", cold, bench)!;
    expect(["lagging", "improving"]).toContain(o.quadrant);
    expect(o.trend).toBe("down");
    expect(o.stance).toBe("underweight");
  });
  it("needs enough shared history", () => {
    expect(sectorOutlook("X", "X", series(100, (i) => 100 + i), bench)).toBeNull();
    expect(align(series(10, (i) => i + 1), series(5, (i) => i + 1))).toHaveLength(5);
  });
  it("explains itself", () => {
    const o = sectorOutlook("Hot", "Hot", series(320, (i) => 100 * Math.pow(1.0018, i)), bench)!;
    expect(o.reasons.length).toBeGreaterThanOrEqual(3);
    expect(o.reasons[0]).toContain("3 months");
  });
});

describe("rrg and valuation", () => {
  it("returns recent weekly points only", () => {
    const al = days(200).map((date, i) => ({ date, a: 100 + i, b: 100 }));
    expect(rrg(al, 6)).toHaveLength(6);
  });
  it("places the current P/E in its own history", () => {
    const v = valuation(Array.from({ length: 100 }, (_, i) => 10 + i * 0.1));
    expect(v.valuation).toBe("rich");
    expect(valuation(Array.from({ length: 100 }, (_, i) => 30 - i * 0.1)).valuation).toBe("cheap");
    expect(valuation([20, 21]).valuation).toBeUndefined();
  });
});
