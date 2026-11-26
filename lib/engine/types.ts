import type { Product } from "./costs";

export type ExitReason = "stop" | "target" | "signal" | "time" | "end";

export interface Trade {
  symbol: string;
  direction: "long" | "short";
  entryTime: number;
  entryIdx: number;
  entryPrice: number;
  exitTime: number;
  exitIdx: number;
  exitPrice: number;
  qty: number;
  grossPnl: number;
  charges: number;
  netPnl: number;
  /** Net return on capital deployed, in percent. */
  returnPct: number;
  /** Net P&L divided by initial risk (needs a stop-loss), else NaN. */
  rMultiple: number;
  barsHeld: number;
  exitReason: ExitReason;
  /** Max adverse excursion as % of entry price (>= 0). */
  maePct: number;
  /** Max favourable excursion as % of entry price (>= 0). */
  mfePct: number;
  product: Product;
}

export interface EquityPoint { time: number; equity: number }
