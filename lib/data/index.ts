import type { SupabaseClient } from "@supabase/supabase-js";
import { isMarketOpen } from "@/lib/market-hours";
import { cacheAction, refreshTtlSec } from "./cache-policy";
import { dedupe } from "./spacer";
import { fetchCandles } from "./yahoo";
import type { Candle, Interval } from "./types";

export interface GetCandlesOptions {
  /**
   * Schedules work after the response is sent (Next's `after`). When provided, stale or partial
   * cached data is returned immediately and refreshed in the background.
   */
  background?: (work: Promise<unknown>) => void;
  /** Accept a cache that does not reach the full requested start (fine for charts, not for backtests). */
  allowPartial?: boolean;
}

/** When this server process last refreshed each series from the provider. */
const lastRefresh = new Map<string, number>();
const inflight = dedupe<Candle[]>();

type Row = { ts: string; open: number; high: number; low: number; close: number; volume: number };
const toCandle = (r: Row): Candle => ({
  time: Math.floor(new Date(r.ts).getTime() / 1000),
  open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume,
});

async function readCache(supabase: SupabaseClient, symbol: string, interval: Interval, fromSec: number, toSec: number): Promise<Candle[]> {
  const rows: Row[] = [];
  // PostgREST caps responses (default 1000 rows); page through.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("candles")
      .select("ts,open,high,low,close,volume")
      .eq("symbol", symbol)
      .eq("interval", interval)
      .gte("ts", new Date(fromSec * 1000).toISOString())
      .lte("ts", new Date(toSec * 1000).toISOString())
      .order("ts", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
  }
  return rows.map(toCandle);
}

async function refresh(supabase: SupabaseClient, symbol: string, interval: Interval, fromSec: number, toSec: number): Promise<Candle[]> {
  const key = `${symbol}|${interval}`;
  return inflight(`${key}|${fromSec - (fromSec % 3600)}`, async () => {
    try {
      const fresh = await fetchCandles(symbol, interval, fromSec, toSec);
      if (fresh.length) {
        const rows = fresh.map((c) => ({
          symbol, interval, ts: new Date(c.time * 1000).toISOString(),
          open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
        }));
        for (let i = 0; i < rows.length; i += 500) {
          await supabase.from("candles").upsert(rows.slice(i, i + 500), { onConflict: "symbol,interval,ts" });
        }
      }
      lastRefresh.set(key, Math.floor(Date.now() / 1000));
      return fresh;
    } catch (e) {
      // Back off for ~30s instead of hammering a throttled provider on every request.
      const ttl = refreshTtlSec(interval, isMarketOpen());
      lastRefresh.set(key, Math.floor(Date.now() / 1000) - ttl + 30);
      throw e;
    }
  });
}

/**
 * Candles with a Supabase cache and stale-while-revalidate behaviour: cached data is returned
 * immediately and refreshed after the response whenever possible, so charts open instantly.
 */
export async function getCandles(
  supabase: SupabaseClient,
  symbol: string,
  interval: Interval,
  fromSec: number,
  toSec: number,
  opts: GetCandlesOptions = {},
): Promise<Candle[]> {
  let cached: Candle[] = [];
  try {
    cached = await readCache(supabase, symbol, interval, fromSec, toSec);
  } catch {
    // cache table missing/unreachable: fall through to a live fetch
  }

  let action = cacheAction({
    interval,
    count: cached.length,
    cachedFirst: cached[0]?.time ?? 0,
    cachedLast: cached.at(-1)?.time ?? 0,
    fromSec,
    toSec,
    nowSec: Math.floor(Date.now() / 1000),
    marketOpen: isMarketOpen(),
    lastRefreshAt: lastRefresh.get(`${symbol}|${interval}`),
  });
  if (action === "fetch" && opts.allowPartial && opts.background && cached.length > 0) action = "serve+refresh";

  if (action === "serve") return cached;

  if (action === "serve+refresh" && opts.background) {
    opts.background(refresh(supabase, symbol, interval, fromSec, toSec).catch(() => undefined));
    return cached;
  }

  try {
    const fresh = await refresh(supabase, symbol, interval, fromSec, toSec);
    return fresh.length ? fresh : cached;
  } catch (e) {
    // Throttled or down: serve whatever is cached rather than failing the page.
    if (cached.length > 0) return cached;
    throw e;
  }
}
