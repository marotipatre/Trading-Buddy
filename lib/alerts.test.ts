import { describe, it, expect } from "vitest";
import { activeSymbols, describeAlert, distanceToAlert, evaluateAlerts, parseAlert, validateAlert, type PriceAlert } from "./alerts";

const a = (o: Partial<PriceAlert> = {}): PriceAlert => ({ id: "1", symbol: "A.NS", direction: "above", price: 100, status: "active", createdAt: 0, ...o });

describe("validateAlert", () => {
  it("rejects alerts that would fire immediately", () => {
    expect(validateAlert("above", 99, 100)).toMatch(/higher than the current price/);
    expect(validateAlert("above", 100, 100)).toBeDefined();
    expect(validateAlert("below", 101, 100)).toMatch(/lower than the current price/);
  });
  it("accepts alerts on the far side, and bad numbers are rejected", () => {
    expect(validateAlert("above", 105, 100)).toBeUndefined();
    expect(validateAlert("below", 95, 100)).toBeUndefined();
    expect(validateAlert("above", 0, 100)).toBeDefined();
    expect(validateAlert("above", NaN, 100)).toBeDefined();
  });
  it("cannot judge the side without a price but still checks the number", () => {
    expect(validateAlert("above", 50, undefined)).toBeUndefined();
  });
});

describe("evaluateAlerts", () => {
  it("fires above-alerts at or over the price and below-alerts at or under it", () => {
    const alerts = [a({ id: "up", price: 100 }), a({ id: "dn", direction: "below", price: 90 })];
    expect(evaluateAlerts(alerts, { "A.NS": 99.99 })).toEqual([]);
    expect(evaluateAlerts(alerts, { "A.NS": 100 }).map((h) => h.alert.id)).toEqual(["up"]);
    expect(evaluateAlerts(alerts, { "A.NS": 90 }).map((h) => h.alert.id)).toEqual(["dn"]);
    expect(evaluateAlerts(alerts, { "A.NS": 120 }).map((h) => h.alert.id)).toEqual(["up"]);
  });
  it("ignores triggered, cancelled and unpriced alerts", () => {
    const alerts = [a({ id: "t", status: "triggered" }), a({ id: "c", status: "cancelled" }), a({ id: "x", symbol: "B.NS" })];
    expect(evaluateAlerts(alerts, { "A.NS": 500 })).toEqual([]);
    expect(evaluateAlerts([a()], { "A.NS": NaN })).toEqual([]);
  });
  it("reports the price that triggered it", () => {
    expect(evaluateAlerts([a()], { "A.NS": 103 })[0].price).toBe(103);
  });
});

describe("helpers", () => {
  it("lists each symbol with an active alert once", () => {
    expect(activeSymbols([a(), a({ id: "2" }), a({ id: "3", symbol: "B.NS" }), a({ id: "4", symbol: "C.NS", status: "triggered" })]).sort()).toEqual(["A.NS", "B.NS"]);
  });
  it("describes and measures distance", () => {
    expect(describeAlert(a())).toBe("rises to 100.00");
    expect(describeAlert(a({ direction: "below", price: 90 }))).toBe("falls to 90.00");
    expect(distanceToAlert(a({ price: 110 }), 100)).toBeCloseTo(10);
    expect(distanceToAlert(a({ direction: "below", price: 90 }), 100)).toBeCloseTo(10);
    expect(distanceToAlert(a(), 0)).toBeNaN();
  });
  it("parses rows and skips malformed ones", () => {
    const row = { id: "x", symbol: "A.NS", direction: "below", price: 90, status: "triggered", created_at: "2026-11-26T00:00:00Z", triggered_at: "2026-11-27T00:00:00Z", triggered_price: 89.5, note: "n" };
    expect(parseAlert(row)).toMatchObject({ id: "x", direction: "below", status: "triggered", triggeredPrice: 89.5, note: "n" });
    expect(parseAlert({ ...row, direction: "sideways" })).toBeNull();
    expect(parseAlert({ ...row, price: -1 })).toBeNull();
    expect(parseAlert({ ...row, status: "weird" })).toBeNull();
    expect(parseAlert({})).toBeNull();
  });
});
