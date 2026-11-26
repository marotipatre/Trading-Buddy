import { describe, it, expect } from "vitest";
import { bullBear } from "./bullbear";
import type { StockView } from "./stock-view";
import type { HorizonStats } from "./horizon";

const view = (o: Partial<StockView> = {}): StockView => ({
  symbol: "X", price: 100, technical: 70, score: 70, verdict: "buy", frames: { daily: "up", weekly: "up", monthly: "up" }, ret: { w1: 1, m1: 2, m3: 3, m6: 4 }, rsi: 60, aboveEma50: true,
  reasons: [{ text: "Price above 50-day average", points: 8 }, { text: "RSI overbought", points: -8 }, { text: "minor", points: 2 }],
  plan: { entry: 100, entryKind: "now", stop: 96, target1: 108, target2: 112, riskPct: 4, rewardPct1: 8, rr1: 2, rr2: 3 }, ...o,
});
const hz = (o: Partial<HorizonStats> = {}): HorizonStats => ({ bars: 11, samples: 600, hitRate: 0.4, stopRate: 0.2, timeoutRate: 0.4, expectancyPct: 1.2, medianPct: 1, p10Pct: -4, hitRateUptrend: 0.45, samplesUptrend: 300, ...o });

describe("bullBear", () => {
  it("lists strong reasons on each side and ignores minor ones", () => {
    const r = bullBear({ view: view(), days: 15, target: 6 });
    expect(r.bull).toContain("Price above 50-day average");
    expect(r.bear).toContain("RSI overbought");
    expect([...r.bull, ...r.bear].some((t) => t === "minor")).toBe(false);
  });
  it("uses the stock's own history and the market regime", () => {
    const good = bullBear({ view: view(), hz: hz(), regime: "bull", days: 15, target: 6 });
    expect(good.bull.some((t) => t.includes("reached +6% 40%"))).toBe(true);
    expect(good.lean).toBe("favours buying");
    const bad = bullBear({ view: view({ reasons: [] }), hz: hz({ hitRate: 0.1, stopRate: 0.4, expectancyPct: -1 }), regime: "bear", patterns: [{ name: "bearish engulfing", bias: "bearish" }], news: { mood: -0.5 }, days: 15, target: 6 });
    expect(bad.bear.length).toBeGreaterThanOrEqual(5);
    expect(bad.lean).toBe("favours caution");
  });
  it("says where the numbers come from, naming the sentiment source", () => {
    const r = bullBear({ view: view(), news: { mood: 0.4, moodSource: "ai" }, days: 7, target: 3 });
    expect(r.provenance.join(" ")).toContain("FinBERT");
    expect(bullBear({ view: view(), news: { mood: 0.4, moodSource: "words" }, days: 7, target: 3 }).provenance.join(" ")).toContain("word-list");
  });
  it("flags a missing plan", () => {
    expect(bullBear({ view: view({ plan: null }), days: 15, target: 6 }).bear).toContain("No clean stop level to plan around");
  });
});
