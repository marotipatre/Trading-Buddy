"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Quote } from "@/lib/data/types";
import { isMarketOpen } from "@/lib/market-hours";

/**
 * Live quotes for a set of symbols. Keeps the last known prices while refreshing (so rows never
 * blank out), polls faster while the market is open, and slows right down when it is closed.
 */
export function useQuotes(symbols: string[], { openMs = 15_000, closedMs = 120_000 } = {}) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const key = useMemo(() => [...new Set(symbols)].sort().join(","), [symbols]);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to load
      setLoading(false);
      return;
    }
    const tick = async () => {
      try {
        const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(key)}`);
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!alive.current) return;
        setQuotes((prev) => ({ ...prev, ...Object.fromEntries((j.quotes as Quote[]).map((q) => [q.symbol, q])) }));
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
  }, [key, openMs, closedMs, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { quotes, loading, failed, refresh };
}
