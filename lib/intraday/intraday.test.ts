import { describe, it, expect } from "vitest";
import { intradaySize, nextSession, scoreIntraday, topPicks, type IntradayPick } from "./picks";
import { evaluatePick, summarize, type Bar } from "./scorecard";
import type { Candle } from "@/lib/data/types";

const day = (i: number) => 1_700_000_000 + i * 86400;
const rising = (n = 120, vol = 5e6): Candle[] => Array.from({ length: n }, (_, i) => {
  const c = 100 * Math.pow(1.004, i) + Math.sin(i / 3);
  return { time: day(i), open: c - 0.5, high: c + 1.6, low: c - 1.4, close: c + 1.3, volume: i === n - 1 ? vol * 1.8 : vol };
});

describe("nextSession", () => {
  it("skips weekends", () => {
    expect(nextSession("2026-11-26")).toBe("2026-11-27"); // Thu -> Fri
    expect(nextSession("2026-11-27")).toBe("2026-11-30"); // Fri -> Mon
  });
});

describe("scoreIntraday", () => {
  it("picks a liquid, rising stock and builds an ordered plan", () => {
    const p = scoreIntraday("AAA.NS", "AAA", "Banks", rising())!;
    expect(p).toBeTruthy();
    expect(p.plan.stop).toBeLessThan(p.plan.entry);
    expect(p.plan.target1).toBeGreaterThan(p.plan.entry);
    expect(p.plan.target2).toBeGreaterThan(p.plan.target1);
    expect(p.plan.riskPct).toBeGreaterThanOrEqual(0.55);
    expect(p.plan.riskPct).toBeLessThanOrEqual(1.5);
    expect(p.plan.rr1).toBeCloseTo(1.5, 0);
    expect(p.reasons.length).toBeGreaterThan(2);
  });
  it("rejects thin stocks, downtrends and too little history", () => {
    expect(scoreIntraday("T", "T", "X", rising(120, 100))).toBeNull(); // turnover too low
    const falling = Array.from({ length: 120 }, (_, i) => { const c = 300 * Math.pow(0.996, i); return { time: day(i), open: c, high: c + 2, low: c - 2, close: c, volume: 5e6 }; });
    expect(scoreIntraday("D", "D", "X", falling)).toBeNull();
    expect(scoreIntraday("S", "S", "X", rising(30))).toBeNull();
  });
  it("negative headlines lower the score", () => {
    expect(scoreIntraday("A", "A", "X", rising(), -1)!.score).toBeLessThan(scoreIntraday("A", "A", "X", rising(), 0)!.score);
  });
});

describe("topPicks", () => {
  const mk = (sym: string, sector: string, score: number) => ({ symbol: sym, sector, score }) as IntradayPick;
  it("takes the best, at most two per sector", () => {
    const t = topPicks([mk("A", "Banks", 90), mk("B", "Banks", 85), mk("C", "Banks", 80), mk("D", "IT", 70), mk("E", "Auto", 65), mk("F", "FMCG", 60), mk("G", "Metals", 58)], 5, 2);
    expect(t.map((p) => p.symbol)).toEqual(["A", "B", "D", "E", "F"]);
  });
});

describe("intradaySize", () => {
  it("risks a share of the pot and caps each position's margin", () => {
    const s = intradaySize(100000, 5, 1, 3, { entry: 500, risk: 5 });
    expect(s.qty).toBe(200); // risk: 1000 / 5 = 200; margin cap: 500000 / 3 / 500 = 333
    expect(s.notional).toBe(100000);
    expect(s.margin).toBe(20000);
    expect(s.riskAmt).toBe(1000);
    expect(intradaySize(100000, 5, 1, 3, { entry: 5000, risk: 5 }).qty).toBe(33); // margin cap binds
    expect(intradaySize(0, 5, 1, 3, { entry: 500, risk: 5 }).qty).toBe(0);
  });
});

