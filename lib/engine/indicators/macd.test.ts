import { describe, it, expect } from "vitest";
import { macd } from "./macd";

describe("macd", () => {
  it("is ~0 for a flat series", () => {
    const r = macd(new Array(60).fill(100));
    expect(r.macd[59]).toBeCloseTo(0);
    expect(r.hist[59]).toBeCloseTo(0);
  });
  it("is positive for a steady uptrend", () => {
    const r = macd(Array.from({ length: 80 }, (_, i) => 100 + i));
    expect(r.macd[79]).toBeGreaterThan(0);
  });
  it("histogram equals macd minus signal", () => {
    const r = macd(Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 3) * 5));
    expect(r.hist[70]).toBeCloseTo(r.macd[70] - r.signal[70]);
  });
});
