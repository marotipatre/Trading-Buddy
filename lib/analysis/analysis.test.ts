import { describe, it, expect } from "vitest";
import { headlineScore, newsMood } from "./sentiment";
import { assessStock, positionSize, verdictOf, withOverlay } from "./stock-view";
import { rankSectors } from "./sectors";
import type { Candle } from "@/lib/data/types";

const mk = (f: (i: number) => number, n = 320): Candle[] => Array.from({ length: n }, (_, i) => { const c = f(i); return { time: 1_600_000_000 + i * 86400, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 1e5 }; });

describe("sentiment", () => {
  it("scores positive and negative headlines", () => {
    expect(headlineScore("Reliance shares surge after record profit")).toBeGreaterThan(0.5);
    expect(headlineScore("Stock plunges as probe and fraud concerns grow")).toBeLessThan(-0.5);
    expect(headlineScore("Company holds annual meeting")).toBe(0);
  });
  it("matches whole words only", () => {
    expect(headlineScore("Bestseller launched")).toBe(0); // "sell" inside another word
  });
  it("weights newer headlines more", () => {
    const now = 2_000_000_000;
    const m = newsMood([{ title: "stock surges", time: now - 3600 }, { title: "stock plunges", time: now - 40 * 86400 }], now);
    expect(m.score).toBeGreaterThan(0.5);
    expect(m.count).toBe(2);
  });
});

describe("assessStock", () => {
  it("rates a steady uptrend higher than a downtrend, with an ordered plan", () => {
    const up = assessStock("UP", mk((i) => 100 + i * 0.5 + Math.sin(i / 5) * 2))!;
    const down = assessStock("DN", mk((i) => 300 - i * 0.5 + Math.sin(i / 5) * 2))!;
    expect(up.technical).toBeGreaterThan(down.technical);
    expect(down.verdict).toBe("avoid");
    expect(up.frames.weekly).toBe("up");
    if (up.plan) {
      expect(up.plan.stop).toBeLessThan(up.plan.entry);
      expect(up.plan.target1).toBeGreaterThan(up.plan.entry);
      expect(up.plan.target2).toBeGreaterThanOrEqual(up.plan.target1);
      expect(up.plan.rr1).toBeGreaterThan(0);
    }
  });
  it("needs enough history", () => { expect(assessStock("X", mk((i) => 100 + i, 100))).toBeNull(); });
  it("never calls a setup with poor reward-to-risk a buy", () => {
    expect(verdictOf(90, { entry: 100, entryKind: "now", stop: 95, target1: 105, target2: 110, riskPct: 5, rewardPct1: 5, rr1: 1, rr2: 2 })).toBe("watch");
  });
  it("news and brokers move the score by a bounded amount", () => {
    const v = assessStock("UP", mk((i) => 100 + i * 0.5 + Math.sin(i / 5) * 2))!;
    const hi = withOverlay(v, { score: 1, count: 10 }, { buy: 4, hold: 0, sell: 0, brokers: 4 });
    const lo = withOverlay(v, { score: -1, count: 10 }, { buy: 0, hold: 0, sell: 4, brokers: 4 });
    expect(hi.score - v.technical).toBeLessThanOrEqual(15);
    expect(hi.score).toBeGreaterThan(lo.score);
    expect(withOverlay(v, { score: 1, count: 1 }).score).toBe(v.technical); // too few headlines to matter
  });
});

describe("position sizing", () => {
  it("risks a fixed share of capital and caps the position", () => {
    const s = positionSize(300000, 1, 25, { entry: 100, stop: 95 });
    expect(s.qty).toBe(600); // 3000 risk / 5 per share
    expect(s.value).toBe(60000); // under the 75,000 cap
    expect(positionSize(300000, 1, 10, { entry: 100, stop: 95 }).qty).toBe(300); // capped at 30,000
    expect(positionSize(300000, 1, 25, { entry: 100, stop: 100 }).qty).toBe(0);
  });
});

describe("sector ranking", () => {
  const view = (up: boolean, m1: number) => ({ ...assessStock("S", mk((i) => 100 + (up ? i : -i * 0.3) * 0.4 + Math.sin(i / 5)))!, ret: { w1: m1 / 4, m1, m3: m1, m6: m1 }, aboveEma50: up, verdict: up ? "buy" as const : "avoid" as const });
  it("puts strong, broad sectors first and skips tiny ones", () => {
    const items = [
      ...[1, 2, 3, 4].map(() => ({ sector: "Banks", view: view(true, 8) })),
      ...[1, 2, 3, 4].map(() => ({ sector: "Metals", view: view(false, -6) })),
      { sector: "Tiny", view: view(true, 20) },
    ];
    const r = rankSectors(items, 1);
    expect(r.map((x) => x.sector)).toEqual(["Banks", "Metals"]);
    expect(r[0].stance).toBe("focus");
    expect(r[1].stance).toBe("avoid");
  });
});

describe("relative strength", () => {
  it("lifts the strongest stocks and lowers the weakest, within ±10", async () => {
    const { withRelativeStrength } = await import("./stock-view");
    const base = assessStock("A", mk((i) => 100 + i * 0.5 + Math.sin(i / 5) * 2))!;
    const views = [0, 1, 2, 3, 4].map((k) => ({ ...base, symbol: "S" + k, technical: 60, score: 60, ret: { ...base.ret, m3: k * 5 } }));
    const out = withRelativeStrength(views);
    expect(out[4].score).toBe(70);
    expect(out[0].score).toBe(50);
    expect(out[2].score).toBe(60);
  });
});