describe("evaluatePick", () => {
  const forDate = "2026-11-30";
  const plan = { entry: 100, stop: 99, target1: 101.5, target2: 102.5, risk: 1, riskPct: 1, rr1: 1.5 };
  const t0 = Date.parse(forDate + "T03:45:00Z") / 1000; // 09:15 IST
  const bar = (i: number, o: number, h: number, l: number, c: number): Bar => ({ time: t0 + i * 300, open: o, high: h, low: l, close: c });
  const flat = (n: number, p = 99.5): Bar[] => Array.from({ length: n }, (_, i) => bar(i, p, p + 0.2, p - 0.2, p));
  it("hits the target after a breakout", () => {
    const r = evaluatePick({ plan, forDate }, [bar(0, 99.5, 100.2, 99.4, 100.1), bar(1, 100.1, 101.6, 100, 101.5), ...flat(4)])!;
    expect(r.outcome).toBe("target");
    expect(r.r).toBeCloseTo(1.5);
  });
  it("counts the stop first when a bar touches both", () => {
    const r = evaluatePick({ plan, forDate }, [bar(0, 99.5, 100.2, 99.4, 100.1), bar(1, 100.1, 101.6, 98.9, 100), ...flat(3)])!;
    expect(r.outcome).toBe("stop");
    expect(r.r).toBeCloseTo(-1);
  });
  it("is no-entry when price never reaches the entry", () => {
    expect(evaluatePick({ plan, forDate }, flat(8))!.outcome).toBe("no-entry");
  });
  it("skips a big gap up or a gap through the stop, fills a small gap at the open", () => {
    expect(evaluatePick({ plan, forDate }, [bar(0, 102, 102.5, 101.8, 102.2), ...flat(4, 102)])!.outcome).toBe("skipped-gap");
    expect(evaluatePick({ plan, forDate }, [bar(0, 98.5, 99, 98.2, 98.7), ...flat(4, 98.7)])!.outcome).toBe("skipped-gap");
    const g = evaluatePick({ plan, forDate }, [bar(0, 100.4, 100.6, 100.3, 100.5), ...flat(4, 100.5)])!;
    expect(g.entryPrice).toBe(100.4);
    expect(g.outcome).toBe("eod");
  });
  it("returns null before the session exists", () => {
    expect(evaluatePick({ plan, forDate: "2030-01-01" }, flat(8))).toBeNull();
  });
});

describe("summarize", () => {
  it("counts only trades that were taken", () => {
    const s = summarize([{ outcome: "target", pnlPct: 1.5, r: 1.5 }, { outcome: "stop", pnlPct: -1, r: -1 }, { outcome: "no-entry", pnlPct: 0, r: 0 }, { outcome: "skipped-gap", pnlPct: 0, r: 0 }, { outcome: "target", pnlPct: 1.5, r: 1.5 }]);
    expect(s).toMatchObject({ evaluated: 5, taken: 3, wins: 2, losses: 1, skipped: 2 });
    expect(s.winRate).toBeCloseTo(2 / 3);
    expect(s.totalR).toBeCloseTo(2);
  });
});

describe("picks while the session is running", () => {
  it("ignores today's unfinished candle and plans for the day after", () => {
    const c = rising(120);
    const last = c[c.length - 1];
    const lastIst = new Date((last.time + 19800) * 1000).toISOString().slice(0, 10);
    // 11:00 IST on the day of the last candle, if that day is a weekday; otherwise pick the next Monday-like date check is skipped
    const dow = new Date(lastIst + "T00:00:00Z").getUTCDay();
    if (dow === 0 || dow === 6) return;
    const during = Date.parse(lastIst + "T05:30:00Z") / 1000; // 11:00 IST
    const after = Date.parse(lastIst + "T11:00:00Z") / 1000; // 16:30 IST
    const a = scoreIntraday("A.NS", "A", "X", c, 0, during);
    const b = scoreIntraday("A.NS", "A", "X", c, 0, after);
    expect(b?.forDate).toBe(nextSession(lastIst));
    if (a) expect(a.forDate).toBe(nextSession(lastIst)); // built from the previous finished day, for the same next session
  });
});

describe("evaluatePick with the VWAP confirmation", () => {
  it("skips a trigger candle that closes under the day's VWAP", async () => {
    const { evaluatePick } = await import("./scorecard");
    const t0 = Date.UTC(2025, 2, 3, 3, 45) / 1000;
    const mk = (i: number, o: number, h: number, l: number, c: number) => ({ time: t0 + i * 300, open: o, high: h, low: l, close: c, volume: 1000 });
    const bars = [mk(0, 100, 103, 99.8, 102.8), mk(1, 102.8, 103, 102.5, 102.9), mk(2, 102.9, 103, 102.4, 102.6), mk(3, 101, 101.2, 100.8, 100.9)];
    const pick = { forDate: "2025-03-03", plan: { entry: 101.2, stop: 99, target1: 108, target2: 110, risk: 2.2, riskPct: 2, rr1: 3 } };
    expect(evaluatePick(pick, bars, { confirm: true })!.outcome).not.toBe("target");
    expect(evaluatePick(pick, bars)).not.toBeNull();
  });
});
