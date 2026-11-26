import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fetchGoogleQuote, parseGoogleQuote, toGoogleSymbol } from "./googlefinance";

// A real excerpt captured from the Reliance quote page.
const html = readFileSync(new URL("./fixtures/google-finance-reliance.txt", import.meta.url), "utf8");

describe("toGoogleSymbol", () => {
  it("maps NSE, BSE and index symbols", () => {
    expect(toGoogleSymbol("RELIANCE.NS")).toBe("RELIANCE:NSE");
    expect(toGoogleSymbol("tcs.ns")).toBe("TCS:NSE");
    expect(toGoogleSymbol("M&M.NS")).toBe("M%26M:NSE");
    expect(toGoogleSymbol("500325.BO")).toBe("500325:BOM");
    expect(toGoogleSymbol("^NSEI")).toBe("NIFTY_50:INDEXNSE");
    expect(toGoogleSymbol("^NSEBANK")).toBe("NIFTY_BANK:INDEXNSE");
  });
  it("returns null for unsupported symbols", () => {
    expect(toGoogleSymbol("AAPL")).toBeNull();
    expect(toGoogleSymbol("")).toBeNull();
  });
});

describe("parseGoogleQuote", () => {
  it("reads price, change, previous close, day range and time from real page data", () => {
    const q = parseGoogleQuote(html, "RELIANCE.NS")!;
    expect(q).toMatchObject({ symbol: "RELIANCE.NS", price: 1396.2, prevClose: 1373.9, dayLow: 1361.8, dayHigh: 1401.7, time: 1795688990 });
    expect(q.change).toBeCloseTo(22.3, 1);
    expect(q.changePct).toBeCloseTo(1.623, 2);
    expect(q.dayLow).toBeLessThanOrEqual(q.price);
    expect(q.dayHigh).toBeGreaterThanOrEqual(q.price);
  });
  it("falls back to the smaller tuple when the full block is absent", () => {
    const small = '...["RELIANCE","NSE"],"Reliance Industries Ltd",0,"INR",[1396.2,22.299927,1.6231114,2,2,2],null,1373.9,"#987f4b"...[1795688990],"Asia/Calcutta"';
    const q = parseGoogleQuote(small, "RELIANCE.NS")!;
    expect(q.price).toBe(1396.2);
    expect(q.prevClose).toBe(1373.9);
  });
  it("returns null for unrecognised pages instead of guessing", () => {
    expect(parseGoogleQuote("<html>nothing here</html>", "X.NS")).toBeNull();
    expect(parseGoogleQuote("", "X.NS")).toBeNull();
  });
});

describe("fetchGoogleQuote", () => {
  const ok = (body: string) => vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
  it("requests the mapped page and tags the source", async () => {
    const f = ok(html);
    const q = await fetchGoogleQuote("RELIANCE.NS", f);
    expect(f.mock.calls[0][0]).toContain("/finance/quote/RELIANCE:NSE");
    expect(q.source).toBe("google");
    expect(q.price).toBe(1396.2);
  });
  it("throws a clear error on HTTP failure, unreadable page and unsupported symbol", async () => {
    await expect(fetchGoogleQuote("RELIANCE.NS", vi.fn().mockResolvedValue(new Response("", { status: 429 })))).rejects.toThrow("HTTP 429");
    await expect(fetchGoogleQuote("RELIANCE.NS", ok("<html></html>"))).rejects.toThrow("page format may have changed");
    await expect(fetchGoogleQuote("AAPL", ok(html))).rejects.toThrow("not supported");
  });
});
