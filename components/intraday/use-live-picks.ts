"use client";

import { useEffect, useState } from "react";
import type { Candle } from "@/lib/data/types";
import { liveStatus, type LiveStatus } from "@/lib/intraday/live";
import type { IntradayPick } from "@/lib/intraday/picks";
import { isMarketOpen } from "@/lib/market-hours";

const istToday = () => new Date(Date.now() + 19800_000).toISOString().slice(0, 10);

/**
 * Live go / wait / skip calls for today's picks, from fresh 5-minute candles (not the saved copies), refreshed every minute
 * while the market is open. Returns nothing for picks whose session is not today.
 */
export function useLivePicks(picks: Pick<IntradayPick, "symbol" | "plan" | "forDate">[] | undefined, forDate: string | undefined) {
  const [status, setStatus] = useState<Record<string, LiveStatus | null>>({});
  const [at, setAt] = useState<number | null>(null);
  const key = picks?.map((p) => p.symbol).join(",") ?? "";
  useEffect(() => {
    if (!picks?.length || !forDate) return;
    let alive = true;
    const run = async () => {
      if (!isMarketOpen() || forDate !== istToday()) return;
      const next: Record<string, LiveStatus | null> = {};
      await Promise.all(picks.map(async (p) => {
        try {
          const r = await fetch(`/api/candles?symbol=${encodeURIComponent(p.symbol)}&interval=5m&days=2`);
          const j = await r.json();
          next[p.symbol] = r.ok ? liveStatus(p, j.candles as Candle[]) : null;
        } catch { next[p.symbol] = null; }
      }));
      if (alive) { setStatus(next); setAt(Date.now()); }
    };
    const first = setTimeout(run, 0);
    const id = setInterval(run, 60_000);
    return () => { alive = false; clearTimeout(first); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the set of picks or the session changes
  }, [key, forDate]);
  return { status, at };
}
