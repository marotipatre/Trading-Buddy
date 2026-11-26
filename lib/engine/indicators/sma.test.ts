import { describe, it, expect } from "vitest";
import { sma } from "./sma";

describe("sma", () => {
  it("computes rolling mean with NaN warmup", () => {
    const r = sma([1, 2, 3, 4, 5], 3);
    expect(r.slice(0, 2).every(Number.isNaN)).toBe(true);
    expect(r.slice(2)).toEqual([2, 3, 4]);
  });
  it("period 1 returns the input", () => {
    expect(sma([5, 6, 7], 1)).toEqual([5, 6, 7]);
  });
});
