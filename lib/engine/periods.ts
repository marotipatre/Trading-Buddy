import type { EquityPoint, Trade } from "./types";

export interface PeriodRow { key: string; label: string; returnPct: number; trades: number; wins: number; pnl: number }
export interface PeriodSummary {
  rows: PeriodRow[];
  periods: number;
  profitable: number;
  /** Share of periods that ended in profit, 0-1. */
  profitableShare: number;
  avgReturnPct: number;
  medianReturnPct: number;
  best: PeriodRow | null;
  worst: PeriodRow | null;
  avgTrades: number;
  /** Periods that reached the target return (for example 10% a month). */
  hitTarget: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400;
const IST = 19800;

/** Period key and label for a timestamp. Weeks start on Monday (IST). */
export function periodOf(time: number, by: "week" | "month"): { key: string; label: string } {
  const d = new Date(time * 1000);
  if (by === "month") return { key: `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  const day = Math.floor((time + IST) / DAY);
  const monday = day - ((day + 3) % 7);
  const md = new Date(monday * DAY * 1000);
  return { key: String(monday), label: `${md.getUTCDate()} ${MONTHS[md.getUTCMonth()]} ${md.getUTCFullYear()}` };
}

/**
 * Return per calendar week or month from the equity curve, and how many trades closed in each.
 * A period's return is measured from the equity at the end of the previous period (or the starting capital).
 */
export function periodStats(equity: EquityPoint[], trades: Trade[], by: "week" | "month", initialCapital: number, targetPct = 10): PeriodSummary {
  const rows = new Map<string, PeriodRow>();
  let prev = initialCapital;
  let curKey = "";
  let last = initialCapital;
  const close = () => {
    const r = rows.get(curKey);
    if (r) { r.returnPct = prev > 0 ? (last / prev - 1) * 100 : 0; prev = last; }
  };
  for (const p of equity) {
    const k = periodOf(p.time, by);
    if (k.key !== curKey) {
      if (curKey) close();
      curKey = k.key;
      rows.set(k.key, { key: k.key, label: k.label, returnPct: 0, trades: 0, wins: 0, pnl: 0 });
    }
    last = p.equity;
  }
  if (curKey) close();
  for (const t of trades) {
    const r = rows.get(periodOf(t.exitTime, by).key);
    if (r) { r.trades++; r.pnl += t.netPnl; if (t.netPnl > 0) r.wins++; }
  }
  const list = [...rows.values()];
  const rets = list.map((r) => r.returnPct).sort((a, b) => a - b);
  const median = rets.length ? (rets.length % 2 ? rets[(rets.length - 1) / 2] : (rets[rets.length / 2 - 1] + rets[rets.length / 2]) / 2) : 0;
  const profitable = list.filter((r) => r.returnPct > 0).length;
  return {
    rows: list, periods: list.length, profitable,
    profitableShare: list.length ? profitable / list.length : 0,
    avgReturnPct: list.length ? list.reduce((s, r) => s + r.returnPct, 0) / list.length : 0,
    medianReturnPct: median,
    best: list.length ? list.reduce((a, b) => (b.returnPct > a.returnPct ? b : a)) : null,
    worst: list.length ? list.reduce((a, b) => (b.returnPct < a.returnPct ? b : a)) : null,
    avgTrades: list.length ? list.reduce((s, r) => s + r.trades, 0) / list.length : 0,
    hitTarget: list.filter((r) => r.returnPct >= targetPct).length,
  };
}
