import { istStartOfDay } from "./broker";
import type { PaperPosition, PaperState } from "./types";

export interface PositionStats {
  invested: number;
  current: number;
  pnl: number;
  pnlPct: number;
  /** Today's move. For positions opened today this is measured from the entry price, otherwise from yesterday's close. */
  dayPnl: number;
  dayPct: number;
  /** Value the day move is measured against (qty x base price). */
  dayBase: number;
}

const sgn = (p: PaperPosition) => (p.direction === "long" ? 1 : -1);

export function positionStats(p: PaperPosition, ltp: number, prevClose: number | undefined, nowSec: number): PositionStats {
  const s = sgn(p);
  const invested = p.qty * p.entryPrice;
  const pnl = s * (ltp - p.entryPrice) * p.qty;
  const openedToday = p.entryTime >= istStartOfDay(nowSec);
  const base = openedToday || !prevClose ? p.entryPrice : prevClose;
  const dayPnl = s * (ltp - base) * p.qty;
  return {
    invested,
    current: invested + pnl,
    pnl,
    pnlPct: invested ? (pnl / invested) * 100 : 0,
    dayPnl,
    dayPct: base * p.qty ? (dayPnl / (base * p.qty)) * 100 : 0,
    dayBase: base * p.qty,
  };
}

export interface PortfolioSummary {
  invested: number;
  current: number;
  pnl: number;
  pnlPct: number;
  dayPnl: number;
  dayPct: number;
}

/** Totals over open positions of one product (or all), valued at the given prices. */
export function summarizePositions(
  state: Pick<PaperState, "positions">,
  prices: Record<string, { price: number; prevClose?: number }>,
  nowSec: number,
  product?: "delivery" | "intraday",
): PortfolioSummary {
  let invested = 0, current = 0, pnl = 0, dayPnl = 0, dayBase = 0;
  for (const p of state.positions) {
    if (product && p.product !== product) continue;
    const q = prices[p.symbol];
    const st = positionStats(p, q?.price ?? p.entryPrice, q?.prevClose, nowSec);
    invested += st.invested;
    current += st.current;
    pnl += st.pnl;
    dayPnl += st.dayPnl;
    dayBase += st.dayBase;
  }
  return {
    invested, current, pnl,
    pnlPct: invested ? (pnl / invested) * 100 : 0,
    dayPnl,
    dayPct: dayBase ? (dayPnl / dayBase) * 100 : 0,
  };
}
