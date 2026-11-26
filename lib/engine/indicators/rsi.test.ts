import { describe, it, expect } from "vitest";
import { rsi } from "./rsi";

describe("rsi", () => {
  it("is 100 for a strictly rising series", () => {
    const r = rsi(Array.from({ length: 30 }, (_, i) => i + 1), 14);
    expect(r[14]).toBe(100);
    expect(r[29]).toBe(100);
  });
  it("is 0 for a strictly falling series", () => {
    const r = rsi(Array.from({ length: 30 }, (_, i) => 100 - i), 14);
    expect(r[20]).toBeCloseTo(0);
  });
  it("matches an independently hand-computed value", () => {
    const c = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
    expect(rsi(c, 14)[14]).toBeCloseTo(70.46, 2);
  });
});
