import { computeMetrics, type Metrics } from "@/lib/engine/metrics";
import { equityFromTrades } from "@/lib/engine/analyze";
import type { Trade } from "@/lib/engine/types";
import { capitalOf } from "./funds";
import type { ClosedTrade, PaperState } from "./types";

/** Adapt a journalled paper trade to the engine's Trade so the same metrics apply. */
export function toEngineTrade(t: ClosedTrade): Trade {
  const risk = NaN; // paper trades don't retain the original stop distance
  return {
    symbol: t.symbol,
    direction: t.direction,
    entryTime: t.entryTime,
    entryIdx: 0,
    entryPrice: t.entryPrice,
    exitTime: t.exitTime,
    exitIdx: 0,
    exitPrice: t.exitPrice,
    qty: t.qty,
    grossPnl: t.grossPnl,
    charges: t.charges,
    netPnl: t.netPnl,
    returnPct: t.returnPct,
    rMultiple: risk,
    barsHeld: Math.max(1, Math.round((t.exitTime - t.entryTime) / 86400)),
    exitReason: t.reason === "stop" ? "stop" : t.reason === "target" ? "target" : "signal",
    maePct: t.maePct ?? 0,
    mfePct: 0,
    product: t.product,
  };
}

export function paperMetrics(state: PaperState): Metrics {
  const trades = state.trades.map(toEngineTrade);
  const capital = capitalOf(state);
  const { equity, finalEquity } = equityFromTrades(trades, capital);
  return computeMetrics({ trades, equity, initialCapital: capital, finalEquity });
}
