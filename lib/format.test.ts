import { describe, it, expect } from "vitest";
import { fmtInr, fmtPct, fmtNum, fmtDate } from "./format";

describe("format", () => {
  it("formats rupees with Indian grouping", () => {
    expect(fmtInr(1234567)).toBe("₹12,34,567");
    expect(fmtInr(-1500)).toBe("-₹1,500");
    expect(fmtInr(500, { sign: true })).toBe("+₹500");
    expect(fmtInr(NaN)).toBe("—");
  });
  it("formats percentages", () => {
    expect(fmtPct(12.345)).toBe("12.3%");
    expect(fmtPct(2.5, 1, { sign: true })).toBe("+2.5%");
    expect(fmtPct(-2.5, 1, { sign: true })).toBe("-2.5%");
    expect(fmtPct(Infinity)).toBe("∞");
    expect(fmtPct(NaN)).toBe("—");
  });
  it("formats numbers", () => {
    expect(fmtNum(1.2345)).toBe("1.23");
    expect(fmtNum(Infinity)).toBe("∞");
    expect(fmtNum(NaN)).toBe("—");
  });
  it("formats dates in IST", () => {
    expect(fmtDate(Date.UTC(2024, 2, 12, 12, 0) / 1000)).toBe("12 Mar 2024");
  });
});
