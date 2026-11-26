import { describe, it, expect } from "vitest";
import { parseMarket } from "./market";
import { bucketOf, stage1 } from "./screen";

const row = (o: Record<string, unknown>) => ({ symbol: "ABC", series: "EQ", lastTradedPrice: 100, preClosePrice: 99, perChange: 1, volume: 1e6, value: 5, fiftyTwoWeekHigh: 110, fiftyTwoWeekLow: 50, perChange30d: 12, ...o });

describe("parseMarket", () => {
  it("keeps equity and drops ETFs, funds, bad prices and other series", () => {
    const r = parseMarket({ stocks: [row({}), row({ symbol: "NV20BEES" }), row({ symbol: "GOLDBEES" }), row({ symbol: "XYZ", series: "SM" }), row({ symbol: "ZERO", lastTradedPrice: 0 }), row({ symbol: "REAL", series: "BE" })] });
    expect(r.map((x) => x.symbol)).toEqual(["ABC", "REAL"]);
  });
});

describe("buckets", () => {
  it("calls anything under 50 rupees a penny stock", () => {
    expect(bucketOf(30, "small")).toBe("penny"); expect(bucketOf(200, "small")).toBe("small"); expect(bucketOf(200, "micro")).toBe("micro"); expect(bucketOf(200)).toBe("other");
  });
});

describe("stage1", () => {
  const rows = parseMarket({ stocks: [row({ symbol: "GOOD" }), row({ symbol: "LARGE" }), row({ symbol: "LOWS", lastTradedPrice: 52 }), row({ symbol: "THIN", value: 0.01 }), row({ symbol: "TINY", lastTradedPrice: 3 })] });
  const cap = (s: string) => (s === "LARGE" ? "large" as const : s === "GOOD" ? "small" as const : undefined);
  const out = stage1(rows, cap);
  it("drops large caps, near-lows, thin and sub-5-rupee stocks", () => { expect(out.map((x) => x.row.symbol)).toEqual(["GOOD"]); });
  it("explains why a stock passed", () => { expect(out[0].why.length).toBeGreaterThan(0); expect(out[0].bucket).toBe("small"); });
});
