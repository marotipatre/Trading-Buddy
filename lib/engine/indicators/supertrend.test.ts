import { describe, it, expect } from "vitest";
import { supertrend } from "./supertrend";
import type { Candle } from "@/lib/data/types";

const mk = (closes: number[]): Candle[] =>
  closes.map((c, i) => ({ time: i, open: c, high: c + 1, low: c - 1, close: c, volume: 0 }));

describe("supertrend", () => {
  it("is bullish with line below price in a steady uptrend", () => {
    const c = mk(Array.from({ length: 40 }, (_, i) => 100 + i * 2));
    const s = supertrend(c, 10, 3);
    expect(s.direction[39]).toBe(1);
    expect(s.line[39]).toBeLessThan(c[39].close);
  });
  it("flips bearish after a sharp reversal", () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const down = Array.from({ length: 15 }, (_, i) => 158 - i * 8);
    const s = supertrend(mk([...up, ...down]), 10, 2);
    expect(s.direction.at(-1)).toBe(-1);
  });
});
