import { describe, it, expect, vi } from "vitest";
import { createQuoteService, type QuoteProvider } from "./quote-service";
import type { Quote } from "./types";

const q = (symbol: string, price: number, source?: Quote["source"]): Quote => ({
  symbol, price, prevClose: price, change: 0, changePct: 0, dayHigh: price, dayLow: price, marketState: "", time: 1, source,
});
const provider = (name: QuoteProvider["name"], impl: QuoteProvider["fetch"]): QuoteProvider => ({ name, fetch: vi.fn(impl) });

describe("quote service", () => {
  it("uses the first provider and tags the source", async () => {
    const y = provider("yahoo", async (s) => q(s, 100));
    const g = provider("google", async (s) => q(s, 999));
    const svc = createQuoteService({ providers: [y, g] });
    const [r] = await svc.getQuotes(["A.NS"]);
    expect(r).toMatchObject({ price: 100, source: "yahoo" });
    expect(g.fetch).not.toHaveBeenCalled();
  });

  it("falls back to the next provider on failure", async () => {
    const y = provider("yahoo", async () => { throw new Error("HTTP 429"); });
    const g = provider("google", async (s) => q(s, 55, "google"));
    const [r] = await createQuoteService({ providers: [y, g] }).getQuotes(["A.NS"]);
    expect(r).toMatchObject({ price: 55, source: "google" });
  });

  it("parks a failing provider so later requests skip it first", async () => {
    let t = 0;
    const y = provider("yahoo", async () => { throw new Error("429"); });
    const g = provider("google", async (s) => q(s, 55));
    const svc = createQuoteService({ providers: [y, g], ttlMs: 0, cooldownMs: 60_000, now: () => t });
    await svc.getQuotes(["A.NS"]);
    expect(svc.status()).toEqual({ yahoo: "cooling-down", google: "ok" });
    await svc.getQuotes(["B.NS"]);
    expect(y.fetch).toHaveBeenCalledTimes(1); // Google answered first the second time
    t = 61_000;
    expect(svc.status().yahoo).toBe("ok");
  });

  it("still tries parked providers last when nothing else works", async () => {
    const y = provider("yahoo", vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(q("A.NS", 7)));
    const g = provider("google", async () => { throw new Error("blocked"); });
    const svc = createQuoteService({ providers: [y, g], ttlMs: 0 });
    expect(await svc.getQuotes(["A.NS"])).toEqual([]); // both failed
    expect((await svc.getQuotes(["A.NS"]))[0].price).toBe(7); // yahoo recovered even while parked
  });

  it("serves fresh cache without calling providers, then refreshes after the TTL", async () => {
    let t = 0;
    const y = provider("yahoo", async (s) => q(s, t === 0 ? 1 : 2));
    const svc = createQuoteService({ providers: [y], ttlMs: 8000, now: () => t });
    await svc.getQuotes(["A.NS"]);
    t = 5000;
    expect((await svc.getQuotes(["A.NS"]))[0].price).toBe(1);
    expect(y.fetch).toHaveBeenCalledTimes(1);
    t = 9000;
    expect((await svc.getQuotes(["A.NS"]))[0].price).toBe(2);
  });

  it("returns the last known quote when every provider fails", async () => {
    let t = 0;
    let fail = false;
    const y = provider("yahoo", async (s) => { if (fail) throw new Error("down"); return q(s, 42); });
    const svc = createQuoteService({ providers: [y], ttlMs: 1000, now: () => t });
    await svc.getQuotes(["A.NS"]);
    fail = true;
    t = 5000;
    expect((await svc.getQuotes(["A.NS"]))[0].price).toBe(42);
  });

  it("preserves order and omits symbols no provider could price", async () => {
    const y = provider("yahoo", async (s) => { if (s === "BAD.NS") throw new Error("no"); return q(s, s.length); });
    const r = await createQuoteService({ providers: [y], concurrency: 2 }).getQuotes(["AA.NS", "BAD.NS", "C.NS"]);
    expect(r.map((x) => x.symbol)).toEqual(["AA.NS", "C.NS"]);
  });
});

describe("quote service with a time-dependent TTL", () => {
  it("keeps quotes much longer when the TTL function says the market is closed", async () => {
    let t = 0;
    let open = false;
    const y = provider("yahoo", async (s) => q(s, 1));
    const svc = createQuoteService({ providers: [y], ttlMs: () => (open ? 8_000 : 600_000), now: () => t });
    await svc.getQuotes(["A.NS"]);
    t = 120_000;
    await svc.getQuotes(["A.NS"]);
    expect(y.fetch).toHaveBeenCalledTimes(1); // closed: still cached after 2 minutes
    open = true;
    await svc.getQuotes(["A.NS"]);
    expect(y.fetch).toHaveBeenCalledTimes(2); // open: 2 minutes is stale
  });
});

describe("fallback quotes expire quickly", () => {
  it("a quote from a fallback source is re-asked after the cooldown, not after the long TTL", async () => {
    let t = 0;
    let primaryDown = true;
    const primary = provider("upstox", async (s) => { if (primaryDown) throw new Error("blip"); return q(s, 100); });
    const backup = provider("yahoo", async (s) => q(s, 99));
    const svc = createQuoteService({ providers: [primary, backup], ttlMs: () => 600_000, cooldownMs: 60_000, now: () => t });
    expect((await svc.getQuotes(["A.NS"]))[0]).toMatchObject({ price: 99, source: "yahoo" });
    primaryDown = false;
    t = 30_000;
    expect((await svc.getQuotes(["A.NS"]))[0].source).toBe("yahoo"); // still within the cooldown
    t = 61_000;
    expect((await svc.getQuotes(["A.NS"]))[0]).toMatchObject({ price: 100, source: "upstox" }); // back to the primary
  });
  it("a quote from the primary source still gets the full TTL", async () => {
    let t = 0;
    const primary = provider("upstox", async (s) => q(s, 100));
    const svc = createQuoteService({ providers: [primary], ttlMs: () => 600_000, cooldownMs: 60_000, now: () => t });
    await svc.getQuotes(["A.NS"]);
    t = 300_000;
    await svc.getQuotes(["A.NS"]);
    expect(primary.fetch).toHaveBeenCalledTimes(1);
  });
});
