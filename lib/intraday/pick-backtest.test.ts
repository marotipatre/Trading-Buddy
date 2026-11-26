import { describe, it, expect } from "vitest";
import { backtestPicks } from "./pick-backtest";
import type { Candle } from "@/lib/data/types";

const DAY = 86400;
const start = Date.UTC(2024, 0, 1) / 1000;
// A steadily rising, liquid stock, so the pick rules like it.
const daily: Candle[] = Array.from({ length: 140 }, (_, i) => { const p = 100 * Math.pow(1.004, i); return { time: start + i * DAY, open: p * 0.998, high: p * 1.012, low: p * 0.99, close: p * 1.006, volume: 3_000_000 }; });
const dateOf = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

function session(dayIdx: number): Candle[] {
  const base = daily[dayIdx].close, t0 = Date.UTC(...(dateOf(daily[dayIdx].time).split("-").map(Number) as [number, number, number]).map((x, i) => (i === 1 ? x - 1 : x)) as [number, number, number], 3, 45) / 1000;
  return Array.from({ length: 70 }, (_, k) => { const p = base * (1 + k * 0.0003); return { time: t0 + k * 300, open: p, high: p * 1.002, low: p * 0.9995, close: p * 1.001, volume: 10000 }; });
}

describe("backtestPicks", () => {
  it("replays past sessions without looking ahead and summarises them", () => {
    const bars5 = [100, 101, 102].flatMap(session);
    const r = backtestPicks([{ symbol: "UP.NS", name: "Up", sector: "IT", daily, bars5 }]);
    expect(r.sessions).toBeGreaterThan(0);
    expect(r.card.evaluated).toBeGreaterThan(0);
    for (const d of r.days) expect(daily.some((c) => dateOf(c.time) === d.date)).toBe(true);
    expect(r.byScore).toHaveLength(3);
  });
  it("returns nothing when there is no intraday data", () => {
    const r = backtestPicks([{ symbol: "UP.NS", name: "Up", sector: "IT", daily, bars5: [] }]);
    expect(r.sessions).toBe(0);
    expect(r.card.evaluated).toBe(0);
  });
});
