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

describe("accuracy guards", () => {
  it("does not apply debt ratios to banks and lenders", () => {
    const s = scoreFundamentals({ profit3y: 25, sales3y: 20, roce: 8, roe: 14, debtToEquity: 6, financial: true, promoter: 55, pe: 12, mcapCr: 9000 });
    expect(s.flags.some((x) => x.includes("Borrowings"))).toBe(false);
  });
  it("gives little growth credit and a loss flag when there is no P/E", () => {
    const loss = scoreFundamentals({ profit3y: 40, sales3y: 30, roce: 20, roe: 20, promoter: 60, noPe: true, mcapCr: 800 });
    const ok = scoreFundamentals({ profit3y: 40, sales3y: 30, roce: 20, roe: 20, promoter: 60, pe: 20, mcapCr: 800 });
    expect(loss.score).toBeLessThan(ok.score - 15);
    expect(loss.flags.some((x) => x.includes("No positive P/E"))).toBe(true);
  });
  it("flags negative net worth and words promoter changes as a fact, not an accusation", () => {
    const s = scoreFundamentals({ bookValue: -4, promoter: 20, promoterStart: 45, promoterChange: -25, noPe: true, roce: -2, mcapCr: 5000 });
    expect(s.flags.some((x) => x.includes("Negative book value"))).toBe(true);
    expect(s.flags.some((x) => x.includes("fell from 45.0% to 20.0%"))).toBe(true);
    expect(s.flags.join(" ")).not.toMatch(/sold/);
  });
  it("marks banks as financial when parsing", () => {
    const f = parseScreener("<h1>X Bank Ltd</h1> Market Cap ₹ 5,000 Cr. Stock P/E 10 ROCE 7 % ROE 11 % Deposits + 100 120 150 Borrowings + 10 20 30");
    expect(f?.financial).toBe(true);
  });
});
