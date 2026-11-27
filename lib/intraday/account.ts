import { blockedFunds, equity as equityOf, newAccount } from "@/lib/paper/broker";
import { addMoney, capitalOf } from "@/lib/paper/funds";
import type { PaperState } from "@/lib/paper/types";

export const LEVERAGE = 5;
const KEY = "tb.intraday.v1";

/**
 * A second, separate paper account for margin day trading. Your own money is the pot; the broker lets you trade
 * `leverage` times it. The simulator's cash is that buying power, so orders larger than it are refused, and every
 * profit or loss is tracked here and never touches your main paper account.
 */
export interface IntradayAccount {
  v: 1;
  leverage: number;
  /** Your own money in the pot (before profits and losses). */
  pot: number;
  state: PaperState;
  /** Milliseconds when this copy was last saved; the newer of the browser and Supabase copies wins. */
  savedAt?: number;
}

export function newIntradayAccount(pot: number, leverage = LEVERAGE): IntradayAccount {
  return { v: 1, leverage, pot, state: newAccount(pot * leverage) };
}

export function addToPot(acc: IntradayAccount, amount: number, time: number): { acc: IntradayAccount; error?: string } {
  if (!(amount > 0)) return { acc, error: "Enter an amount greater than zero" };
  const r = addMoney(acc.state, "trading", amount * acc.leverage, time);
  if (r.error) return { acc, error: r.error };
  return { acc: { ...acc, pot: acc.pot + amount, state: r.state } };
}

export interface PotView {
  /** Your own money now: the pot plus profit or loss so far. */
  value: number;
  pnl: number;
  pnlPct: number;
  buyingPower: number;
  marginUsed: number;
  /** Buying power held back by resting orders (their full order value). */
  blocked: number;
  /** True when losses have used up the pot. */
  broke: boolean;
}

export function potView(acc: IntradayAccount, prices: Record<string, number>): PotView {
  const eq = equityOf(acc.state, prices);
  const pnl = eq - capitalOf(acc.state);
  const used = acc.state.positions.reduce((s, p) => s + (p.qty * (prices[p.symbol] ?? p.entryPrice)) / acc.leverage, 0);
  const value = acc.pot + pnl;
  const blocked = blockedFunds(acc.state);
  return { value, pnl, pnlPct: acc.pot > 0 ? (pnl / acc.pot) * 100 : 0, buyingPower: Math.max(0, acc.state.cash - blocked), blocked, marginUsed: used, broke: value <= 0 };
}

/** Realised profit by day (IST), for the daily results table. */
export function pnlByDay(state: PaperState): { date: string; pnl: number; trades: number; wins: number }[] {
  const map = new Map<string, { date: string; pnl: number; trades: number; wins: number }>();
  for (const t of state.trades) {
    const date = new Date((t.exitTime + 19800) * 1000).toISOString().slice(0, 10);
    const row = map.get(date) ?? { date, pnl: 0, trades: 0, wins: 0 };
    row.pnl += t.netPnl; row.trades++; if (t.netPnl > 0) row.wins++;
    map.set(date, row);
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function loadIntraday(): IntradayAccount | null {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? "null") as IntradayAccount | null;
    return a?.v === 1 && a.state?.version === 1 && a.pot > 0 ? a : null;
  } catch { return null; }
}
export function saveIntraday(a: IntradayAccount) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage unavailable */ } }
