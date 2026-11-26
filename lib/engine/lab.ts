import type { Candle } from "@/lib/data/types";
import { DEFAULT_COSTS, DELIVERY_ZERO_BROKERAGE, type CostConfig } from "./costs";
import { scanSymbol, summarizeScan, type ScanSummary } from "./scan";
import type { StrategyDef } from "./strategy";

export interface LabEntry { id: string; label: string; strategy: StrategyDef }
export interface LabData { symbol: string; name?: string; sector?: string; cap?: string; candles: Candle[] }
export interface LabRow {
  id: string;
  label: string;
  summary: ScanSummary;
  /** Plain-language reading of the row. */
  verdict: "promising" | "mixed" | "weak" | "too few trades";
  why: string;
}

/**
 * Run every strategy over the same stocks and rank them, so strategies are compared on equal terms. The ranking uses the
 * LATER 30% of each stock's history (data the strategy was not shaped on) and needs enough trades to mean something.
 */
export function compareStrategies(entries: LabEntry[], data: LabData[], costs: CostConfig = { ...DEFAULT_COSTS, ...DELIVERY_ZERO_BROKERAGE }): LabRow[] {
  const rows = entries.map((e) => {
    const scans = data.map((d) => scanSymbol({ symbol: d.symbol, name: d.name, sector: d.sector, cap: d.cap }, d.candles, e.strategy, costs));
    const summary = summarizeScan(scans);
    const { verdict, why } = judge(summary);
    return { id: e.id, label: e.label, summary, verdict, why } satisfies LabRow;
  });
  const key = (r: LabRow) => (r.summary.outSample.trades >= 20 ? r.summary.outSample.expectancyPct : -1e9 + r.summary.pooled.expectancyPct);
  return rows.sort((a, b) => key(b) - key(a));
}

export function judge(s: ScanSummary): { verdict: LabRow["verdict"]; why: string } {
  const p = s.pooled, o = s.outSample;
  if (p.trades < 60 || o.trades < 20) return { verdict: "too few trades", why: `Only ${p.trades} trades (${o.trades} in the later period): not enough to judge.` };
  if (p.expectancyPct > 0 && o.expectancyPct > 0 && p.profitFactor >= 1.2 && s.profitableShare >= 0.55) return { verdict: "promising", why: `Positive in both early and later history, profit factor ${p.profitFactor.toFixed(2)}, profitable on ${(s.profitableShare * 100).toFixed(0)}% of stocks. Still check it against simply holding.` };
  if (p.expectancyPct <= 0 || o.expectancyPct <= 0) return { verdict: "weak", why: o.expectancyPct <= 0 ? "Lost money in the later period, the part it was not shaped on." : "The average trade does not earn after costs." };
  return { verdict: "mixed", why: "Some edge in places but not consistent across time or stocks." };
}
