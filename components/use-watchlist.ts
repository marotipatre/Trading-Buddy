"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_WATCHLIST } from "@/lib/universe";
import { rememberName } from "@/lib/symbols";

export interface WatchItem { id: string; symbol: string; name: string | null }

/**
 * The user's watchlist, stored in Supabase. Adds and removes apply instantly (optimistic) and roll
 * back with an error if the save fails, so the list never feels slow.
 */
export function useWatchlist() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useRef<string | null>(null);
  const supabase = useRef(createClient());

  const load = useCallback(async () => {
    const sb = supabase.current;
    const { data: lists, error: e1 } = await sb.from("watchlists").select("id").order("created_at").limit(1);
    if (e1) {
      setError(`Could not load your watchlist (${e1.message}). Did you run the SQL migration?`);
      setReady(true);
      return;
    }
    let id = lists?.[0]?.id as string | undefined;
    if (!id) {
      const { data, error } = await sb.from("watchlists").insert({ name: "Default" }).select("id").single();
      if (error) { setError(error.message); setReady(true); return; }
      id = data.id as string;
      await sb.from("watchlist_items").insert(DEFAULT_WATCHLIST.map((d) => ({ watchlist_id: id, symbol: d.symbol, name: d.name })));
    }
    listId.current = id;
    const { data: rows } = await sb.from("watchlist_items").select("id,symbol,name").eq("watchlist_id", id).order("created_at");
    const list = (rows ?? []) as WatchItem[];
    list.forEach((r) => rememberName(r.symbol, r.name));
    setItems(list);
    setError(null);
    setReady(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const has = useCallback((symbol: string) => items.some((i) => i.symbol === symbol), [items]);

  const add = useCallback(async (symbol: string, name?: string | null) => {
    if (!listId.current || items.some((i) => i.symbol === symbol)) return;
    const temp: WatchItem = { id: `tmp-${symbol}`, symbol, name: name ?? null };
    setItems((cur) => [...cur, temp]);
    const { data, error } = await supabase.current.from("watchlist_items")
      .insert({ watchlist_id: listId.current, symbol, name: name ?? null }).select("id").single();
    if (error) {
      setItems((cur) => cur.filter((i) => i.id !== temp.id));
      setError(`Could not add ${symbol}: ${error.message}`);
    } else {
      setItems((cur) => cur.map((i) => (i.id === temp.id ? { ...i, id: data.id as string } : i)));
    }
  }, [items]);

  const remove = useCallback(async (symbol: string) => {
    const gone = items.find((i) => i.symbol === symbol);
    if (!gone) return;
    setItems((cur) => cur.filter((i) => i.symbol !== symbol));
    if (gone.id.startsWith("tmp-")) return;
    const { error } = await supabase.current.from("watchlist_items").delete().eq("id", gone.id);
    if (error) {
      setItems((cur) => [...cur, gone]);
      setError(`Could not remove ${symbol}: ${error.message}`);
    }
  }, [items]);

  return { items, ready, error, has, add, remove, toggle: (symbol: string, name?: string | null) => (has(symbol) ? remove(symbol) : add(symbol, name)) };
}
