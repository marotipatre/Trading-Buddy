import { describe, it, expect } from "vitest";
import { deriveIdeas, conviction, type BaseIdea } from "./ideas-engine";
import { assessStock } from "./stock-view";
import type { Candle } from "@/lib/data/types";

const mk = (f: (i: number) => number, n = 500): Candle[] => Array.from({ length: n }, (_, i) => { const c = f(i); return { time: 1_600_000_000 + i * 86400, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 1e5 }; });
const up = mk((i) => 100 + i * 0.4 + Math.sin(i / 6) * 3);
const down = mk((i) => 400 - i * 0.4 + Math.sin(i / 6) * 3);
const base = (symbol: string, candles: Candle[]): BaseIdea => ({ symbol, name: symbol, sector: "IT", cap: "large", view: assessStock(symbol, candles)!, patterns: [] });

describe("deriveIdeas", () => {
  const bases = [base("DOWN.NS", down), base("UP.NS", up)];
  const store: Record<string, Candle[]> = { "UP.NS": up, "DOWN.NS": down };
  it("ranks the stronger stock first and attaches odds when candles are available", () => {
    const r = deriveIdeas(bases, { days: 15, target: 6 }, (s) => store[s]);
    expect(r[0].symbol).toBe("UP.NS");
    expect(r[0].v.plan?.rewardPct1).toBeCloseTo(6);
    expect(r[0].hz?.samples).toBeGreaterThan(100);
    expect(r[0].bb.bull.length + r[0].bb.bear.length).toBeGreaterThan(0);
  });
  it("changing the target changes the plan without a rescan", () => {
    const a = deriveIdeas(bases, { days: 15, target: 4 }, (s) => store[s]).find((x) => x.symbol === "UP.NS")!;
    const b = deriveIdeas(bases, { days: 15, target: 12 }, (s) => store[s]).find((x) => x.symbol === "UP.NS")!;
    expect(b.v.plan!.target1).toBeGreaterThan(a.v.plan!.target1);
    if (a.hz && b.hz) expect(b.hz.hitRate).toBeLessThanOrEqual(a.hz.hitRate);
  });
  it("works before candles are loaded (no odds yet)", () => {
    const r = deriveIdeas(bases, { days: 15, target: 6 }, () => undefined);
    expect(r.every((x) => x.hz === undefined)).toBe(true);
  });
  it("only a buy setup can carry conviction", () => {
    const r = deriveIdeas(bases, { days: 15, target: 6 }, (s) => store[s]);
    for (const x of r) if (x.v.verdict !== "buy") expect(x.conviction).toBe("low");
    expect(conviction({ bull: [], bear: [], balance: 9, lean: "favours buying", provenance: [] }, { ...r[0].v, verdict: "watch" })).toBe("low");
  });
});
