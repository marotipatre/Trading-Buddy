import { describe, it, expect } from "vitest";
import { donchian, rollingMax, rollingMin } from "./donchian";

describe("donchian", () => {
  it("rolling max/min over window", () => {
    expect(rollingMax([1, 5, 3, 2, 4], 3).slice(2)).toEqual([5, 5, 4]);
    expect(rollingMin([1, 5, 3, 2, 4], 3).slice(2)).toEqual([1, 2, 2]);
  });
  it("channel mid is the average of bounds", () => {
    const d = donchian([10, 12, 11], [8, 9, 7], 3);
    expect(d.upper[2]).toBe(12);
    expect(d.lower[2]).toBe(7);
    expect(d.mid[2]).toBe(9.5);
  });
});
