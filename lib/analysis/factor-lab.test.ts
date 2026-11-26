import { describe, it, expect } from "vitest";
import { factorLab, verdict } from "./factor-lab";
import type { Candle } from "@/lib/data/types";

// Deterministic pseudo-random so the test is stable.
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
function stock(drift: number, seed: number, n = 700): Candle[] {
  const r = rng(seed); let p = 100;
  return Array.from({ length: n }, (_, i) => { p *= 1 + drift + (r() - 0.5) * 0.02; return { time: 1_600_000_000 + i * 86400, open: p, high: p, low: p, close: p, volume: 1 }; });
}

describe("factorLab", () => {
  it("needs a reasonable universe", () => { expect(factorLab({ A: stock(0.001, 1) })).toBeNull(); });
  it("finds momentum when persistent winners keep winning", () => {
    const s: Record<string, Candle[]> = {};
    for (let i = 0; i < 40; i++) s[`S${i}`] = stock((i - 20) * 0.00012, i + 7);
    const lab = factorLab(s)!;
    const mom = lab.factors.find((f) => f.id === "mom")!;
    expect(mom.spread).toBeGreaterThan(0.5);
    expect(mom.quintiles[4].avgFwd).toBeGreaterThan(mom.quintiles[0].avgFwd);
    expect(verdict(mom).tone).toBe("works");
  });
  it("reports no edge on pure noise", () => {
    const s: Record<string, Candle[]> = {};
    for (let i = 0; i < 40; i++) s[`N${i}`] = stock(0.0004, i + 100);
    const lab = factorLab(s)!;
    expect(Math.abs(lab.factors.find((f) => f.id === "composite")!.spread)).toBeLessThan(1.5);
    expect(lab.periods).toBeGreaterThan(8);
  });
});
