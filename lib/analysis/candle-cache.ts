import type { Candle } from "@/lib/data/types";

const TTL = 30 * 60_000;
const cache = new Map<string, { at: number; candles: Candle[] }>();
const inflight = new Map<string, Promise<Candle[]>>();

/**
 * Daily candles through the app's own API, remembered for 30 minutes in this tab. A second scan (or a different
 * target or number of days) reuses what is already loaded, so it finishes in a moment instead of re-downloading.
 */
export function fetchCandles(symbol: string, days: number, interval = "1d"): Promise<Candle[]> {
  const key = `${symbol}|${interval}|${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.candles);
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}&days=${days}&fast=1`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "no data");
    const candles = j.candles as Candle[];
    cache.set(key, { at: Date.now(), candles });
    return candles;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Run `worker` over `items` with at most `n` in flight; stops early when `stop()` is true. */
export async function pool<T>(items: T[], n: number, worker: (item: T) => Promise<void>, stop: () => boolean = () => false): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    for (let it = queue.shift(); it !== undefined && !stop(); it = queue.shift()) await worker(it);
  }));
}
