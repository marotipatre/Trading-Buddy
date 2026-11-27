import type { SupabaseClient } from "@supabase/supabase-js";
import { marketRegime, type MarketRegime } from "@/lib/analysis/regime";
import { readCache } from "@/lib/data";
import { getBulkQuotes } from "@/lib/data/nse-mcp";
import { loadMarketFeed } from "@/lib/data/market-feed";
import { runDailyUpdate, savedCountFromDb } from "@/lib/data/daily-update";
import { scoreIntraday, scoreIntradayShort, topPicks, type IntradayPick } from "@/lib/intraday/picks";
import { getUniverse } from "@/lib/universe-data";

export interface PicksResult { forDate: string; createdAt: number; picks: IntradayPick[]; regime: MarketRegime | null; scanned: number; candidates: number }
const cache = new Map<string, { at: number; result: PicksResult }>();
const inflight = new Map<string, Promise<PicksResult>>();
const TTL = 3 * 3600_000; // the picks use only completed days, so they cannot change until the next close is saved

/**
 * Finds the day-trade picks for one session on the server, from the saved daily history in our database, so the page opens with
 * them already there instead of scanning in the browser. Only stocks that traded at least about Rs 8 crore in the last session are
 * considered (the pick rules need far more than that anyway), and the picks for a session use only candles from before it.
 */
export function computePicks(supabase: SupabaseClient, forDate: string, refresh = false): Promise<PicksResult> {
  const hit = cache.get(forDate);
  if (!refresh && hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.result);
  const running = inflight.get(forDate);
  if (running) return running;
  const p = (async () => {
    const universe = await getUniverse();
    // Make sure the latest official close is saved first (a no-op when it already is).
    try { await runDailyUpdate(supabase, universe.stocks.map((s) => s.symbol.replace(/\.NS$/, "")), { quotes: (s) => getBulkQuotes(s), savedCount: (d) => savedCountFromDb(supabase, d) }); } catch { /* use what is saved */ }
    const info = new Map(universe.stocks.map((s) => [s.symbol, s]));
    let symbols: string[];
    try {
      const feed = await loadMarketFeed();
      symbols = feed.rows.filter((r) => r.segment === "main" && r.valueCr >= 8).sort((a, b) => b.valueCr - a.valueCr).map((r) => `${r.symbol}.NS`).filter((s) => info.has(s));
    } catch { symbols = universe.stocks.filter((s) => s.cap === "large" || s.cap === "mid" || s.cap === "small").map((s) => s.symbol); }
    const to = Math.floor(Date.now() / 1000), from = to - 270 * 86400;
    const found: IntradayPick[] = [];
    let scanned = 0;
    const queue = [...symbols];
    await Promise.all(Array.from({ length: 24 }, async () => {
      for (let s = queue.shift(); s !== undefined; s = queue.shift()) {
        try {
          const candles = await readCache(supabase, s, "1d", from, to);
          if (candles.length < 70) continue; // needs about 3 months of history
          scanned++;
          const meta = info.get(s)!;
          const long = scoreIntraday(s, meta.name, meta.sector, candles, 0, undefined, forDate);
          if (long) found.push(long);
          const short = scoreIntradayShort(s, meta.name, meta.sector, candles, 0, forDate);
          if (short) found.push(short);
        } catch { /* skip this one */ }
      }
    }));
    let regime: MarketRegime | null = null;
    try { regime = marketRegime(await readCache(supabase, "^NSEI", "1d", to - 600 * 86400, to)); } catch { /* optional */ }
    const result: PicksResult = { forDate, createdAt: Date.now(), picks: topPicks(found, 6, 2, 3), regime, scanned, candidates: symbols.length };
    cache.set(forDate, { at: Date.now(), result });
    return result;
  })().finally(() => inflight.delete(forDate));
  inflight.set(forDate, p);
  return p;
}
