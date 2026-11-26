import { z } from "zod";
import type { Analysis } from "@/lib/engine/analyze";
import type { ScanSummary } from "@/lib/engine/scan";
import { StrategyDef } from "@/lib/engine/strategy";

/** Everything needed to run the same test again later. */
export const SavedConfig = z.object({
  mode: z.enum(["one", "group", "optimize"]),
  symbol: z.string().optional(),
  years: z.number().int().min(1).max(20),
  strategy: StrategyDef,
  slippageBps: z.number().min(0).max(500),
  zeroBrokerage: z.boolean(),
  group: z.object({ cap: z.enum(["all", "large", "mid", "small", "micro", "other", "sme"]), sector: z.string(), count: z.number().int().min(1).max(200) }).optional(),
  optimize: z.object({ scope: z.enum(["one", "group"]), param: z.enum(["stopPct", "stopAtr", "maxHold", "targetPct"]), objective: z.enum(["expectancy", "profitFactor"]) }).optional(),
});
export type SavedConfig = z.infer<typeof SavedConfig>;

/** Headline numbers kept with a saved run so the list and comparison need no re-computation. */
export interface Summary {
  kind: "one" | "group" | "optimize";
  label: string;
  trades: number;
  winRate: number | null;
  winRateLow: number | null;
  winRateHigh: number | null;
  expectancyPct: number | null;
  profitFactor: number | null;
  totalReturnPct?: number | null;
  buyHoldPct?: number | null;
  maxDrawdownPct?: number | null;
  /** Result on the later, unseen part of history. */
  unseenExpectancyPct?: number | null;
  stocks?: number;
  note?: string;
}

export interface SavedRun {
  id: string;
  name: string;
  createdAt: number;
  config: SavedConfig;
  summary: Summary;
}

const num = (x: number | undefined): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

export function summaryFromAnalysis(a: Analysis, label: string): Summary {
  const m = a.metrics;
  return {
    kind: "one", label, trades: m.trades, winRate: num(m.winRate), winRateLow: num(m.winRateCI[0]), winRateHigh: num(m.winRateCI[1]),
    expectancyPct: num(m.expectancyPct), profitFactor: Number.isFinite(m.profitFactor) ? m.profitFactor : null,
    totalReturnPct: num(m.totalReturnPct), buyHoldPct: num(a.buyHoldReturnPct), maxDrawdownPct: num(m.maxDrawdownPct),
    unseenExpectancyPct: num(a.outOfSample?.outSample.expectancyPct),
  };
}

export function summaryFromScan(s: ScanSummary, label: string): Summary {
  return {
    kind: "group", label, trades: s.pooled.trades, winRate: num(s.pooled.winRate), winRateLow: num(s.pooled.winRateCI[0]), winRateHigh: num(s.pooled.winRateCI[1]),
    expectancyPct: num(s.pooled.expectancyPct), profitFactor: Number.isFinite(s.pooled.profitFactor) ? s.pooled.profitFactor : null,
    totalReturnPct: num(s.medianStrategyReturnPct), buyHoldPct: num(s.medianBuyHoldPct), unseenExpectancyPct: num(s.outSample.expectancyPct), stocks: s.symbols,
  };
}

export function summaryFromOptimize(label: string, recommended: string | null, unseenExpectancyPct: number | null, trades: number, stocks: number): Summary {
  return {
    kind: "optimize", label, trades, winRate: null, winRateLow: null, winRateHigh: null, expectancyPct: null, profitFactor: null,
    unseenExpectancyPct, stocks, note: recommended ? `Recommended ${recommended}` : "No stable recommendation",
  };
}

/** Pure: which of two saved runs is better on each shared headline number (for the comparison highlights). */
export function compareRuns(runs: SavedRun[]): Record<string, string | null> {
  const best = (pick: (s: Summary) => number | null | undefined, higher = true) => {
    const vals = runs.map((r) => ({ id: r.id, v: pick(r.summary) })).filter((x): x is { id: string; v: number } => typeof x.v === "number");
    if (vals.length < 2) return null;
    return vals.reduce((a, b) => (higher ? (b.v > a.v ? b : a) : (b.v < a.v ? b : a))).id;
  };
  return {
    winRate: best((s) => s.winRate),
    expectancy: best((s) => s.expectancyPct),
    profitFactor: best((s) => s.profitFactor),
    unseen: best((s) => s.unseenExpectancyPct),
    drawdown: best((s) => s.maxDrawdownPct, false),
  };
}

/** Parse a stored row defensively: a corrupt or old-format run is skipped, never crashes the page. */
export function parseRun(row: { id: string; name: string; created_at: string; strategy: unknown; summary: unknown; years?: number; symbol?: string }): SavedRun | null {
  try {
    const cfg = SavedConfig.safeParse((row.strategy as { config?: unknown })?.config);
    if (!cfg.success || !row.summary || typeof row.summary !== "object") return null;
    return { id: row.id, name: row.name, createdAt: Date.parse(row.created_at) / 1000, config: cfg.data, summary: row.summary as Summary };
  } catch {
    return null;
  }
}
