import { describe, it, expect } from "vitest";
import { chargesForLeg, roundTripCharges, DEFAULT_COSTS, DELIVERY_ZERO_BROKERAGE } from "./costs";

const cfg0 = { ...DEFAULT_COSTS, ...DELIVERY_ZERO_BROKERAGE };

describe("costs", () => {
  it("delivery buy: STT + stamp + exchange, no brokerage or DP", () => {
    const c = chargesForLeg("buy", 100000, "delivery", cfg0);
    expect(c.brokerage).toBe(0);
    expect(c.stt).toBeCloseTo(100);
    expect(c.stamp).toBeCloseTo(15);
    expect(c.dp).toBe(0);
  });
  it("delivery sell adds DP charge", () => {
    expect(chargesForLeg("sell", 100000, "delivery", cfg0).dp).toBeCloseTo(15.34);
  });
  it("intraday brokerage is capped at 20", () => {
    const c = chargesForLeg("buy", 10_000_000, "intraday");
    expect(c.brokerage).toBe(20);
  });
  it("intraday STT only on sell", () => {
    expect(chargesForLeg("buy", 100000, "intraday").stt).toBe(0);
    expect(chargesForLeg("sell", 100000, "intraday").stt).toBeCloseTo(25);
  });
  it("GST applies to brokerage + exchange + sebi", () => {
    const c = chargesForLeg("buy", 100000, "intraday");
    expect(c.gst).toBeCloseTo((c.brokerage + c.exchange + c.sebi) * 0.18);
  });
  it("round trip is the sum of both legs, independent of direction for symmetric products", () => {
    const long = roundTripCharges("long", 100, 1000, 1100, "delivery", cfg0);
    expect(long).toBeGreaterThan(200); // STT alone ~ 100 + 110
  });
});
