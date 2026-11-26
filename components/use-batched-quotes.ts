"use client";

import { useEffect, useMemo, useState } from "react";
import type { Quote } from "@/lib/data/types";
import { isMarketOpen } from "@/lib/market-hours";
import { loadLastQuotes, saveLastQuotes } from "@/lib/quote-store";

/**
 * Quotes for a longer list, fetched in small sequential batches so rows fill in as they arrive.
 * Starts from the previous session's prices, and re-runs on an interval (slow when the market is closed).
 */
export function useBatchedQuotes(symbols: string[], { batch = 6, openMs = 45_000, closedMs = 300_000, enabled = true } = {}) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [done, setDone] = useState(0);
  const key = useMemo(() => symbols.join(","), [symbols]);

  useEffect(() => {
    if (!key) return;
    const last = loadLastQuotes(key.split(","));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- paint last session's prices immediately
    if (Object.keys(last).length) setQuotes((prev) => ({ ...last, ...prev }));
  }, [key]);

  useEffect(() => {
    if (!key || !enabled) return;
    let alive = true;
    const list = key.split(",");
    const run = async () => {
      setDone(0);
      for (let i = 0; i < list.length && alive; i += batch) {
        const part = list.slice(i, i + batch);
        try {
          const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(part.join(","))}`);
          if (r.ok) {
            const fresh = ((await r.json()).quotes ?? []) as Quote[];
            if (!alive) return;
            saveLastQuotes(fresh);
            setQuotes((prev) => ({ ...prev, ...Object.fromEntries(fresh.map((q) => [q.symbol, q])) }));
          }
        } catch {}
        if (alive) setDone(Math.min(list.length, i + batch));
      }
    };
    run();
    const id = setInterval(run, isMarketOpen() ? openMs : closedMs);
    return () => { alive = false; clearInterval(id); };
  }, [key, batch, openMs, closedMs, enabled]);

  return { quotes, done, total: symbols.length };
}
