import type { Candle } from "@/lib/data/types";
import { isMarketOpen } from "@/lib/market-hours";
import { fresh, readSeries, writeSeries } from "./candle-store";

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
    // A copy saved in this browser (IndexedDB) is used when it is fresh enough: no download at all.
    if (typeof window !== "undefined") {
      const saved = await readSeries(key);
      if (saved && saved.candles.length && fresh(saved.at, Date.now(), isMarketOpen())) { cache.set(key, { at: saved.at, candles: saved.candles }); return saved.candles; }
    }
    const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}&days=${days}&fast=1`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "no data");
    const candles = j.candles as Candle[];
    cache.set(key, { at: Date.now(), candles });
    if (typeof window !== "undefined" && candles.length) void writeSeries(key, candles);
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

/** Candles already in memory for a symbol and window, if any (never starts a download). */
export function peekCandles(symbol: string, days: number, interval = "1d"): Candle[] | undefined {
  return cache.get(`${symbol}|${interval}|${days}`)?.candles;
}

/** Pure: can candles from our database stand in for a fresh download of `days` days? Needs the full window and a recent last bar. */
export function usableFromDb(candles: Candle[], days: number, nowSec: number, latestDate?: string): boolean {
  if (candles.length < 30) return false;
  const first = candles[0].time, last = candles[candles.length - 1].time;
  if (first > nowSec - days * 86400 + 25 * 86400) return false;
  // When we know the newest official session, the saved history must include it; otherwise it must be recent.
  if (latestDate) return new Date((last + 19800) * 1000).toISOString().slice(0, 10) >= latestDate;
  return nowSec - last <= 5 * 86400;
}

let daily: { at: number; date: string } | null = null;
let dailyP: Promise<string> | null = null;
/** Asks the server to save the latest official close for the whole market (cheap and idempotent). Returns the newest session date, or "" if unknown. */
export function ensureDailyFresh(): Promise<string> {
  if (daily && Date.now() - daily.at < 10 * 60_000) return Promise.resolve(daily.date);
  dailyP ??= fetch("/api/daily-update", { method: "POST" }).then(async (r) => { const j = await r.json(); const date = r.ok && typeof j.date === "string" ? j.date : ""; daily = { at: Date.now(), date }; return date; }).catch(() => "").finally(() => { dailyP = null; });
  return dailyP;
}

/**
 * Fills the in-memory and browser stores for many symbols at once from our own database, 20 symbols per request, so a big
 * scan only has to download the stocks we have never saved. Anything missing or too old is left for fetchCandles to handle.
 */
export async function prefetchDaily(symbols: string[], days: number, stop: () => boolean = () => false): Promise<number> {
  const latest = await ensureDailyFresh();
  const need: string[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  for (const s of symbols) {
    const key = `${s}|1d|${days}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) continue;
    const saved = typeof window !== "undefined" ? await readSeries(key) : null;
    if (saved && saved.candles.length && fresh(saved.at, Date.now(), isMarketOpen())) { cache.set(key, { at: saved.at, candles: saved.candles }); continue; }
    need.push(s);
  }
  let filled = 0;
  const batches: string[][] = [];
  for (let i = 0; i < need.length; i += 20) batches.push(need.slice(i, i + 20));
  await pool(batches, 3, async (batch) => {
    try {
      const res = await fetch(`/api/candles/bulk?symbols=${batch.map(encodeURIComponent).join(",")}&days=${days}`);
      if (!res.ok) return;
      const j = (await res.json()) as { candles: Record<string, number[][]> };
      for (const [sym, rows] of Object.entries(j.candles)) {
        const candles: Candle[] = rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
        if (!usableFromDb(candles, days, nowSec, latest || undefined)) continue;
        const key = `${sym}|1d|${days}`;
        cache.set(key, { at: Date.now(), candles });
        void writeSeries(key, candles);
        filled++;
      }
    } catch { /* fall back to single downloads */ }
  }, stop);
  return filled;
}
