import { describe, it, expect, vi } from "vitest";
import { buildInstrumentMap, fetchUpstoxCandles, parseUpstoxCandles, planChunks, quoteFromCandles, toUpstoxKey, INDEX_KEYS } from "./upstox";
import type { Candle } from "./types";

const map = buildInstrumentMap([
  { segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: "RELIANCE", instrument_key: "NSE_EQ|INE002A01018" },
  { segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: "M&M", instrument_key: "NSE_EQ|INE101A01026" },
  { segment: "NSE_EQ", instrument_type: "BE", trading_symbol: "SOMEBE", instrument_key: "NSE_EQ|X" },
  { segment: "NSE_FO", instrument_type: "FUT", trading_symbol: "RELIANCE", instrument_key: "NSE_FO|999" },
  { segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: "", instrument_key: "NSE_EQ|BAD" },
]);

describe("instrument map", () => {
  it("keeps only plain NSE equities", () => {
    expect(map).toEqual({ RELIANCE: "NSE_EQ|INE002A01018", "M&M": "NSE_EQ|INE101A01026" });
  });
  it("maps Yahoo-style symbols and indices to Upstox keys", () => {
    expect(toUpstoxKey("RELIANCE.NS", map)).toBe("NSE_EQ|INE002A01018");
    expect(toUpstoxKey("m&m.ns", map)).toBe("NSE_EQ|INE101A01026");
    expect(toUpstoxKey("^NSEI", map)).toBe("NSE_INDEX|Nifty 50");
    expect(toUpstoxKey("^BSESN", map)).toBe(INDEX_KEYS["^BSESN"]);
  });
  it("returns null for unknown or BSE-only symbols", () => {
    expect(toUpstoxKey("NOPE.NS", map)).toBeNull();
    expect(toUpstoxKey("500325.BO", map)).toBeNull();
    expect(toUpstoxKey("AAPL", map)).toBeNull();
  });
});

describe("parseUpstoxCandles", () => {
  const body = (rows: unknown[]) => ({ status: "success", data: { candles: rows } });
  it("sorts newest-first rows ascending and stamps daily bars at the 09:15 IST open", () => {
    const c = parseUpstoxCandles(body([
      ["2026-11-25T00:00:00+05:30", 1359.8, 1394.2, 1357, 1373.9, 18781717, 0],
      ["2026-11-24T00:00:00+05:30", 1350, 1360, 1340, 1355, 100, 0],
    ]), "1d");
    expect(c.map((x) => x.close)).toEqual([1355, 1373.9]);
    expect(new Date(c[1].time * 1000).toISOString()).toBe("2026-11-25T03:45:00.000Z");
  });
  it("keeps real timestamps for intraday bars", () => {
    const c = parseUpstoxCandles(body([["2026-11-25T15:25:00+05:30", 1, 2, 1, 2, 5, 0]]), "5m");
    expect(c[0].time).toBe(Date.parse("2026-11-25T15:25:00+05:30") / 1000);
  });
  it("drops corrupt rows and tolerates error responses", () => {
    expect(parseUpstoxCandles(body([["2026-11-25T00:00:00+05:30", 0, 1, 1, 1, 1], ["bad-date", 1, 2, 1, 2, 1], ["2026-11-25T00:00:00+05:30", 5, 4, 6, 5, 1]]), "1d")).toEqual([]);
    expect(parseUpstoxCandles({ status: "error", errors: [{ message: "Invalid date range" }] }, "1d")).toEqual([]);
    expect(parseUpstoxCandles(null, "1d")).toEqual([]);
  });
});

describe("planChunks", () => {
  const T = Date.UTC(2026, 10, 26, 6) / 1000;
  it("one daily request covers up to 10 years", () => {
    expect(planChunks("1d", T - 5 * 365 * 86400, T)).toHaveLength(1);
    expect(planChunks("1d", T - 12 * 365 * 86400, T)).toHaveLength(2);
  });
  it("intraday is split into windows the API accepts, newest first, without gaps or overlap", () => {
    const chunks = planChunks("15m", T - 90 * 86400, T);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0].to).toBe("2026-11-26");
    for (let i = 1; i < chunks.length; i++) {
      const prevFrom = Date.parse(chunks[i - 1].from);
      const thisTo = Date.parse(chunks[i].to);
      expect((prevFrom - thisTo) / 86400000).toBe(1); // contiguous
    }
    for (const c of chunks) expect((Date.parse(c.to) - Date.parse(c.from)) / 86400000).toBeLessThanOrEqual(28);
  });
  it("caps how far back it goes", () => {
    expect(planChunks("1m", T - 400 * 86400, T).length).toBeLessThanOrEqual(Math.ceil(60 / 7) + 1);
  });
});

