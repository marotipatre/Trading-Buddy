import type { SupabaseClient } from "@supabase/supabase-js";
import type { EodQuote } from "./nse-mcp";

/** One daily candle row as stored in the `candles` table. Daily bars are stamped 09:15 IST (03:45 UTC), like every other source. */
export interface DailyRow { symbol: string; interval: "1d"; ts: string; open: number; high: number; low: number; close: number; volume: number }

export const barTs = (date: string) => `${date}T03:45:00.000Z`;

/**
 * Pure: turn NSE's official end-of-day quotes into daily bars for the newest trading date among them. Quotes dated earlier
 * (suspended or not-yet-updated stocks) are left alone, and any quote whose numbers do not hang together (missing or zero
 * prices, a high below the low or below the open or close) is dropped, never repaired.
 */
export function eodBars(quotes: EodQuote[]): { date: string; bars: DailyRow[]; dropped: number } | null {
  const dates = quotes.map((q) => q.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const date = dates[dates.length - 1];
  if (!date) return null;
  const bars: DailyRow[] = [];
  let dropped = 0;
  for (const q of quotes) {
    if (q.date !== date) continue;
    const { open, high, low, close } = q;
    const ok = [open, high, low, close].every((x) => Number.isFinite(x) && x > 0) && high >= low && high >= Math.max(open, close) - 1e-9 && low <= Math.min(open, close) + 1e-9;
    if (!ok) { dropped++; continue; }
    bars.push({ symbol: `${q.symbol}.NS`, interval: "1d", ts: barTs(date), open, high, low, close, volume: Number.isFinite(q.volume) ? Math.max(0, q.volume) : 0 });
  }
  return bars.length ? { date, bars, dropped } : null;
}

export interface UpdateResult { date: string; updated: number; dropped: number; missing: number; skipped?: string }
export interface UpdateDeps {
  /** At most 50 symbols per call. */
  quotes: (symbols: string[]) => Promise<EodQuote[]>;
  /** How many stocks already have a daily bar stamped at this date. */
  savedCount: (date: string) => Promise<number>;
}

const PROBE = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "SBIN"];
let inflight: Promise<UpdateResult> | null = null;
let last: { at: number; result: UpdateResult } | null = null;
export const _reset = () => { inflight = null; last = null; };
export const lastUpdate = () => last;

async function pooled<T, R>(items: T[], n: number, work: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []; const q = [...items];
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { for (let x = q.shift(); x !== undefined; x = q.shift()) out.push(await work(x)); }));
  return out;
}

/**
 * Brings the database up to the latest official close for every stock in a handful of requests: about 70 calls of 50
 * symbols each instead of one price-provider request per stock. It first asks about five big stocks which date is
 * newest, and does nothing if the database already holds that date for nearly every stock. Safe to run any time or twice.
 */
export function runDailyUpdate(supabase: SupabaseClient, symbols: string[], deps: UpdateDeps, opts: { force?: boolean } = {}): Promise<UpdateResult> {
  if (inflight) return inflight;
  inflight = (async (): Promise<UpdateResult> => {
    const probe = eodBars(await deps.quotes(PROBE));
    if (!probe) return { date: "", updated: 0, dropped: 0, missing: 0, skipped: "NSE returned no end-of-day figures" };
    if (!opts.force && last && last.result.date === probe.date && !last.result.skipped?.startsWith("could not")) return { date: probe.date, updated: 0, dropped: 0, missing: 0, skipped: "this date is already saved" };
    if (!opts.force) {
      const have = await deps.savedCount(probe.date);
      if (have >= symbols.length * 0.85) return { date: probe.date, updated: 0, dropped: 0, missing: 0, skipped: "this date is already saved" };
    }
    const chunks: string[][] = [];
    for (let i = 0; i < symbols.length; i += 50) chunks.push(symbols.slice(i, i + 50));
    const all: EodQuote[] = [];
    await pooled(chunks, 4, async (c) => { try { all.push(...(await deps.quotes(c))); } catch { /* those stocks keep their older bar */ } });
    const built = eodBars(all);
    if (!built) return { date: probe.date, updated: 0, dropped: 0, missing: symbols.length, skipped: "could not read the full market" };
    let updated = 0;
    for (let i = 0; i < built.bars.length; i += 500) {
      const { error } = await supabase.from("candles").upsert(built.bars.slice(i, i + 500), { onConflict: "symbol,interval,ts" });
      if (error) throw new Error(`Could not save daily bars: ${error.message}`);
      updated += Math.min(500, built.bars.length - i);
    }
    return { date: built.date, updated, dropped: built.dropped, missing: Math.max(0, symbols.length - built.bars.length - built.dropped) };
  })().then((r) => { last = { at: Date.now(), result: r }; return r; }).finally(() => { inflight = null; });
  return inflight;
}

/** Count of stocks with a daily bar at the given date, straight from the database (survives restarts). */
export async function savedCountFromDb(supabase: SupabaseClient, date: string): Promise<number> {
  const { count, error } = await supabase.from("candles").select("symbol", { count: "exact", head: true }).eq("interval", "1d").eq("ts", barTs(date));
  if (error) return 0;
  return count ?? 0;
}
