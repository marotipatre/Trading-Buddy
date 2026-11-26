import { describe, it, expect } from "vitest";
import { atr, trueRange } from "./atr";

const bar = (h: number, l: number, c: number) => ({ time: 0, open: c, high: h, low: l, close: c, volume: 0 });

describe("atr", () => {
  it("true range accounts for gaps", () => {
    const tr = trueRange([bar(10, 8, 9), bar(15, 14, 14.5)]);
    expect(tr[1]).toBe(6); // high 15 - prev close 9
  });
  it("constant range gives constant ATR", () => {
    const bars = Array.from({ length: 20 }, () => bar(12, 10, 11));
    expect(atr(bars, 14)[19]).toBeCloseTo(2);
  });
});
