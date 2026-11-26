import { describe, it, expect } from "vitest";
import { istStampToSec, quoteFromNse } from "./nse-quote";

describe("istStampToSec", () => {
  it("reads India time", () => { expect(istStampToSec("2026-11-26 16:00:28")).toBe(Date.UTC(2026, 10, 26, 10, 30, 28) / 1000); });
  it("rejects junk", () => { expect(istStampToSec("yesterday")).toBeNull(); expect(istStampToSec(undefined)).toBeNull(); });
});

describe("quoteFromNse", () => {
  const row = { lastTradedPrice: 1396.2, preClosePrice: 1373.9, change: 22.3, perChange: 1.62, highPrice: 1401.7, lowPrice: 1361.8, latestTimestamp: "2026-11-26 16:00:28" };
  it("maps a live row to a quote tagged as NSE", () => {
    const q = quoteFromNse("RELIANCE.NS", row);
    expect(q).toMatchObject({ symbol: "RELIANCE.NS", price: 1396.2, prevClose: 1373.9, change: 22.3, changePct: 1.62, dayHigh: 1401.7, dayLow: 1361.8, source: "nse" });
  });
  it("refuses rows it cannot trust", () => {
    expect(() => quoteFromNse("X.NS", { ...row, lastTradedPrice: 0 })).toThrow();
    expect(() => quoteFromNse("X.NS", { ...row, latestTimestamp: "" })).toThrow();
  });
});
