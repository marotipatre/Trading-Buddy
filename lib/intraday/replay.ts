import { catchUp, closePosition, istMinutes, istStartOfDay } from "@/lib/paper/broker";
import type { PaperState } from "@/lib/paper/types";

export interface Bar { time: number; open: number; high: number; low: number; close: number }
const SQUARE_OFF = 15 * 60 + 15;
const istDate = (t: number) => Math.floor((t + 19800) / 86400);

/**
 * Settle intraday positions left over from an earlier session, as the market would have: replay that day's 5-minute
 * candles from your entry so a stop or target that was hit still counts, then close whatever remains at the last price
 * before the 3:15 pm square-off. Without candles the position is closed flat at its entry price and the caller is told.
 */
export function settleStale(state: PaperState, barsBySymbol: Record<string, Bar[]>, nowSec: number): { state: PaperState; settled: number; noData: string[] } {
  const today = istStartOfDay(nowSec);
  let st = state;
  const stale = st.positions.filter((p) => p.product === "intraday" && p.entryTime < today);
  const noData: string[] = [];
  for (const p of stale) {
    const day = (barsBySymbol[p.symbol] ?? [])
      .filter((b) => istDate(b.time) === istDate(p.entryTime) && b.time >= p.entryTime - 300 && istMinutes(b.time) < SQUARE_OFF)
      .sort((a, b) => a.time - b.time);
    if (day.length) st = catchUp(st, p.symbol, day);
    const still = st.positions.find((x) => x.id === p.id);
    if (!still) continue; // a stop or target closed it
    const last = day[day.length - 1];
    if (!last) noData.push(p.symbol);
    st = closePosition(st, p.id, still.qty, last ? last.close : still.entryPrice, last ? last.time : still.entryTime, "squareoff", Boolean(last)).state;
  }
  return { state: st, settled: stale.length, noData };
}
