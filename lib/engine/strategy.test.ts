import { describe, it, expect } from "vitest";
import { StrategyDef } from "./strategy";

const base = {
  name: "t",
  entry: { conditions: [{ left: { kind: "price", field: "close" }, op: ">", right: { kind: "number", value: 1 } }] },
};

describe("StrategyDef", () => {
  it("applies defaults", () => {
    const s = StrategyDef.parse(base);
    expect(s.direction).toBe("long");
    expect(s.sizing).toEqual({ type: "percent_equity", value: 100 });
    expect(s.entry.logic).toBe("all");
  });
  it("rejects R-multiple target without stop-loss", () => {
    const r = StrategyDef.safeParse({ ...base, target: { type: "rr", value: 2 } });
    expect(r.success).toBe(false);
  });
  it("rejects risk sizing without stop-loss", () => {
    expect(StrategyDef.safeParse({ ...base, sizing: { type: "risk_percent", value: 1 } }).success).toBe(false);
  });
  it("accepts a full stop/target setup", () => {
    const r = StrategyDef.safeParse({
      ...base,
      stopLoss: { type: "percent", value: 3 },
      target: { type: "rr", value: 2 },
      sizing: { type: "risk_percent", value: 1 },
    });
    expect(r.success).toBe(true);
  });
  it("rejects delivery shorts (not possible in NSE cash equity)", () => {
    expect(StrategyDef.safeParse({ ...base, direction: "short", product: "delivery" }).success).toBe(false);
    expect(StrategyDef.safeParse({ ...base, direction: "short", product: "intraday" }).success).toBe(true);
  });
});
