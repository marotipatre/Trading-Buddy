import { describe, it, expect } from "vitest";
import { compareStrategies, judge, type LabEntry } from "./lab";
import { PRESETS } from "./presets";
import type { Candle } from "@/lib/data/types";
import type { ScanSummary } from "./scan";

const market = (seed: number): Candle[] => Array.from({ length: 1500 }, (_, i) => {
  const c = 100 * Math.pow(1.0006 + seed * 0.00005, i) + Math.sin(i / (9 + seed)) * 7 + Math.sin(i / 2.3) * 2;
  return { time: 1_500_000_000 + i * 86400, open: c - 0.3, high: c + 1.6, low: c - 1.6, close: c, volume: 1e5 };
});

describe("strategy lab", () => {
  const entries: LabEntry[] = PRESETS.slice(0, 4).map((p) => ({ id: p.id, label: p.label, strategy: p.strategy }));
  const data = [0, 1, 2, 3].map((i) => ({ symbol: `S${i}.NS`, candles: market(i) }));
  const rows = compareStrategies(entries, data);
  it("returns one row per strategy, each from the same stocks", () => {
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r.id)).size).toBe(4);
    expect(rows.every((r) => r.summary.symbols === 4)).toBe(true);
  });
  it("ranks rows with enough later-period trades above those without", () => {
    const enough = rows.map((r) => r.summary.outSample.trades >= 20);
    const firstShort = enough.indexOf(false);
    if (firstShort >= 0) expect(enough.slice(firstShort).every((x) => !x)).toBe(true);
  });
  it("judges clearly good, bad and thin results", () => {
    const base = { pooled: { trades: 200, expectancyPct: 1.2, profitFactor: 1.5 }, outSample: { trades: 60, expectancyPct: 0.8 }, profitableShare: 0.7 } as unknown as ScanSummary;
    expect(judge(base).verdict).toBe("promising");
    expect(judge({ ...base, outSample: { trades: 60, expectancyPct: -0.4 } } as unknown as ScanSummary).verdict).toBe("weak");
    expect(judge({ ...base, pooled: { trades: 30, expectancyPct: 1, profitFactor: 2 } } as unknown as ScanSummary).verdict).toBe("too few trades");
  });
});
