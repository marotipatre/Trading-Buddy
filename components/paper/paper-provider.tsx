"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Candle, Quote } from "@/lib/data/types";
import { catchUp, closePosition, intradayDue, newAccount, onPrice, placeOrder, squareOffIntraday, cancelOrder, equity as equityOf } from "@/lib/paper/broker";
import { loadAccount, saveAccount, type Loaded } from "@/lib/paper/store";
import type { OrderRequest, PaperState } from "@/lib/paper/types";
import { isMarketOpen } from "@/lib/market-hours";

interface PaperCtx {
  state: PaperState;
  ready: boolean;
  /** True when the Supabase table is missing and data lives only in this browser. */
  localOnly: boolean;
  error: string | null;
  quotes: Record<string, Quote>;
  equity: number;
  place: (req: OrderRequest) => Promise<{ error?: string; filled?: boolean }>;
  closeNow: (positionId: number, qty?: number) => Promise<{ error?: string }>;
  cancel: (orderId: number) => void;
  reset: (capital: number) => void;
}

const Ctx = createContext<PaperCtx | null>(null);

export function usePaper(): PaperCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePaper must be used inside <PaperProvider>");
  return c;
}

const nowSec = () => Math.floor(Date.now() / 1000);

async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  if (!symbols.length) return [];
  const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) throw new Error("Could not fetch quotes");
  return (await res.json()).quotes as Quote[];
}

export function PaperProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PaperState>(() => newAccount());
  const [ready, setReady] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const stateRef = useRef(state);
  const loadedRef = useRef<Pick<Loaded, "id" | "localOnly">>({ localOnly: true });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveAccount(supabase, loadedRef.current, stateRef.current).catch((e: Error) => setError(`Could not save: ${e.message}`));
    }, 600);
  }, [supabase]);

  const commit = useCallback((next: PaperState) => {
    stateRef.current = next;
    setState(next);
    scheduleSave();
  }, [scheduleSave]);

  // Load + catch up on anything that happened while the app was closed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadAccount(supabase);
        if (cancelled) return;
        loadedRef.current = { id: loaded.id, localOnly: loaded.localOnly };
        setLocalOnly(loaded.localOnly);
        let st = loaded.state;
        const symbols = [...new Set([...st.positions.map((p) => p.symbol), ...st.orders.map((o) => o.symbol)])];
        for (const sym of symbols) {
          const since = Math.min(...[...st.positions.filter((p) => p.symbol === sym).map((p) => p.lastCheckedAt), ...st.orders.filter((o) => o.symbol === sym).map((o) => o.createdAt)]);
          const days = Math.min(59, Math.max(1, Math.ceil((nowSec() - since) / 86400) + 1));
          try {
            const res = await fetch(`/api/candles?symbol=${encodeURIComponent(sym)}&interval=15m&days=${days}`);
            if (!res.ok) continue;
            const candles = (await res.json()).candles as Candle[];
            st = catchUp(st, sym, candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
          } catch {}
        }
        if (cancelled) return;
        stateRef.current = st;
        setState(st);
        setReady(true);
        if (st !== loaded.state) scheduleSave();
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, scheduleSave]);

  // Live ticks for anything we hold or have working orders on.
  const symbolsKey = useMemo(
    () => [...new Set([...state.positions.map((p) => p.symbol), ...state.orders.map((o) => o.symbol)])].sort().join(","),
    [state.positions, state.orders],
  );
  useEffect(() => {
    if (!ready || !symbolsKey) return;
    let stop = false;
    const tick = async () => {
      try {
        const qs = await fetchQuotes(symbolsKey.split(","));
        if (stop || !qs.length) return;
        setQuotes((prev) => ({ ...prev, ...Object.fromEntries(qs.map((q) => [q.symbol, q])) }));
        let st = stateRef.current;
        for (const q of qs) st = onPrice(st, q.symbol, q.price, q.time || nowSec());
        if (intradayDue(st, nowSec())) st = squareOffIntraday(st, Object.fromEntries(qs.map((q) => [q.symbol, q.price])), nowSec());
        if (st !== stateRef.current) commit(st);
      } catch {}
    };
    tick();
    const id = setInterval(tick, isMarketOpen() ? 10_000 : 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [ready, symbolsKey, commit]);

  const place = useCallback(async (req: OrderRequest) => {
    try {
      const [q] = await fetchQuotes([req.symbol]);
      if (!q) return { error: "No live price available for this symbol" };
      setQuotes((prev) => ({ ...prev, [q.symbol]: q }));
      // One clock: stamp the order with the quote's own time so later ticks (also q.time) are
      // never judged against a different clock. The intraday session check uses the wall clock.
      const r = placeOrder(stateRef.current, req, q.price, q.time || nowSec(), { intradayClock: nowSec() });
      if (!r.error) commit(r.state);
      return { error: r.error, filled: r.filled };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [commit]);

  const closeNow = useCallback(async (positionId: number, qty?: number) => {
    const pos = stateRef.current.positions.find((p) => p.id === positionId);
    if (!pos) return { error: "Position not found" };
    try {
      const [q] = await fetchQuotes([pos.symbol]);
      if (!q) return { error: "No live price available" };
      const r = closePosition(stateRef.current, positionId, qty ?? pos.qty, q.price, nowSec(), "manual");
      if (!r.error) commit(r.state);
      return { error: r.error };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [commit]);

  const cancel = useCallback((orderId: number) => commit(cancelOrder(stateRef.current, orderId)), [commit]);
  const reset = useCallback((capital: number) => commit(newAccount(capital)), [commit]);

  const prices = useMemo(() => Object.fromEntries(Object.values(quotes).map((q) => [q.symbol, q.price])), [quotes]);
  const equity = useMemo(() => equityOf(state, prices), [state, prices]);

  const value = useMemo<PaperCtx>(
    () => ({ state, ready, localOnly, error, quotes, equity, place, closeNow, cancel, reset }),
    [state, ready, localOnly, error, quotes, equity, place, closeNow, cancel, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
