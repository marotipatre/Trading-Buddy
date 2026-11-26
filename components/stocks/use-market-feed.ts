"use client";

import { useEffect, useState } from "react";
import { isMarketOpen } from "@/lib/market-hours";
import type { MarketRow } from "@/lib/multibagger/market";

let memo: { at: number; rows: Map<string, MarketRow> } | null = null;

/** The whole NSE market (price, day and 30-day change, 52-week range, turnover) from one request; refreshed every minute while the market is open. */
export function useMarketFeed() {
  const [rows, setRows] = useState<Map<string, MarketRow> | null>(memo?.rows ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const r = await fetch("/api/market"); const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "failed");
        const m = new Map((j.rows as MarketRow[]).map((x) => [`${x.symbol}.NS`, x]));
        memo = { at: Date.now(), rows: m };
        if (live) { setRows(m); setError(null); }
      } catch (e) { if (live && !memo) setError((e as Error).message); }
    };
    const first = setTimeout(load, memo && Date.now() - memo.at < 60_000 ? 60_000 : 0);
    const id = setInterval(() => { if (isMarketOpen()) void load(); }, 60_000);
    return () => { live = false; clearTimeout(first); clearInterval(id); };
  }, []);
  return { rows, error };
}
