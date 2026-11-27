"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Quote } from "@/lib/data/types";
import { fetchCandles } from "@/lib/analysis/candle-cache";
import { cancelOrder, closePosition, equity as equityOf, expireOrders, intradayDue, modifyOrder, onPrice, placeOrder, setExits as setExitsFn, squareOffIntraday, istStartOfDay } from "@/lib/paper/broker";
import { annotateTrade, recordEquity } from "@/lib/paper/journal";
import { isMarketOpen } from "@/lib/market-hours";
import { addToPot, loadIntraday, newIntradayAccount, potView, saveIntraday, type IntradayAccount, type PotView } from "@/lib/intraday/account";
import { settleStale } from "@/lib/intraday/replay";
import { loadRemote, newer, saveRemote } from "@/lib/intraday/sync";
import type { OrderRequest } from "@/lib/paper/types";

interface Ctx {
  acc: IntradayAccount | null;
  ready: boolean;
  /** True when migration 0004 has not been run, so the account lives only in this browser. */
  localOnly: boolean;
  quotes: Record<string, Quote>;
  view: PotView | null;
  create: (pot: number) => void;
  topUp: (amount: number) => { error?: string };
  place: (req: Omit<OrderRequest, "product">) => Promise<{ error?: string; filled?: boolean }>;
  closeNow: (positionId: number) => Promise<{ error?: string }>;
  cancel: (orderId: number) => void;
  /** Change a resting order's price or quantity. */
  modify: (orderId: number, patch: { price?: number; qty?: number }) => Promise<{ error?: string }>;
  /** Set or clear a position's stop-loss and target. */
  setExits: (positionId: number, exits: { stop?: number | null; target?: number | null }) => Promise<{ error?: string }>;
  /** Close every open position at the current price. */
  exitAll: () => Promise<{ error?: string; closed: number }>;
  annotate: (tradeId: number, patch: { note?: string; tags?: string[] }) => void;
  reset: () => void;
}
const C = createContext<Ctx | null>(null);
export function useIntraday(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error("useIntraday must be used inside <IntradayProvider>");
  return c;
}

const nowSec = () => Math.floor(Date.now() / 1000);
async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  if (!symbols.length) return [];
  const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) throw new Error("Could not fetch quotes");
  return (await res.json()).quotes as Quote[];
}

