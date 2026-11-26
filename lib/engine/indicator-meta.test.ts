import { describe, it, expect } from "vitest";
import { INDICATORS, defaultIndicator, describeOperand, indicatorMeta } from "./indicator-meta";
import { IndicatorName, Operand } from "./strategy";
import { SeriesCache } from "./rules";
import type { Candle } from "@/lib/data/types";

const candles: Candle[] = Array.from({ length: 120 }, (_, i) => {
  const c = 100 + Math.sin(i / 7) * 10 + i * 0.1;
  return { time: i, open: c, high: c + 1, low: c - 1, close: c, volume: 1000 + i };
});

describe("indicator metadata", () => {
  it("covers every indicator in the schema exactly once", () => {
    expect(INDICATORS.map((i) => i.name).sort()).toEqual([...IndicatorName.options].sort());
  });
  it("default operands are schema-valid and compute real values", () => {
    const cache = new SeriesCache(candles);
    for (const m of INDICATORS) {
      const op = defaultIndicator(m.name);
      expect(Operand.safeParse(op).success).toBe(true);
      expect(Number.isFinite(cache.value(op, 119))).toBe(true);
    }
  });
  it("describes operands readably", () => {
    expect(describeOperand(defaultIndicator("sma"))).toBe("SMA(20)");
    expect(describeOperand({ kind: "price", field: "close", shift: 1 })).toBe("close [1 bar ago]");
    expect(describeOperand({ kind: "number", value: 30 })).toBe("30");
    expect(describeOperand(defaultIndicator("macd"))).toBe("MACD line(12,26,9)");
  });
  it("looks up metadata by name", () => {
    expect(indicatorMeta("rsi").group).toBe("Momentum");
  });
});
