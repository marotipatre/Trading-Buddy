import { describe, it, expect } from "vitest";
import { PRESETS, getPreset } from "./presets";
import { runBacktest } from "./simulator";
import { StrategyDef } from "./strategy";
import { DEFAULT_COSTS } from "./costs";
import { mulberry32 } from "./stats";
import type { Candle } from "@/lib/data/types";

function synthetic(n = 600): Candle[] {
  const rand = mulberry32(3);
  let p = 100;
  return Array.from({ length: n }, (_, i) => {
    const o = p;
    p = Math.max(5, p * (1 + (rand() - 0.48) * 0.03 + Math.sin(i / 25) * 0.003));
    const h = Math.max(o, p) * (1 + rand() * 0.01);
    const l = Math.min(o, p) * (1 - rand() * 0.01);
    return { time: 1_600_000_000 + i * 86400, open: o, high: h, low: l, close: p, volume: 1e5 };
  });
}

describe("presets", () => {
  it("has unique ids and valid, re-parseable strategies", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(StrategyDef.safeParse(p.strategy).success).toBe(true);
  });
  it("every preset runs end to end on synthetic data with sane output", () => {
    const candles = synthetic();
    for (const p of PRESETS) {
      const r = runBacktest("SYN", candles, p.strategy, DEFAULT_COSTS);
      expect(r.equity).toHaveLength(candles.length);
      expect(Number.isFinite(r.finalEquity)).toBe(true);
      expect(r.equity.every((e) => Number.isFinite(e.equity) && e.equity > 0)).toBe(true);
      for (const t of r.trades) {
        expect(t.exitIdx).toBeGreaterThanOrEqual(t.entryIdx);
        expect(t.qty).toBeGreaterThan(0);
      }
    }
  });
  it("getPreset finds by id", () => {
    expect(getPreset("ema-cross")?.label).toContain("EMA");
    expect(getPreset("nope")).toBeUndefined();
  });
});
