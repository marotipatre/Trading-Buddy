"use client";

import { useEffect, useState } from "react";
import { cleanBars } from "@/lib/chart-ranges";
import { getTimeframe, toTimeframe } from "@/lib/chart-timeframes";
import type { Candle } from "@/lib/data/types";
import { isMarketOpen } from "@/lib/market-hours";

/** Per-session cache so switching back to a candle size you already opened is instant. */
const cache = new Map<string, Candle[]>();

/**
 * Candles for a symbol at a chosen candle size (5m, 15m, 4H, 1D, 1W). 4H and 1W are built from 15-minute and daily
 * candles. Shows cached bars immediately, then updates quietly; while the market is open it refreshes on a timer.
 */
export function useChartData(symbol: string, timeframeId: string) {
  const tf = getTimeframe(timeframeId);
  const key = `${symbol}|${tf.id}`;
  const [candles, setCandles] = useState<Candle[]>(() => cache.get(key) ?? []);
  const [loading, setLoading] = useState(!cache.has(key));
  const [error, setError] = useState<string | null>(null);
  const [shownKey, setShownKey] = useState(key);

  if (shownKey !== key) {
    setShownKey(key);
    setCandles(cache.get(key) ?? []);
    setLoading(!cache.has(key));
    setError(null);
  }

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const load = async () => {
      try {
        const r = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${tf.source}&days=${tf.days}&fast=1`, { signal: ctl.signal });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not load the chart");
        if (!alive) return;
        const bars = toTimeframe(cleanBars(j.candles as Candle[]), tf);
        cache.set(key, bars);
        setCandles(bars);
        setError(null);
      } catch (e) {
        if ((e as Error).name === "AbortError" || !alive) return;
        if (!cache.has(key)) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const every = isMarketOpen() ? (tf.source === "1d" ? 60_000 : 30_000) : 0;
    const id = every ? setInterval(load, every) : null;
    return () => { alive = false; ctl.abort(); if (id) clearInterval(id); };
  }, [symbol, tf, key]);

  return { candles, loading, error, timeframe: tf };
}
