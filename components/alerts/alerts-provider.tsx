"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuotes } from "@/components/use-quotes";
import { createClient } from "@/lib/supabase/client";
import { activeSymbols, describeAlert, evaluateAlerts, parseAlert, validateAlert, type AlertDirection, type PriceAlert } from "@/lib/alerts";
import { isMissingTable } from "@/lib/paper/store";
import { displaySymbol } from "@/lib/symbols";

interface Ctx {
  alerts: PriceAlert[];
  ready: boolean;
  /** True when the table is missing and alerts live only in this browser. */
  localOnly: boolean;
  create: (symbol: string, direction: AlertDirection, price: number, ltp: number | undefined, note?: string) => Promise<{ error?: string }>;
  cancel: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  notifications: NotificationPermission | "unsupported";
  enableNotifications: () => Promise<void>;
}

const AlertsCtx = createContext<Ctx | null>(null);
export function useAlerts(): Ctx {
  const c = useContext(AlertsCtx);
  if (!c) throw new Error("useAlerts must be used inside <AlertsProvider>");
  return c;
}

const LOCAL_KEY = "trading-buddy:alerts:v1";
const SEEN_KEY = "trading-buddy:alerts-seen-at:v1";
const readLocal = (): PriceAlert[] => { try { const v = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const writeLocal = (a: PriceAlert[]) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(a.slice(0, 200))); } catch {} };

function notify(title: string, body: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body });
  } catch {}
}

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [ready, setReady] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPermission | "unsupported">("unsupported");
  const supabase = useRef(createClient());
  const firing = useRef(new Set<string>());
  const localRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the browser permission after mount
    setNotifications(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    let alive = true;
    (async () => {
      const { data, error } = await supabase.current.from("price_alerts").select("*").order("created_at", { ascending: false }).limit(200);
      if (!alive) return;
      let list: PriceAlert[];
      if (error) {
        if (!isMissingTable(error)) { setReady(true); return; }
        localRef.current = true;
        setLocalOnly(true);
        list = readLocal();
      } else {
        list = (data ?? []).map((r) => parseAlert(r as Record<string, unknown>)).filter((x): x is PriceAlert => x !== null);
      }
      setAlerts(list);
      setReady(true);
      // Tell the user about anything that fired while the app was closed (e.g. found by the server watcher).
      let seen = 0;
      try { seen = Number(localStorage.getItem(SEEN_KEY)) || 0; } catch {}
      for (const a of list.filter((x) => x.status === "triggered" && (x.triggeredAt ?? 0) > seen && seen > 0)) {
        toast.info(`While you were away: ${displaySymbol(a.symbol)} ${describeAlert(a)}${a.triggeredPrice ? ` (hit ${a.triggeredPrice.toFixed(2)})` : ""}`);
      }
      try { localStorage.setItem(SEEN_KEY, String(Math.floor(Date.now() / 1000))); } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const persist = useCallback((next: PriceAlert[]) => { if (localRef.current) writeLocal(next); }, []);

  const create = useCallback<Ctx["create"]>(async (symbol, direction, price, ltp, note) => {
    const bad = validateAlert(direction, price, ltp);
    if (bad) return { error: bad };
    if (localRef.current) {
      const a: PriceAlert = { id: `local-${Date.now()}`, symbol, direction, price, note, status: "active", createdAt: Math.floor(Date.now() / 1000) };
      setAlerts((cur) => { const n = [a, ...cur]; persist(n); return n; });
      return {};
    }
    const { data, error } = await supabase.current.from("price_alerts").insert({ symbol, direction, price, note: note ?? null }).select("*").single();
    if (error) return { error: error.message };
    const a = parseAlert(data as Record<string, unknown>);
    if (a) setAlerts((cur) => [a, ...cur]);
    return {};
  }, [persist]);

  const setStatus = useCallback(async (id: string, patch: Partial<PriceAlert>) => {
    setAlerts((cur) => { const n = cur.map((a) => (a.id === id ? { ...a, ...patch } : a)); persist(n); return n; });
    if (id.startsWith("local-")) return;
    await supabase.current.from("price_alerts").update({
      status: patch.status,
      ...(patch.triggeredAt ? { triggered_at: new Date(patch.triggeredAt * 1000).toISOString(), triggered_price: patch.triggeredPrice } : {}),
    }).eq("id", id);
  }, [persist]);

  const cancel = useCallback((id: string) => setStatus(id, { status: "cancelled" }), [setStatus]);
  const remove = useCallback(async (id: string) => {
    setAlerts((cur) => { const n = cur.filter((a) => a.id !== id); persist(n); return n; });
    if (!id.startsWith("local-")) await supabase.current.from("price_alerts").delete().eq("id", id);
  }, [persist]);

  const enableNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    setNotifications(await Notification.requestPermission());
  }, []);

  // Watch prices of symbols with active alerts and fire them.
  const symbols = useMemo(() => activeSymbols(alerts), [alerts]);
  const { quotes } = useQuotes(symbols, { openMs: 15_000, closedMs: 120_000, enabled: ready && symbols.length > 0 });
  useEffect(() => {
    const prices = Object.fromEntries(Object.values(quotes).map((q) => [q.symbol, q.price]));
    for (const { alert, price } of evaluateAlerts(alerts, prices)) {
      if (firing.current.has(alert.id)) continue;
      firing.current.add(alert.id);
      const msg = `${displaySymbol(alert.symbol)} ${describeAlert(alert)} (now ${price.toFixed(2)})`;
      toast.success(`Alert: ${msg}`, { duration: 15_000 });
      notify("Price alert", msg);
      void setStatus(alert.id, { status: "triggered", triggeredAt: Math.floor(Date.now() / 1000), triggeredPrice: price });
    }
  }, [quotes, alerts, setStatus]);

  const value = useMemo<Ctx>(() => ({ alerts, ready, localOnly, create, cancel, remove, notifications, enableNotifications }), [alerts, ready, localOnly, create, cancel, remove, notifications, enableNotifications]);
  return <AlertsCtx.Provider value={value}>{children}</AlertsCtx.Provider>;
}
