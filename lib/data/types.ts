export type Interval = "1d" | "15m" | "5m" | "1m";

export interface Candle {
  /** Unix seconds (UTC) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  marketState: string;
  time: number;
}

export interface SymbolHit {
  symbol: string;
  name: string;
  exchange: string;
}
