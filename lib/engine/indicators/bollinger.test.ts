import { describe, it, expect } from "vitest";
import { bollinger } from "./bollinger";

describe("bollinger", () => {
  it("bands collapse on a flat series", () => {
    const b = bollinger(new Array(25).fill(50), 20, 2);
    expect(b.upper[24]).toBe(50);
    expect(b.lower[24]).toBe(50);
  });
  it("uses population standard deviation", () => {
    const b = bollinger([2, 4, 4, 4, 5, 5, 7, 9], 8, 1);
    expect(b.mid[7]).toBe(5);
    expect(b.upper[7]).toBeCloseTo(7); // sd = 2
    expect(b.lower[7]).toBeCloseTo(3);
  });
});