/** The separate 5x margin day-trading account. Saved in this browser and backed up to Supabase; never mixes with the main account. */
export function IntradayProvider({ children }: { children: React.ReactNode }) {
  const [acc, setAcc] = useState<IntradayAccount | null>(null);
  const [ready, setReady] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const ref = useRef<IntradayAccount | null>(null);
  const prices = useRef<Record<string, number>>({});
  const seen = useRef(0);
  const remoteOk = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const pushRemote = useCallback(() => {
    if (!remoteOk.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const cur = ref.current;
      if (!cur) return;
      const r = await saveRemote(supabase, cur).catch(() => ({ error: "offline" } as { error?: string; missing?: boolean }));
      if (r.missing) { remoteOk.current = false; setLocalOnly(true); }
    }, 1500);
  }, [supabase]);

  const commit = useCallback((next: IntradayAccount | null) => {
    const stamped = next ? { ...next, savedAt: Date.now() } : null;
    ref.current = stamped;
    setAcc(stamped);
    if (stamped) { saveIntraday(stamped); pushRemote(); }
    for (const e of stamped?.state.events ?? []) {
      if (e.id <= seen.current) continue;
      seen.current = e.id;
      if (e.kind === "filled") toast.success(`Intraday: ${e.text}`);
      else if (e.kind === "rejected" || e.kind === "expired") toast.warning(`Intraday: ${e.text}`);
    }
  }, [pushRemote]);

  // Show the browser copy at once (the page never waits on the network), then reconcile with Supabase and settle
  // anything left over from an earlier session in the background.
  useEffect(() => {
    let dead = false;
    const local = loadIntraday();
    ref.current = local;
    seen.current = Math.max(0, ...(local?.state.events ?? []).map((e) => e.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the saved account immediately after mount
    setAcc(local);
    setReady(true);
    (async () => {
      let remote: Awaited<ReturnType<typeof loadRemote>> = { acc: null, missing: false };
      try { remote = await loadRemote(supabase); } catch { /* offline: keep the browser copy */ }
      if (dead) return;
      if (remote.missing) { remoteOk.current = false; setLocalOnly(true); }
      let a = newer(ref.current, remote.acc);
      if (a) {
        const today = istStartOfDay(nowSec());
        const stale = a.state.positions.filter((p) => p.product === "intraday" && p.entryTime < today);
        if (stale.length) {
          const bars: Record<string, Awaited<ReturnType<typeof fetchCandles>>> = {};
          for (const sym of new Set(stale.map((p) => p.symbol))) { try { bars[sym] = await fetchCandles(sym, 40, "5m"); } catch { /* handled as no data */ } }
          if (dead) return;
          const r = settleStale(a.state, bars, nowSec());
          a = { ...a, state: expireOrders(r.state, nowSec()) };
          if (r.settled) toast.info(`Closed ${r.settled} position${r.settled > 1 ? "s" : ""} from an earlier session at its 3:15 pm price${r.noData.length ? ` (no candles for ${r.noData.join(", ")}: closed at entry)` : ""}.`);
        }
      }
      if (!dead && !remote.acc && !remote.missing && ref.current) pushRemote(); // first backup of an existing local account
      if (dead || !a || a === ref.current) return;
      ref.current = a;
      seen.current = Math.max(seen.current, ...(a.state.events ?? []).map((e) => e.id));
      setAcc(a);
      saveIntraday(a);
      pushRemote();
    })();
    return () => { dead = true; };
  }, [supabase, pushRemote]);

  const symbolsKey = useMemo(() => [...new Set([...(acc?.state.positions ?? []).map((p) => p.symbol), ...(acc?.state.orders ?? []).map((o) => o.symbol)])].sort().join(","), [acc]);
  useEffect(() => {
    if (!ready || !symbolsKey) return;
    let stop = false;
    const tick = async () => {
      try {
        const qs = await fetchQuotes(symbolsKey.split(","));
        const cur = ref.current;
        if (stop || !qs.length || !cur) return;
        setQuotes((p) => ({ ...p, ...Object.fromEntries(qs.map((q) => [q.symbol, q])) }));
        for (const q of qs) prices.current[q.symbol] = q.price;
        const before = cur.state;
        let st = before;
        for (const q of qs) st = onPrice(st, q.symbol, q.price, q.time || nowSec());
        st = expireOrders(st, nowSec());
        if (intradayDue(st, nowSec())) st = squareOffIntraday(st, Object.fromEntries(qs.map((q) => [q.symbol, q.price])), nowSec());
        st = recordEquity(st, equityOf(st, prices.current), nowSec(), { force: st.trades.length !== before.trades.length });
        if (st !== before) commit({ ...cur, state: st });
      } catch { /* try again on the next tick */ }
    };
    tick();
    const id = setInterval(tick, isMarketOpen() ? 8_000 : 60_000);
    return () => { stop = true; clearInterval(id); };
  }, [ready, symbolsKey, commit]);

  const create = useCallback((pot: number) => commit(newIntradayAccount(pot)), [commit]);
  const topUp = useCallback((amount: number) => {
    const cur = ref.current;
    if (!cur) return { error: "No intraday account yet" };
    const r = addToPot(cur, amount, nowSec());
    if (!r.error) commit(r.acc);
    return { error: r.error };
  }, [commit]);
  const place = useCallback(async (req: Omit<OrderRequest, "product">) => {
    const cur = ref.current;
    if (!cur) return { error: "Set up your intraday pot first" };
    if (potView(cur, prices.current).broke) return { error: "Your pot is used up. Add money or reset to continue." };
    try {
      const [q] = await fetchQuotes([req.symbol]);
      if (!q) return { error: "No live price available for this symbol" };
      setQuotes((p) => ({ ...p, [q.symbol]: q }));
      prices.current[q.symbol] = q.price;
      const r = placeOrder(cur.state, { ...req, product: "intraday" }, q.price, q.time || nowSec(), { intradayClock: nowSec() });
      if (!r.error) commit({ ...cur, state: r.state });
      return { error: r.error, filled: r.filled };
    } catch (e) { return { error: (e as Error).message }; }
  }, [commit]);
  const closeNow = useCallback(async (positionId: number) => {
    const cur = ref.current;
    const pos = cur?.state.positions.find((p) => p.id === positionId);
    if (!cur || !pos) return { error: "Position not found" };
    try {
      const [q] = await fetchQuotes([pos.symbol]);
      if (!q) return { error: "No live price available" };
      const r = closePosition(cur.state, positionId, pos.qty, q.price, nowSec(), "manual");
      if (!r.error) { prices.current[q.symbol] = q.price; commit({ ...cur, state: recordEquity(r.state, equityOf(r.state, prices.current), nowSec(), { force: true }) }); }
      return { error: r.error };
    } catch (e) { return { error: (e as Error).message }; }
  }, [commit]);
  const cancel = useCallback((orderId: number) => { const cur = ref.current; if (cur) commit({ ...cur, state: cancelOrder(cur.state, orderId, nowSec()) }); }, [commit]);
  const modify = useCallback(async (orderId: number, patch: { price?: number; qty?: number }) => {
    const cur = ref.current;
    const o = cur?.state.orders.find((x) => x.id === orderId);
    if (!cur || !o) return { error: "Order not found" };
    try {
      const [q] = await fetchQuotes([o.symbol]);
      const r = modifyOrder(cur.state, orderId, patch, q?.price ?? 0, nowSec());
      if (!r.error) commit({ ...cur, state: r.state });
      return { error: r.error };
    } catch (e) { return { error: (e as Error).message }; }
  }, [commit]);
  const setExits = useCallback(async (positionId: number, exits: { stop?: number | null; target?: number | null }) => {
    const cur = ref.current;
    const p = cur?.state.positions.find((x) => x.id === positionId);
    if (!cur || !p) return { error: "Position not found" };
    try {
      const [q] = await fetchQuotes([p.symbol]);
      const r = setExitsFn(cur.state, positionId, exits, q?.price ?? 0, nowSec());
      if (!r.error) commit({ ...cur, state: r.state });
      return { error: r.error };
    } catch (e) { return { error: (e as Error).message }; }
  }, [commit]);
  const exitAll = useCallback(async () => {
    let cur = ref.current;
    if (!cur || !cur.state.positions.length) return { closed: 0 };
    let closed = 0, error: string | undefined;
    const ids = cur.state.positions.map((p) => p.id);
    const qs = await fetchQuotes([...new Set(cur.state.positions.map((p) => p.symbol))]).catch(() => []);
    const px = Object.fromEntries(qs.map((q) => [q.symbol, q.price]));
    for (const id of ids) {
      const pos = cur.state.positions.find((p) => p.id === id);
      if (!pos) continue;
      const price = px[pos.symbol] ?? prices.current[pos.symbol];
      if (!(price > 0)) { error = `No live price for ${pos.symbol}`; continue; }
      const r = closePosition(cur.state, id, pos.qty, price, nowSec(), "manual");
      if (r.error) { error = r.error; continue; }
      prices.current[pos.symbol] = price;
      cur = { ...cur, state: r.state }; closed++;
    }
    commit({ ...cur, state: recordEquity(cur.state, equityOf(cur.state, prices.current), nowSec(), { force: true }) });
    return { error, closed };
  }, [commit]);
  const annotate = useCallback((tradeId: number, patch: { note?: string; tags?: string[] }) => { const cur = ref.current; if (cur) commit({ ...cur, state: annotateTrade(cur.state, tradeId, patch) }); }, [commit]);
  const reset = useCallback(() => {
    try { localStorage.removeItem("tb.intraday.v1"); } catch { /* ignore */ }
    ref.current = null; setAcc(null); setQuotes({});
    if (remoteOk.current) void supabase.from("intraday_accounts").delete().not("user_id", "is", null).then(() => undefined);
  }, [supabase]);

  const view = useMemo(() => (acc ? potView(acc, Object.fromEntries(Object.values(quotes).map((q) => [q.symbol, q.price]))) : null), [acc, quotes]);
  const value = useMemo<Ctx>(() => ({ acc, ready, localOnly, quotes, view, create, topUp, place, closeNow, cancel, modify, setExits, exitAll, annotate, reset }), [acc, ready, localOnly, quotes, view, create, topUp, place, closeNow, cancel, modify, setExits, exitAll, annotate, reset]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
