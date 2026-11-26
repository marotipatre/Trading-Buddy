"use client";

import { useEffect, useState } from "react";
import { CHART_RANGES, cleanBars, lastSessionOf } from "@/lib/chart-ranges";
import type { Candle } from "@/lib/data/types";
import { isMarketOpen } from "@/lib/market-hours";

/** Per-session cache so switching back to a timeframe you already opened is instant. */
const cache = new Map<string, Candle[]>();

/**
 * Candles for a symbol and timeframe. Shows cached bars immediately (this session, then the server's own
 * stale-while-revalidate cache), then updates quietly. While the market is open it refreshes on a timer.
 */
export function useChartData(symbol: string, rangeId: string) {
  const range = CHART_RANGES.find((r) => r.id === rangeId) ?? CHART_RANGES[3];
  const key = `${symbol}|${range.id}`;
  const [candles, setCandles] = useState<Candle[]>(() => cache.get(key) ?? []);
  const [loading, setLoading] = useState(!cache.has(key));
  const [error, setError] = useState<string | null>(null);
  const [shownKey, setShownKey] = useState(key);

  // Switching symbol or timeframe: show what we have for the new one straight away.
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
        const r = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${range.interval}&days=${range.days}&fast=1`, { signal: ctl.signal });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not load the chart");
        if (!alive) return;
        let bars = cleanBars(j.candles as Candle[]);
        if (range.lastSession) bars = lastSessionOf(bars);
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
    // keep it fresh: faster for intraday charts while the market is open
    const every = isMarketOpen() ? (range.interval === "1d" ? 60_000 : 30_000) : 0;
    const id = every ? setInterval(load, every) : null;
    return () => { alive = false; ctl.abort(); if (id) clearInterval(id); };
  }, [symbol, range.interval, range.days, range.lastSession, key]);

  return { candles, loading, error, range };
}
