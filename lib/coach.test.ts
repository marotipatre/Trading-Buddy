import { describe, it, expect } from "vitest";
import { buildMessages, numbersIn, unknownNumbers } from "./coach";

describe("coach guard", () => {
  it("reads numbers written the Indian way", () => {
    expect(numbersIn("Up ₹1,24,500 or 6.5% this week, -3.2% last")).toEqual([124500, 6.5, -3.2]);
  });
  it("accepts figures that came from the data, to within rounding", () => {
    const src = JSON.stringify({ pnl: 124500, weekPct: 6.54, sector: "IT", weight: 46 });
    expect(unknownNumbers("You are up about ₹1,24,500, and 6.5% this week; IT is 46% of the portfolio.", src)).toEqual([]);
  });
  it("flags a figure that was not in the data", () => {
    const src = JSON.stringify({ pnl: 124500, weekPct: 6.5 });
    expect(unknownNumbers("It may reach 1800 next month and gain 22%.", src)).toEqual([1800, 22]);
  });
  it("ignores small counts and years", () => {
    expect(unknownNumbers("In 2026 you made 3 trades over 5 days.", "{}")).toEqual([]);
  });
  it("builds a short prompt that forbids inventing numbers and truncates huge data", () => {
    const m = buildMessages("portfolio", { a: "x".repeat(20000) });
    expect(m[0].content).toContain("ONLY numbers");
    expect(m[1].content.length).toBeLessThan(7000);
  });
});
