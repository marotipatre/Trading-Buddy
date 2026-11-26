"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Quote } from "@/lib/data/types";
import { isMarketOpen } from "@/lib/market-hours";
import { loadLastQuotes, saveLastQuotes } from "@/lib/quote-store";

/**
 * Live quotes for a set of symbols.
 * - Paints instantly from the previous session's prices, then updates (stale-while-revalidate).
 * - Keeps the last known price while refreshing, so rows never blank out.
 * - Polls faster while the market is open and slows right down when it is closed.
 * - `enabled: false` defers loading (used to load the important lists first).
 */
export function useQuotes(symbols: string[], { openMs = 15_000, closedMs = 120_000, enabled = true } = {}) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const key = useMemo(() => [...new Set(symbols)].sort().join(","), [symbols]);
  const alive = useRef(true);

  // Show last session's prices immediately.
  useEffect(() => {
    if (!key) return;
    const last = loadLastQuotes(key.split(","));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read persisted prices after mount
    if (Object.keys(last).length) setQuotes((prev) => ({ ...last, ...prev }));
  }, [key]);

  useEffect(() => {
    alive.current = true;
    if (!key || !enabled) return;
    const tick = async () => {
      try {
        const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(key)}`);
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!alive.current) return;
        const fresh = j.quotes as Quote[];
        saveLastQuotes(fresh);
        setQuotes((prev) => ({ ...prev, ...Object.fromEntries(fresh.map((q) => [q.symbol, q])) }));
        setFailed(false);
      } catch {
        if (alive.current) setFailed(true);
      } finally {
        if (alive.current) setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, isMarketOpen() ? openMs : closedMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [key, openMs, closedMs, enabled, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { quotes, loading: loading && enabled, failed, refresh };
}
