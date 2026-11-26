import type { CostConfig, Product } from "@/lib/engine/costs";

export type Direction = "long" | "short";
export type CloseReason = "manual" | "stop" | "target" | "squareoff";

export interface PaperPosition {
  id: number;
  symbol: string;
  direction: Direction;
  product: Product;
  qty: number;
  entryPrice: number;
  entryTime: number;
  /** Entry-leg charges for the whole position (allocated pro-rata on partial closes). */
  entryCharges: number;
  stop?: number;
  target?: number;
  /** Trailing distance in price terms; the stop follows the best price by this much. */
  trailDist?: number;
  /** Best price seen in the trade's favour (for trailing). */
  best: number;
  /** Unix seconds of the last bar/tick evaluated, so catch-up never replays old bars. */
  lastCheckedAt: number;
  note?: string;
}

export interface PendingOrder {
  id: number;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  limitPrice: number;
  product: Product;
  stop?: number;
  target?: number;
  trailing?: boolean;
  createdAt: number;
  note?: string;
}

export interface ClosedTrade {
  id: number;
  symbol: string;
  direction: Direction;
  product: Product;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  grossPnl: number;
  charges: number;
  netPnl: number;
  returnPct: number;
  reason: CloseReason;
  maePct?: number;
  note?: string;
}

export interface PaperState {
  version: 1;
  initialCapital: number;
  cash: number;
  nextId: number;
  positions: PaperPosition[];
  orders: PendingOrder[];
  trades: ClosedTrade[];
  costs: CostConfig;
}

export interface OrderRequest {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  type: "market" | "limit";
  limitPrice?: number;
  product: Product;
  /** Absolute protective stop price (set on the entry). */
  stop?: number;
  /** Absolute target price. */
  target?: number;
  trailing?: boolean;
  note?: string;
}

export interface Bar { time: number; open: number; high: number; low: number; close: number }
