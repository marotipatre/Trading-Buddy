import { describe, it, expect } from "vitest";
import { tradeChecks } from "./trade-check";

const base = { closing: false, hasStop: true, positionPctOfCash: 20, product: "delivery" as const };
describe("tradeChecks", () => {
  it("says nothing when closing a position", () => { expect(tradeChecks({ ...base, closing: true, hasStop: false })).toEqual([]); });
  it("warns when there is no stop", () => {
    const c = tradeChecks({ ...base, hasStop: false });
    expect(c[0].level).toBe("warn");
    expect(c.some((x) => x.text.includes("Risk is"))).toBe(false);
  });
  it("passes a sound plan", () => {
    const c = tradeChecks({ ...base, riskPctOfCash: 0.8, rr: 2.5 });
    expect(c.every((x) => x.level === "ok")).toBe(true);
    expect(c).toHaveLength(3);
  });
  it("warns on large risk, poor reward, big size and late intraday", () => {
    const c = tradeChecks({ closing: false, hasStop: true, riskPctOfCash: 4, rr: 1, positionPctOfCash: 70, product: "intraday", minutesIst: 15 * 60 });
    expect(c.filter((x) => x.level === "warn")).toHaveLength(4);
  });
});
