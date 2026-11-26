import { evaluateAlerts, type PriceAlert } from "@/lib/alerts";
import { catchUp, expireOrders, intradayDue, onPrice, squareOffIntraday } from "@/lib/paper/broker";
import { normalizeState } from "@/lib/paper/funds";
import type { Bar, PaperState } from "@/lib/paper/types";
import type { Quote } from "@/lib/data/types";

/** How long an account must be untouched before the watcher acts on it: the open app saves a heartbeat every minute. */
export const APP_OPEN_GRACE_SEC = 150;

export interface AccountRow { id: string; state: PaperState; updatedAt: string }
export interface AlertRow { id: string; symbol: string; direction: "above" | "below"; price: number }

/** Everything the watcher needs from the database, so the logic can be tested without one. */
export interface WatchStore {
  listAccounts(): Promise<AccountRow[]>;
  /** Saves only if the row has not changed since `expectedUpdatedAt`. Returns false on conflict. */
  saveAccount(id: string, state: PaperState, expectedUpdatedAt: string): Promise<boolean>;
  listActiveAlerts(): Promise<AlertRow[]>;
  markAlertTriggered(id: string, price: number, atSec: number): Promise<void>;
}

export interface WatchData {
  quotes(symbols: string[]): Promise<Quote[]>;
  bars(symbol: string, fromSec: number, toSec: number): Promise<Bar[]>;
}

export interface WatchSummary {
  accounts: number;
  skippedOpenApp: number;
  changedAccounts: number;
  newEvents: number;
  conflicts: number;
  alertsTriggered: number;
  errors: string[];
}

/** NSE trading window with a margin: Mon-Fri 09:00-16:30 IST. The watcher does nothing outside it unless forced. */
export function inWatchWindow(sec: number): boolean {
  const ist = sec + 19800;
  const dow = (Math.floor(ist / 86400) + 4) % 7;
  const min = Math.floor((((ist % 86400) + 86400) % 86400) / 60);
  return dow >= 1 && dow <= 5 && min >= 9 * 60 && min <= 16 * 60 + 30;
}

/**
 * What counts as a change worth saving: fills, order changes, a moved or removed stop/target, cash.
 * Internal bookkeeping (last-checked time, best/worst price) is recomputed from candles each run, and saving it
 * would refresh `updated_at`, making the watcher mistake its own write for an open app.
 */
export function meaningful(s: PaperState): string {
  return JSON.stringify([
    s.positions.map((p) => [p.id, p.qty, p.entryPrice, p.stop, p.target, p.trailDist]),
    s.orders.map((o) => [o.id, o.qty, o.limitPrice]),
    s.trades.length, s.cash, s.events?.length ?? 0,
  ]);
}

const symbolsOf = (s: PaperState) => [...new Set([...s.positions.map((p) => p.symbol), ...s.orders.map((o) => o.symbol)])];

/** Apply everything that happened to one account's orders and positions since it was last looked at. */
export async function processAccount(state: PaperState, data: WatchData, nowSec: number): Promise<PaperState> {
  let st = normalizeState(state);
  const symbols = symbolsOf(st);
  if (!symbols.length) return expireOrders(st, nowSec);
  const quotes = await data.quotes(symbols);
  const price = Object.fromEntries(quotes.map((q) => [q.symbol, q.price]));
  for (const sym of symbols) {
    const since = Math.min(
      ...st.positions.filter((p) => p.symbol === sym).map((p) => p.lastCheckedAt),
      ...st.orders.filter((o) => o.symbol === sym).map((o) => o.createdAt),
    );
    // 1. replay every bar that formed while nobody was watching
    try {
      const bars = await data.bars(sym, since, nowSec);
      st = catchUp(st, sym, bars);
    } catch {
      // no candles: fall through to the live price below
    }
    // 2. then the latest price, for the bar that is still forming
    const q = quotes.find((x) => x.symbol === sym);
    if (q) st = onPrice(st, sym, q.price, Math.max(q.time || 0, nowSec));
  }
  st = expireOrders(st, nowSec);
  if (intradayDue(st, nowSec)) st = squareOffIntraday(st, price, nowSec);
  return st;
}

export async function runWatcher(store: WatchStore, data: WatchData, nowSec: number): Promise<WatchSummary> {
  const sum: WatchSummary = { accounts: 0, skippedOpenApp: 0, changedAccounts: 0, newEvents: 0, conflicts: 0, alertsTriggered: 0, errors: [] };

  for (const row of await store.listAccounts()) {
    sum.accounts++;
    // The open app looks after its own account (and saves a heartbeat); leave it alone to avoid two writers.
    if (nowSec - Date.parse(row.updatedAt) / 1000 < APP_OPEN_GRACE_SEC) { sum.skippedOpenApp++; continue; }
    try {
      const before = normalizeState(row.state);
      const after = await processAccount(before, data, nowSec);
      const changed = meaningful(after) !== meaningful(before);
      if (!changed) continue;
      if (await store.saveAccount(row.id, after, row.updatedAt)) {
        sum.changedAccounts++;
        sum.newEvents += (after.events?.length ?? 0) - (before.events?.length ?? 0);
      } else sum.conflicts++;
    } catch (e) {
      sum.errors.push(`account ${row.id.slice(0, 8)}: ${(e as Error).message}`);
    }
  }

  try {
    const alerts = await store.listActiveAlerts();
    if (alerts.length) {
      const quotes = await data.quotes([...new Set(alerts.map((a) => a.symbol))]);
      const prices = Object.fromEntries(quotes.map((q) => [q.symbol, q.price]));
      const asAlerts: PriceAlert[] = alerts.map((a) => ({ ...a, status: "active", createdAt: 0 }));
      for (const { alert, price } of evaluateAlerts(asAlerts, prices)) {
        await store.markAlertTriggered(alert.id, price, nowSec);
        sum.alertsTriggered++;
      }
    }
  } catch (e) {
    sum.errors.push(`alerts: ${(e as Error).message}`);
  }
  return sum;
}
