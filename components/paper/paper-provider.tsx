"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Candle, Quote } from "@/lib/data/types";
import { catchUp, closePosition, expireOrders, intradayDue, modifyOrder, newAccount, onPrice, placeOrder, setExits as setExitsFn, squareOffIntraday, cancelOrder, equity as equityOf } from "@/lib/paper/broker";
import { annotateTrade, recordEquity } from "@/lib/paper/journal";
import { addMoney as addMoneyFn, normalizeState, transferMoney, withdrawMoney } from "@/lib/paper/funds";
import { loadAccount, saveAccount, type Loaded } from "@/lib/paper/store";
import type { OrderEvent, OrderRequest, PaperState, Pot } from "@/lib/paper/types";
import { toast } from "sonner";
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
  /** Change a resting order's price and/or quantity. */
  modify: (orderId: number, patch: { price?: number; qty?: number }) => Promise<{ error?: string }>;
  /** Set, change (number) or remove (null) a position's stop-loss and take-profit. */
  setExits: (positionId: number, exits: { stop?: number | null; target?: number | null; trailing?: boolean }) => Promise<{ error?: string }>;
  annotate: (tradeId: number, patch: { note?: string; tags?: string[] }) => void;
  /** Money moves between the trading pot and the bank pot (or in/out of the app). */
  addMoney: (pot: Pot, amount: number) => { error?: string };
  withdraw: (pot: Pot, amount: number) => { error?: string };
  transfer: (from: Pot, amount: number) => { error?: string };
  reset: (capital: number, bank?: number) => void;
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
  const priceRef = useRef<Record<string, number>>({}); // latest known price per symbol
  const loadedRef = useRef<Pick<Loaded, "id" | "localOnly" | "updatedAt">>({ localOnly: true });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const lastConflictToast = useRef(0);
  const seenEvent = useRef(0); // highest order-event id already shown to the user

  /** Tell the user when an order executed, expired or was rejected (not for changes they just made). */
  const announce = useCallback((events: OrderEvent[] | undefined, prefix = "") => {
    for (const e of events ?? []) {
      if (e.id <= seenEvent.current) continue;
      seenEvent.current = Math.max(seenEvent.current, e.id);
      if (e.kind === "filled") toast.success(prefix + e.text);
      else if (e.kind === "rejected" || e.kind === "expired") toast.warning(prefix + e.text);
      else if (e.kind === "cancelled" && e.text.includes("no longer hold")) toast.info(prefix + e.text);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveAccount(supabase, loadedRef.current, stateRef.current)
        .then(async (r) => {
          if (r.updatedAt) loadedRef.current = { ...loadedRef.current, updatedAt: r.updatedAt };
          if (!r.conflict) return;
          // Someone else (e.g. the order watcher) changed the account since we loaded it: show theirs, do not overwrite it.
          const remote = await loadAccount(supabase);
          loadedRef.current = { id: remote.id, localOnly: remote.localOnly, updatedAt: remote.updatedAt };
          const st = expireOrders(remote.state, Math.floor(Date.now() / 1000));
          stateRef.current = st;
          setState(st);
          // Say it once in a while, not on every heartbeat, when another tab or the watcher keeps updating the account.
          if (Date.now() - lastConflictToast.current > 10 * 60_000) {
            lastConflictToast.current = Date.now();
            toast.warning("Your account was updated elsewhere (another tab, or the order watcher), so the latest version is shown.");
          }
          announce(st.events, "While you were away: ");
        })
        .catch((e: Error) => setError(`Could not save: ${e.message}`));
    }, 600);
  }, [supabase, announce]);

  const commit = useCallback((next: PaperState) => {
    stateRef.current = next;
    setState(next);
    announce(next.events);
    scheduleSave();
  }, [scheduleSave, announce]);

  // Load + catch up on anything that happened while the app was closed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadAccount(supabase);
        if (cancelled) return;
        loadedRef.current = { id: loaded.id, localOnly: loaded.localOnly, updatedAt: loaded.updatedAt };
        setLocalOnly(loaded.localOnly);
        let st = normalizeState(loaded.state);
        seenEvent.current = Math.max(0, ...(st.events ?? []).map((e) => e.id));
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
        st = expireOrders(st, nowSec());
        if (cancelled) return;
        stateRef.current = st;
        setState(st);
        announce(st.events, "While you were away: ");
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
  }, [supabase, scheduleSave, announce]);

  // Heartbeat: save once a minute while the app is open, so the background order watcher knows the app is
  // looking after the account and leaves it alone.
  useEffect(() => {
    if (!ready || localOnly) return;
    const id = setInterval(scheduleSave, 60_000);
    return () => clearInterval(id);
  }, [ready, localOnly, scheduleSave]);

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
        for (const q of qs) priceRef.current[q.symbol] = q.price;
        let st = stateRef.current;
        for (const q of qs) st = onPrice(st, q.symbol, q.price, q.time || nowSec());
        st = expireOrders(st, nowSec());
        if (intradayDue(st, nowSec())) st = squareOffIntraday(st, Object.fromEntries(qs.map((q) => [q.symbol, q.price])), nowSec());
        // Sample account value for the equity curve (immediately after a trade closes, else every 15 min).
        st = recordEquity(st, equityOf(st, priceRef.current), nowSec(), { force: st.trades.length !== stateRef.current.trades.length });
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
      priceRef.current[q.symbol] = q.price;
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
      if (!r.error) {
        priceRef.current[q.symbol] = q.price;
        commit(recordEquity(r.state, equityOf(r.state, priceRef.current), nowSec(), { force: true }));
      }
      return { error: r.error };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [commit]);

  const cancel = useCallback((orderId: number) => commit(cancelOrder(stateRef.current, orderId, nowSec())), [commit]);
  const withPrice = useCallback(async (symbol: string, fn: (ltp: number) => { state: PaperState; error?: string }) => {
    try {
      const [q] = await fetchQuotes([symbol]);
      if (!q) return { error: "No live price available for this symbol" };
      priceRef.current[q.symbol] = q.price;
      const r = fn(q.price);
      if (!r.error) commit(r.state);
      return { error: r.error };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [commit]);
  const modify = useCallback((orderId: number, patch: { price?: number; qty?: number }) => {
    const o = stateRef.current.orders.find((x) => x.id === orderId);
    if (!o) return Promise.resolve({ error: "Order not found" });
    return withPrice(o.symbol, (ltp) => modifyOrder(stateRef.current, orderId, patch, ltp, nowSec()));
  }, [withPrice]);
  const setExits = useCallback((positionId: number, exits: { stop?: number | null; target?: number | null; trailing?: boolean }) => {
    const p = stateRef.current.positions.find((x) => x.id === positionId);
    if (!p) return Promise.resolve({ error: "Position not found" });
    return withPrice(p.symbol, (ltp) => setExitsFn(stateRef.current, positionId, exits, ltp, nowSec()));
  }, [withPrice]);
  const annotate = useCallback(
    (tradeId: number, patch: { note?: string; tags?: string[] }) => commit(annotateTrade(stateRef.current, tradeId, patch)),
    [commit],
  );
  const reset = useCallback((capital: number, bank = 0) => commit(newAccount(capital, undefined, bank)), [commit]);
  const moneyOp = useCallback((fn: (s: PaperState) => { state: PaperState; error?: string }) => {
    const r = fn(stateRef.current);
    if (!r.error) commit(recordEquity(r.state, equityOf(r.state, priceRef.current), nowSec(), { force: true }));
    return { error: r.error };
  }, [commit]);
  const addMoney = useCallback((pot: Pot, amount: number) => moneyOp((s) => addMoneyFn(s, pot, amount, nowSec())), [moneyOp]);
  const withdraw = useCallback((pot: Pot, amount: number) => moneyOp((s) => withdrawMoney(s, pot, amount, nowSec())), [moneyOp]);
  const transfer = useCallback((from: Pot, amount: number) => moneyOp((s) => transferMoney(s, from, amount, nowSec())), [moneyOp]);

  const prices = useMemo(() => Object.fromEntries(Object.values(quotes).map((q) => [q.symbol, q.price])), [quotes]);
  const equity = useMemo(() => equityOf(state, prices), [state, prices]);

  const value = useMemo<PaperCtx>(
    () => ({ state, ready, localOnly, error, quotes, equity, place, closeNow, cancel, modify, setExits, annotate, addMoney, withdraw, transfer, reset }),
    [state, ready, localOnly, error, quotes, equity, place, closeNow, cancel, modify, setExits, annotate, addMoney, withdraw, transfer, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
