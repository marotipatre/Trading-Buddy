import { describe, it, expect } from "vitest";
import { walkTrade, entryFill, type WalkRules } from "./walk";
import type { Candle } from "@/lib/data/types";

const bar = (o: number, h: number, l: number, c: number): Candle => ({ time: 0, open: o, high: h, low: l, close: c, volume: 0 });
const rules = (r: Partial<WalkRules> = {}): WalkRules => ({ direction: "long", product: "delivery", slippageBps: 0, ...r });

describe("walkTrade (long)", () => {
  it("stop hit on the entry bar fills at the stop", () => {
    const c = [bar(100, 102, 94, 96)];
    const r = walkTrade(c, 0, 100, rules({ stopDist: 5 }));
    expect(r).toMatchObject({ exitIdx: 0, exitPrice: 95, exitReason: "stop" });
    expect(r.maePct).toBeCloseTo(5);
  });

  it("gap through the stop fills at the open, not the stop", () => {
    const c = [bar(100, 101, 99, 100), bar(90, 92, 88, 91)];
    const r = walkTrade(c, 0, 100, rules({ stopDist: 5 }));
    expect(r).toMatchObject({ exitIdx: 1, exitPrice: 90, exitReason: "stop", barsHeld: 1 });
  });

  it("stop wins when stop and target are both inside one bar", () => {
    const c = [bar(100, 112, 94, 100)];
    const r = walkTrade(c, 0, 100, rules({ stopDist: 5, targetDist: 10 }));
    expect(r.exitReason).toBe("stop");
  });

  it("target fills at the target price", () => {
    const c = [bar(100, 101, 99, 100), bar(101, 111, 100, 110)];
    const r = walkTrade(c, 0, 100, rules({ stopDist: 5, targetDist: 10 }));
    expect(r).toMatchObject({ exitIdx: 1, exitPrice: 110, exitReason: "target" });
    expect(r.mfePct).toBeCloseTo(10);
  });

  it("trailing stop uses the existing stop first (no lookahead)", () => {
    // bar1 makes a high of 110 and a low of 104: old stop (95) is not hit, new stop becomes 105.
    const c = [bar(100, 101, 99, 100), bar(101, 110, 104, 108), bar(108, 109, 103, 104)];
    const r = walkTrade(c, 0, 100, rules({ stopDist: 5, trailing: true }));
    expect(r).toMatchObject({ exitIdx: 2, exitPrice: 105, exitReason: "stop" });
  });

  it("time stop exits at the NEXT open after maxHoldBars", () => {
    const c = [bar(100, 101, 99, 100), bar(100, 101, 99, 100), bar(103, 104, 102, 103), bar(1, 1, 1, 1)];
    const r = walkTrade(c, 0, 100, rules({ maxHoldBars: 2 }));
    expect(r).toMatchObject({ exitIdx: 2, exitPrice: 103, exitReason: "time", barsHeld: 2 });
  });

  it("exit signal fills at the next open", () => {
    const c = [bar(100, 101, 99, 100), bar(100, 101, 99, 100), bar(107, 108, 106, 107)];
    const r = walkTrade(c, 0, 100, rules({ exitSignal: [false, true, false] }));
    expect(r).toMatchObject({ exitIdx: 2, exitPrice: 107, exitReason: "signal" });
  });

  it("closes at the last close when data ends", () => {
    const c = [bar(100, 101, 99, 100), bar(100, 103, 99, 102)];
    const r = walkTrade(c, 0, 100, rules());
    expect(r).toMatchObject({ exitIdx: 1, exitPrice: 102, exitReason: "end" });
  });

  it("applies slippage against the trader on exit", () => {
    const c = [bar(100, 102, 94, 96)];
    const r = walkTrade(c, 0, 100, rules({ stopDist: 5, slippageBps: 100 }));
    expect(r.exitPrice).toBeCloseTo(95 * 0.99);
  });

  it("intraday exits at the entry bar close", () => {
    const c = [bar(100, 105, 99, 103), bar(1, 1, 1, 1)];
    const r = walkTrade(c, 0, 100, rules({ product: "intraday" }));
    expect(r).toMatchObject({ exitIdx: 0, exitPrice: 103, exitReason: "time" });
  });
});

describe("walkTrade (short)", () => {
  it("mirrors the long logic", () => {
    const c = [bar(100, 106, 99, 104)];
    const r = walkTrade(c, 0, 100, rules({ direction: "short", product: "intraday", stopDist: 5 }));
    expect(r).toMatchObject({ exitPrice: 105, exitReason: "stop" });
  });
  it("short exit slippage pushes the buy price up", () => {
    const c = [bar(100, 106, 99, 104)];
    const r = walkTrade(c, 0, 100, rules({ direction: "short", product: "intraday", stopDist: 5, slippageBps: 100 }));
    expect(r.exitPrice).toBeCloseTo(105 * 1.01);
  });
});

describe("entryFill", () => {
  it("slips against the trader", () => {
    expect(entryFill(100, "long", 100)).toBeCloseTo(101);
    expect(entryFill(100, "short", 100)).toBeCloseTo(99);
  });
});
