import { describe, it, expect } from "vitest";
import { mean, stdev, quantile, wilsonInterval, mulberry32 } from "./stats";

describe("stats", () => {
  it("mean and sample stdev", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(stdev([5])).toBeNaN();
  });
  it("quantile interpolates", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
  });
  it("wilson interval matches a known value (10/20 -> ~[0.299, 0.701])", () => {
    const [lo, hi] = wilsonInterval(10, 20);
    expect(lo).toBeCloseTo(0.299, 2);
    expect(hi).toBeCloseTo(0.701, 2);
  });
  it("wilson stays inside [0,1] at the extremes and is wide for tiny n", () => {
    const [lo, hi] = wilsonInterval(5, 5);
    expect(hi).toBe(1);
    expect(lo).toBeLessThan(0.6);
    expect(wilsonInterval(0, 0)[0]).toBeNaN();
  });
  it("seeded PRNG is deterministic and in [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});
