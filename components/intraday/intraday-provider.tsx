"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Quote } from "@/lib/data/types";
import { cancelOrder, closePosition, expireOrders, intradayDue, onPrice, placeOrder, squareOffIntraday } from "@/lib/paper/broker";
import { isMarketOpen } from "@/lib/market-hours";
import { addToPot, loadIntraday, newIntradayAccount, potView, saveIntraday, type IntradayAccount, type PotView } from "@/lib/intraday/account";
import type { OrderRequest } from "@/lib/paper/types";

interface Ctx {
  acc: IntradayAccount | null;
  ready: boolean;
  quotes: Record<string, Quote>;
  view: PotView | null;
  create: (pot: number) => void;
  topUp: (amount: number) => { error?: string };
  place: (req: Omit<OrderRequest, "product">) => Promise<{ error?: string; filled?: boolean }>;
  closeNow: (positionId: number) => Promise<{ error?: string }>;
  cancel: (orderId: number) => void;
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

/** The separate 5x margin day-trading account. Saved in this browser; never mixes with the main paper account. */
export function IntradayProvider({ children }: { children: React.ReactNode }) {
  const [acc, setAcc] = useState<IntradayAccount | null>(null);
  const [ready, setReady] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const ref = useRef<IntradayAccount | null>(null);
  const prices = useRef<Record<string, number>>({});
  const seen = useRef(0);

  const commit = useCallback((next: IntradayAccount | null) => {
    ref.current = next;
    setAcc(next);
    if (next) saveIntraday(next);
    for (const e of next?.state.events ?? []) {
      if (e.id <= seen.current) continue;
      seen.current = e.id;
      if (e.kind === "filled") toast.success(`Intraday: ${e.text}`);
      else if (e.kind === "rejected" || e.kind === "expired") toast.warning(`Intraday: ${e.text}`);
    }
  }, []);

  useEffect(() => {
    const a = loadIntraday();
    ref.current = a;
    seen.current = Math.max(0, ...(a?.state.events ?? []).map((e) => e.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the saved account after mount
    setAcc(a);
    setReady(true);
  }, []);

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
        let st = cur.state;
        for (const q of qs) st = onPrice(st, q.symbol, q.price, q.time || nowSec());
        st = expireOrders(st, nowSec());
        if (intradayDue(st, nowSec())) st = squareOffIntraday(st, Object.fromEntries(qs.map((q) => [q.symbol, q.price])), nowSec());
        if (st !== cur.state) commit({ ...cur, state: st });
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
      if (!r.error) commit({ ...cur, state: r.state });
      return { error: r.error };
    } catch (e) { return { error: (e as Error).message }; }
  }, [commit]);
  const cancel = useCallback((orderId: number) => { const cur = ref.current; if (cur) commit({ ...cur, state: cancelOrder(cur.state, orderId, nowSec()) }); }, [commit]);
  const reset = useCallback(() => { try { localStorage.removeItem("tb.intraday.v1"); } catch { /* ignore */ } ref.current = null; setAcc(null); setQuotes({}); }, []);

  const view = useMemo(() => (acc ? potView(acc, Object.fromEntries(Object.values(quotes).map((q) => [q.symbol, q.price]))) : null), [acc, quotes]);
  const value = useMemo<Ctx>(() => ({ acc, ready, quotes, view, create, topUp, place, closeNow, cancel, reset }), [acc, ready, quotes, view, create, topUp, place, closeNow, cancel, reset]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
