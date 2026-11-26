import { describe, it, expect } from "vitest";
import { summarizePaths } from "./forecast";

describe("summarizePaths", () => {
  it("gives median, band and the share of paths that end higher", () => {
    const paths = [[101, 102], [99, 98], [102, 104], [100, 101], [103, 106]];
    const s = summarizePaths(paths, 100)!;
    expect(s.median).toEqual([101, 102]);
    expect(s.p10[1]).toBeLessThanOrEqual(s.median[1]);
    expect(s.p90[1]).toBeGreaterThanOrEqual(s.median[1]);
    expect(s.upShare).toBeCloseTo(0.8);
    expect(s.endMedianPct).toBeCloseTo(2);
    expect(s.samples).toBe(5);
  });
  it("ignores broken paths and handles nothing usable", () => {
    expect(summarizePaths([[1, NaN], []], 100)).toBeNull();
    expect(summarizePaths([[101]], 0)).toBeNull();
    expect(summarizePaths([[101, 102], [100]], 100)!.median).toHaveLength(1);
  });
});
