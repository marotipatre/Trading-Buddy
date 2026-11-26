import type { Candle } from "@/lib/data/types";
import type { EquityPoint } from "@/lib/engine/types";
import { drawdownSeries } from "@/lib/engine/metrics";

export interface EquityRow { time: number; strategy: number; buyHold: number; drawdown: number }

/** Strategy equity next to a buy-and-hold of the same symbol, both starting at `initialCapital`. */
export function equityVsBuyHold(candles: Candle[], equity: EquityPoint[], initialCapital: number): EquityRow[] {
  if (!candles.length || candles.length !== equity.length) return [];
  const base = candles[0].close;
  const dd = drawdownSeries(equity);
  return equity.map((p, i) => ({
    time: p.time,
    strategy: p.equity,
    buyHold: (candles[i].close / base) * initialCapital,
    drawdown: dd[i].dd,
  }));
}

/** Thin a long series to roughly `max` points (keeps first and last) so charts stay fast. */
export function downsample<T>(rows: T[], max = 600): T[] {
  if (rows.length <= max) return rows;
  const step = (rows.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(rows[Math.round(i * step)]);
  return out;
}

export interface MonthlyReturn { year: number; month: number; returnPct: number }

/** Month-by-month return of an equity curve (for a heatmap). */
export function monthlyReturns(equity: EquityPoint[]): MonthlyReturn[] {
  const out: MonthlyReturn[] = [];
  let prevKey = "";
  let startEq = 0;
  let lastEq = 0;
  let y = 0;
  let m = 0;
  for (const p of equity) {
    const d = new Date(p.time * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (key !== prevKey) {
      if (prevKey && startEq > 0) out.push({ year: y, month: m, returnPct: (lastEq / startEq - 1) * 100 });
      prevKey = key;
      y = d.getUTCFullYear();
      m = d.getUTCMonth();
      startEq = lastEq || p.equity;
    }
    lastEq = p.equity;
  }
  if (prevKey && startEq > 0) out.push({ year: y, month: m, returnPct: (lastEq / startEq - 1) * 100 });
  return out;
}
