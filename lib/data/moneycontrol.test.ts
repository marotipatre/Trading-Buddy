import { describe, it, expect, vi } from "vitest";
import { fetchMoneycontrolCandles, normalizeDailyTime, parseMoneycontrolHistory, toMoneycontrolSymbol } from "./moneycontrol";

// 2024-03-15 in IST at both timestamp styles the API has used.
const MIDNIGHT_UTC = Date.UTC(2024, 2, 15) / 1000;
const FIVE_THIRTY_UTC = Date.UTC(2024, 2, 15, 5, 30) / 1000;
const OPEN = Date.UTC(2024, 2, 15, 3, 45) / 1000; // 09:15 IST

const body = (over: Record<string, unknown> = {}) => ({
  s: "ok", t: [MIDNIGHT_UTC, MIDNIGHT_UTC + 86400], o: [100, 102], h: [103, 106], l: [99, 101], c: [102, 105], v: [1000, 2000], ...over,
});

describe("toMoneycontrolSymbol", () => {
  it("supports NSE equities only", () => {
    expect(toMoneycontrolSymbol("RELIANCE.NS")).toBe("RELIANCE");
    expect(toMoneycontrolSymbol("m&m.ns")).toBe("M&M");
    expect(toMoneycontrolSymbol("^NSEI")).toBeNull();
    expect(toMoneycontrolSymbol("500325.BO")).toBeNull();
  });
});

describe("normalizeDailyTime", () => {
  it("maps both observed stamp styles onto the same 09:15 IST bar", () => {
    expect(normalizeDailyTime(MIDNIGHT_UTC)).toBe(OPEN);
    expect(normalizeDailyTime(FIVE_THIRTY_UTC)).toBe(OPEN);
  });
});

describe("parseMoneycontrolHistory", () => {
  it("converts valid daily bars", () => {
    const c = parseMoneycontrolHistory(body(), "1d");
    expect(c).toHaveLength(2);
    expect(c[0]).toEqual({ time: OPEN, open: 100, high: 103, low: 99, close: 102, volume: 1000 });
  });
  it("merges duplicate days that come with different stamps (last wins) and sorts", () => {
    const c = parseMoneycontrolHistory(body({ t: [FIVE_THIRTY_UTC, MIDNIGHT_UTC], o: [1, 100], h: [1, 103], l: [1, 99], c: [1, 102], v: [1, 1000] }), "1d");
    expect(c).toHaveLength(1);
    expect(c[0].close).toBe(102);
  });
  it("drops corrupt bars instead of passing them on", () => {
    const c = parseMoneycontrolHistory(body({ o: [100, 0], h: [103, 106], l: [99, 101], c: [102, 105] }), "1d");
    expect(c).toHaveLength(1);
    expect(parseMoneycontrolHistory(body({ h: [90, 106] }), "1d")).toHaveLength(1); // high below low/close
  });
  it("returns [] for error or malformed responses", () => {
    expect(parseMoneycontrolHistory({ s: "no_data" }, "1d")).toEqual([]);
    expect(parseMoneycontrolHistory(null, "1d")).toEqual([]);
    expect(parseMoneycontrolHistory({ s: "ok", t: [1] }, "1d")).toEqual([]);
  });
  it("keeps real timestamps for intraday bars", () => {
    const c = parseMoneycontrolHistory(body({ t: [1_700_000_000, 1_700_000_900] }), "15m");
    expect(c.map((x) => x.time)).toEqual([1_700_000_000, 1_700_000_900]);
  });
});

describe("fetchMoneycontrolCandles", () => {
  const from = MIDNIGHT_UTC - 86400, to = MIDNIGHT_UTC + 3 * 86400;
  it("requests the mapped symbol and returns bars in range", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(body()), { status: 200 }));
    const c = await fetchMoneycontrolCandles("RELIANCE.NS", "1d", from, to, f);
    expect(String(f.mock.calls[0][0])).toContain("symbol=RELIANCE&resolution=1D");
    expect(c).toHaveLength(2);
  });
  it("throws clearly for unsupported symbols, HTTP errors and empty results", async () => {
    await expect(fetchMoneycontrolCandles("^NSEI", "1d", from, to, vi.fn())).rejects.toThrow("not supported");
    await expect(fetchMoneycontrolCandles("X.NS", "1d", from, to, vi.fn().mockResolvedValue(new Response("", { status: 503 })))).rejects.toThrow("HTTP 503");
    await expect(fetchMoneycontrolCandles("X.NS", "1d", from, to, vi.fn().mockResolvedValue(new Response(JSON.stringify({ s: "no_data" }), { status: 200 })))).rejects.toThrow("no price history");
  });
  it("caps the requested bar count", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(body()), { status: 200 }));
    await fetchMoneycontrolCandles("X.NS", "1d", 0, 4_000_000_000, f).catch(() => {});
    expect(String(f.mock.calls[0][0])).toContain("countback=3000");
  });
});