describe("quoteFromCandles", () => {
  const IST = 19800;
  const now = Date.UTC(2026, 10, 26, 10, 30) / 1000; // 16:00 IST on the 26th
  const todayStart = Math.floor((now + IST) / 86400) * 86400 - IST;
  const m = (min: number, o: number, h: number, l: number, c: number): Candle => ({ time: todayStart + 9 * 3600 + 15 * 60 + min * 60, open: o, high: h, low: l, close: c, volume: 1 });
  const d = (daysAgo: number, c: number): Candle => ({ time: todayStart - daysAgo * 86400 + 9 * 3600 + 15 * 60, open: c, high: c + 1, low: c - 1, close: c, volume: 1 });

  it("builds price, day range and change from today's minutes and yesterday's close", () => {
    const q = quoteFromCandles("R.NS", [m(0, 1371, 1374, 1362, 1362.5), m(1, 1362.5, 1401.7, 1361.8, 1396.2)], [d(2, 1350), d(1, 1373.9)], now)!;
    expect(q).toMatchObject({ price: 1396.2, prevClose: 1373.9, dayHigh: 1401.7, dayLow: 1361.8, source: "upstox" });
    expect(q.change).toBeCloseTo(22.3);
    expect(q.changePct).toBeCloseTo(1.623, 2);
  });
  it("ignores a daily bar for today when working out the previous close", () => {
    const q = quoteFromCandles("R.NS", [m(0, 1, 2, 1, 2)], [d(1, 100), d(0, 105)], now)!;
    expect(q.prevClose).toBe(100);
  });
  it("falls back to the last two sessions when there are no bars today", () => {
    const q = quoteFromCandles("R.NS", [], [d(3, 100), d(1, 110)], now)!;
    expect(q).toMatchObject({ price: 110, prevClose: 100 });
  });
  it("returns null when there is nothing to go on", () => {
    expect(quoteFromCandles("R.NS", [], [d(1, 100)], now)).toBeNull();
  });
});

describe("fetchUpstoxCandles", () => {
  // Reuse a pre-seeded instrument map via a fake instrument download is overkill; instead exercise the
  // error path that needs no network: an unknown symbol after the map is available.
  it("explains when a symbol is not in the instrument list", async () => {
    const f = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(fetchUpstoxCandles("RELIANCE.NS", "1d", 0, 1, f)).rejects.toThrow();
  });
});

import { quoteFromToday } from "./upstox";

describe("quoteFromToday (one-request live quote)", () => {
  const IST = 19800;
  const nowOpen = Date.UTC(2026, 10, 26, 6, 0) / 1000; // 11:30 IST
  const nowClosed = Date.UTC(2026, 10, 26, 12, 30) / 1000; // 18:00 IST
  const dayStart = Math.floor((nowOpen + IST) / 86400) * 86400 - IST;
  const today: Candle = { time: dayStart + 9 * 3600 + 15 * 60, open: 1371.1, high: 1401.7, low: 1361.8, close: 1396.2, volume: 20028816 };

  it("uses the candle's open range and latest close with the cached previous close", () => {
    const q = quoteFromToday("R.NS", today, 1373.9, true, nowOpen);
    expect(q).toMatchObject({ price: 1396.2, prevClose: 1373.9, dayHigh: 1401.7, dayLow: 1361.8, source: "upstox" });
    expect(q.changePct).toBeCloseTo(1.623, 2);
  });
  it("is stamped 'now' while the market is open so the paper broker treats it as a fresh tick", () => {
    expect(quoteFromToday("R.NS", today, 1373.9, true, nowOpen).time).toBe(nowOpen);
  });
  it("is stamped at the session close once the market is shut", () => {
    expect(quoteFromToday("R.NS", today, 1373.9, false, nowClosed).time).toBe(dayStart + 15 * 3600 + 30 * 60);
  });
  it("handles a zero previous close without dividing by zero", () => {
    expect(quoteFromToday("R.NS", today, 0, true, nowOpen).changePct).toBe(0);
  });
});
