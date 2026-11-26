import { describe, it, expect, vi } from "vitest";
import { createHistoryService, type HistoryProvider } from "./history-service";
import type { Candle } from "./types";

const bar = (t: number): Candle => ({ time: t, open: 1, high: 1, low: 1, close: 1, volume: 0 });
const prov = (name: HistoryProvider["name"], fetch: HistoryProvider["fetch"], supports: HistoryProvider["supports"] = () => true): HistoryProvider => ({ name, supports, fetch: vi.fn(fetch) });

describe("history service", () => {
  it("uses the first provider that works and reports the source", async () => {
    const a = prov("moneycontrol", async () => [bar(1)]);
    const b = prov("yahoo", async () => [bar(2)]);
    const r = await createHistoryService({ providers: [a, b] }).get("X.NS", "1d", 0, 1);
    expect(r).toEqual({ candles: [bar(1)], source: "moneycontrol" });
    expect(b.fetch).not.toHaveBeenCalled();
  });
  it("fails over on errors and on empty responses", async () => {
    const a = prov("moneycontrol", async () => { throw new Error("HTTP 503"); });
    const b = prov("yahoo", async () => [bar(2)]);
    expect((await createHistoryService({ providers: [a, b] }).get("X.NS", "1d", 0, 1)).source).toBe("yahoo");
    const c = prov("moneycontrol", async () => []);
    expect((await createHistoryService({ providers: [c, b] }).get("X.NS", "1d", 0, 1)).source).toBe("yahoo");
  });
  it("skips providers that do not support the symbol (e.g. indices)", async () => {
    const mc = prov("moneycontrol", async () => [bar(1)], (s) => s.endsWith(".NS"));
    const y = prov("yahoo", async () => [bar(2)]);
    const svc = createHistoryService({ providers: [mc, y] });
    expect((await svc.get("^NSEI", "1d", 0, 1)).source).toBe("yahoo");
    expect(mc.fetch).not.toHaveBeenCalled();
  });
  it("parks a failing provider so the next request tries the healthy one first", async () => {
    let t = 0;
    const a = prov("moneycontrol", async () => { throw new Error("x"); });
    const b = prov("yahoo", async () => [bar(2)]);
    const svc = createHistoryService({ providers: [a, b], cooldownMs: 60_000, now: () => t });
    await svc.get("X.NS", "1d", 0, 1);
    await svc.get("X.NS", "1d", 0, 1);
    expect(a.fetch).toHaveBeenCalledTimes(1);
    expect(svc.status()).toEqual({ moneycontrol: "cooling-down", yahoo: "ok" });
    t = 61_000;
    expect(svc.status().moneycontrol).toBe("ok");
  });
  it("explains every failure when all sources fail, and when none support the symbol", async () => {
    const a = prov("moneycontrol", async () => { throw new Error("HTTP 503"); });
    const b = prov("yahoo", async () => { throw new Error("HTTP 429"); });
    await expect(createHistoryService({ providers: [a, b] }).get("X.NS", "1d", 0, 1)).rejects.toThrow(/moneycontrol: HTTP 503; yahoo: HTTP 429/);
    await expect(createHistoryService({ providers: [prov("yahoo", async () => [], () => false)] }).get("X", "1d", 0, 1)).rejects.toThrow("no data source");
  });
});
