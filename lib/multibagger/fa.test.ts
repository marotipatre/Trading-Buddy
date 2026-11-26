import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseScreener, scoreFundamentals } from "./fa";

const html = readFileSync(join(__dirname, "fixtures/screener-sample.html"), "utf8");

describe("parseScreener", () => {
  const f = parseScreener(html)!;
  it("reads the headline ratios", () => {
    expect(f.mcapCr).toBe(11093); expect(f.pe).toBeCloseTo(49.2); expect(f.roce).toBeCloseTo(45.3); expect(f.roe).toBeCloseTo(31.7);
  });
  it("reads growth, promoter holding and debt", () => {
    expect(f.sales3y).toBe(28); expect(f.profit3y).toBe(32); expect(f.profitTtm).toBe(83);
    expect(f.promoter).toBeCloseTo(87.28);
    expect(f.borrowings).toBeGreaterThan(0);
  });
  it("returns null for a page that is not a company page", () => { expect(parseScreener("<html>Too many requests</html>")).toBeNull(); });
});

describe("scoreFundamentals", () => {
  it("rewards fast profitable growth with returns and low debt", () => {
    const s = scoreFundamentals({ profit3y: 35, sales3y: 28, profitTtm: 40, roce: 28, roe: 24, debtToEquity: 0.1, promoter: 60, pe: 25, mcapCr: 1500 });
    expect(s.score).toBeGreaterThan(80); expect(s.flags).toEqual([]);
  });
  it("punishes losses, debt and promoter selling", () => {
    const s = scoreFundamentals({ profit3y: -10, sales3y: 3, roce: 4, debtToEquity: 2.4, promoter: 20, promoterChange: -6, pe: -5, mcapCr: 50 });
    expect(s.score).toBeLessThan(25);
    expect(s.flags.length).toBeGreaterThanOrEqual(4);
  });
  it("says so when there is too little data", () => { expect(scoreFundamentals({ pe: 20 }).flags[0]).toContain("Too little"); });
});
