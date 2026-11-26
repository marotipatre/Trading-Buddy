import { describe, it, expect } from "vitest";
import { ema } from "./ema";

describe("ema", () => {
  it("seeds with SMA then applies smoothing", () => {
    const r = ema([1, 2, 3, 4, 5], 3);
    expect(r[2]).toBeCloseTo(2);
    expect(r[3]).toBeCloseTo(3); // 4*0.5 + 2*0.5
    expect(r[4]).toBeCloseTo(4);
  });
  it("returns all NaN when input shorter than period", () => {
    expect(ema([1, 2], 5).every(Number.isNaN)).toBe(true);
  });
});
