import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCandles, pool } from "./candle-cache";

beforeEach(() => { vi.restoreAllMocks(); });

describe("fetchCandles", () => {
  it("downloads once for repeated and simultaneous requests", async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ candles: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }] }) }));
    vi.stubGlobal("fetch", f);
    const [a, b] = await Promise.all([fetchCandles("AAA.NS", 800), fetchCandles("AAA.NS", 800)]);
    await fetchCandles("AAA.NS", 800);
    expect(a).toBe(b);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("reports an API error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "no data" }) })));
    await expect(fetchCandles("BBB.NS", 800)).rejects.toThrow("no data");
  });
});

describe("pool", () => {
  it("never runs more than n at once and visits everything", async () => {
    let active = 0, peak = 0;
    const seen: number[] = [];
    await pool([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async (x) => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 2)); seen.push(x); active--; });
    expect(peak).toBeLessThanOrEqual(3);
    expect(seen.sort((a, b) => a - b)).toHaveLength(10);
  });
  it("stops early", async () => {
    let n = 0;
    await pool([1, 2, 3, 4, 5], 1, async () => { n++; }, () => n >= 2);
    expect(n).toBe(2);
  });
});
