import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCandles } from "./yahoo";
import type { Candle, Interval } from "./types";

const STALE_SEC: Record<Interval, number> = {
  "1d": 6 * 3600,
  "15m": 15 * 60,
  "5m": 5 * 60,
  "1m": 60,
};

/**
 * Candles with a Supabase cache. Refreshes from Yahoo when the cache is empty,
 * doesn't reach back to `fromSec`, or is stale; then upserts and returns rows.
 */
export async function getCandles(
  supabase: SupabaseClient,
  symbol: string,
  interval: Interval,
  fromSec: number,
  toSec: number,
): Promise<Candle[]> {
  const fromIso = new Date(fromSec * 1000).toISOString();
  const toIso = new Date(toSec * 1000).toISOString();

  const readCache = async () => {
    const rows: { ts: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
    // PostgREST caps responses (default 1000 rows); page through.
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("candles")
        .select("ts,open,high,low,close,volume")
        .eq("symbol", symbol)
        .eq("interval", interval)
        .gte("ts", fromIso)
        .lte("ts", toIso)
        .order("ts", { ascending: true })
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return rows.map<Candle>((r) => ({
      time: Math.floor(new Date(r.ts).getTime() / 1000),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));
  };

  let cached: Candle[] = [];
  try {
    cached = await readCache();
  } catch {
    // cache table missing/unreachable: fall through to live fetch
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const last = cached.at(-1)?.time ?? 0;
  const first = cached[0]?.time ?? Infinity;
  const isFresh = cached.length > 0 && nowSec - last < STALE_SEC[interval] * 4 && toSec - last < 5 * 86400;
  // Daily bars: allow a ~5 day gap at the start (weekends/holidays) before refetching.
  const coversStart = first - fromSec < 6 * 86400;
  const needsRefresh = !(isFresh && coversStart) && !(toSec < last);

  if (!needsRefresh) return cached;

  const fresh = await fetchCandles(symbol, interval, fromSec, toSec);
  if (fresh.length) {
    const rows = fresh.map((c) => ({
      symbol,
      interval,
      ts: new Date(c.time * 1000).toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from("candles").upsert(rows.slice(i, i + 500), { onConflict: "symbol,interval,ts" });
    }
  }
  return fresh;
}
