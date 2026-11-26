import { describe, it, expect } from "vitest";
import { aggregate4h, aggregateWeekly, getTimeframe, TIMEFRAMES, toTimeframe } from "./chart-timeframes";
import type { Candle } from "@/lib/data/types";

const IST = 19800;
const at = (y: number, m: number, d: number, h: number, mi: number) => Date.UTC(y, m, d, h, mi) / 1000 - IST;
const bar = (time: number, o: number, h: number, l: number, c: number, v = 10): Candle => ({ time, open: o, high: h, low: l, close: c, volume: v });

/** A full NSE session of 15-minute bars: 09:15 to 15:15, 25 bars. */
function session(y: number, m: number, d: number, base: number): Candle[] {
  return Array.from({ length: 25 }, (_, i) => {
    const t = at(y, m, d, 9, 15) + i * 900;
    const p = base + i;
    return bar(t, p, p + 2, p - 1, p + 1);
  });
}

describe("timeframes", () => {
  it("lists 5m, 15m, 4H, 1D and 1W with sensible sources", () => {
    expect(TIMEFRAMES.map((t) => t.id)).toEqual(["5m", "15m", "4h", "1d", "1w"]);
    expect(getTimeframe("4h")).toMatchObject({ source: "15m", aggregate: "4h", intraday: true });
    expect(getTimeframe("1w")).toMatchObject({ source: "1d", aggregate: "1w", intraday: false });
    expect(getTimeframe("nope").id).toBe("1d");
    for (const t of TIMEFRAMES) expect(t.days).toBeLessThanOrEqual(365 * 10);
  });
});

describe("aggregate4h", () => {
  const bars = session(2026, 10, 25, 100);
  const out = aggregate4h(bars);
  it("makes two candles per session: 09:15 to 13:15 and 13:15 to the close", () => {
    expect(out).toHaveLength(2);
    expect(out[0].time).toBe(at(2026, 10, 25, 9, 15));
    expect(out[1].time).toBe(at(2026, 10, 25, 13, 15));
  });
  it("takes the first open, highest high, lowest low, last close and total volume", () => {
    // bars 0..15 are 09:15..13:00 (16 bars); bars 16..24 are 13:15..15:15 (9 bars)
    expect(out[0]).toMatchObject({ open: 100, close: 116, high: 117, low: 99, volume: 160 });
    expect(out[1]).toMatchObject({ open: 116, close: 125, high: 126, low: 115, volume: 90 });
  });
  it("never merges bars from different days", () => {
    const two = aggregate4h([...session(2026, 10, 25, 100), ...session(2026, 10, 26, 130)]);
    expect(two).toHaveLength(4);
    expect(two[2].open).toBe(130);
  });
  it("copes with empty and unsorted input", () => {
    expect(aggregate4h([])).toEqual([]);
    expect(aggregate4h([...bars].reverse())).toEqual(out);
  });
});

describe("aggregateWeekly", () => {
  const d = (day: number, o: number, c: number) => bar(at(2026, 10, day, 9, 15), o, Math.max(o, c) + 1, Math.min(o, c) - 1, c);
  // 2026-11-23 is a Monday
  const days = [d(23, 100, 102), d(24, 102, 101), d(25, 101, 105), d(26, 105, 104), d(27, 104, 108), d(30, 108, 110), d(31 - 30 + 30, 110, 111)];
  it("groups Monday to Friday and starts a new week on Monday", () => {
    const w = aggregateWeekly(days.slice(0, 6));
    expect(w).toHaveLength(2);
    expect(w[0]).toMatchObject({ open: 100, close: 108 });
    expect(w[0].time).toBe(at(2026, 10, 23, 9, 15));
    expect(w[1].open).toBe(108);
  });
  it("uses the week's extremes and total volume", () => {
    const w = aggregateWeekly(days.slice(0, 5))[0];
    expect(w.high).toBe(109);
    expect(w.low).toBe(99);
    expect(w.volume).toBe(50);
  });
  it("handles a short week with a holiday", () => {
    expect(aggregateWeekly([d(23, 1, 2), d(25, 2, 3)])).toHaveLength(1);
  });
  it("toTimeframe leaves non-aggregated timeframes untouched", () => {
    expect(toTimeframe(days, getTimeframe("1d"))).toBe(days);
    expect(toTimeframe(days.slice(0, 5), getTimeframe("1w"))).toHaveLength(1);
  });
});

import { aggregateMonthly } from "./chart-timeframes";
describe("aggregateMonthly", () => {
  it("merges days into calendar months with correct OHLC", () => {
    const day = (iso: string, o: number, h: number, l: number, c: number) => ({ time: Date.parse(iso + "T04:00:00Z") / 1000, open: o, high: h, low: l, close: c, volume: 10 });
    const m = aggregateMonthly([day("2026-01-02", 10, 12, 9, 11), day("2026-01-30", 11, 15, 10, 14), day("2026-02-02", 14, 16, 13, 15)]);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ open: 10, high: 15, low: 9, close: 14, volume: 20 });
    expect(m[1].open).toBe(14);
  });
});
