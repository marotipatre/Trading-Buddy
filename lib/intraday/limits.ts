import type { PaperState } from "@/lib/paper/types";

export interface Limits { maxLossPct: number; maxTrades: number; maxLossStreak: number }
export const DEFAULT_LIMITS: Limits = { maxLossPct: 2, maxTrades: 4, maxLossStreak: 3 };

export interface DayStatus {
  pnlToday: number;
  /** Trades closed today plus positions still open that were entered today. */
  tradesToday: number;
  /** Losses in a row, most recent first, among trades closed today. */
  lossStreak: number;
  locked: boolean;
  reason?: string;
}

const istDay = (t: number) => Math.floor((t + 19800) / 86400);

/**
 * Today's discipline check against the rule book's hard limits. When any limit is reached new orders are refused
 * until tomorrow: the point of a limit is that it does not depend on how you feel.
 */
export function dayStatus(state: PaperState, pot: number, nowSec: number, limits: Limits = DEFAULT_LIMITS): DayStatus {
  const today = istDay(nowSec);
  const closed = state.trades.filter((t) => istDay(t.exitTime) === today).sort((a, b) => b.exitTime - a.exitTime);
  const pnlToday = closed.reduce((s, t) => s + t.netPnl, 0);
  const openToday = state.positions.filter((p) => istDay(p.entryTime) === today).length;
  const tradesToday = closed.length + openToday;
  let lossStreak = 0;
  for (const t of closed) { if (t.netPnl < 0) lossStreak++; else break; }

  let reason: string | undefined;
  if (pot > 0 && pnlToday <= -(pot * limits.maxLossPct) / 100) reason = `Daily loss limit reached (${limits.maxLossPct}% of your pot). Stop for today.`;
  else if (lossStreak >= limits.maxLossStreak) reason = `${lossStreak} losses in a row. Stop for today: step away and review.`;
  else if (tradesToday >= limits.maxTrades) reason = `${tradesToday} trades today (limit ${limits.maxTrades}). More trades mostly add costs.`;
  return { pnlToday, tradesToday, lossStreak, locked: !!reason, reason };
}
