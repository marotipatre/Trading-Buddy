import { describe, it, expect } from "vitest";
import { computeIndicators, parseSpecs } from "./chart-indicators";
import type { Candle } from "@/lib/data/types";

const candles: Candle[] = Array.from({ length: 120 }, (_, i) => { const c = 100 + Math.sin(i / 8) * 10; return { time: i * 86400, open: c, high: c + 1, low: c - 1, close: c, volume: 1 }; });
describe("chart indicators", () => {
  it("computes overlay and pane lines", () => {
    const l = computeIndicators(candles, parseSpecs([{ kind: "ema", period: 20 }, { kind: "rsi", period: 14 }, { kind: "supertrend", period: 10, mult: 3 }, { kind: "bb", period: 20, mult: 2 }]));
    expect(l.find((x) => x.label === "EMA 20")!.pane).toBe(0);
    const rsi = l.find((x) => x.label === "RSI 14")!;
    expect(rsi.pane).toBe(1);
    expect(rsi.points.every((p) => p.value >= 0 && p.value <= 100)).toBe(true);
    expect(l.find((x) => x.label.startsWith("Supertrend"))!.points.every((p) => p.color)).toBe(true);
    expect(l.filter((x) => x.label.startsWith("BB"))).toHaveLength(3);
  });
  it("drops invalid saved specs", () => {
    expect(parseSpecs([{ kind: "ema", period: 1 }, { kind: "nope", period: 20 }, { kind: "sma", period: 50 }, "x", null])).toHaveLength(1);
    expect(parseSpecs("junk")).toEqual([]);
  });
});
