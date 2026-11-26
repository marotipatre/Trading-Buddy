"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SymbolSearch } from "@/components/symbol-search";
import { isMarketOpen } from "@/lib/market-hours";
import type { Quote, SymbolHit } from "@/lib/data/types";

const DEFAULTS: SymbolHit[] = [
  { symbol: "^NSEI", name: "NIFTY 50", exchange: "NSI" },
  { symbol: "^NSEBANK", name: "NIFTY BANK", exchange: "NSI" },
  { symbol: "RELIANCE.NS", name: "Reliance Industries", exchange: "NSI" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", exchange: "NSI" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", exchange: "NSI" },
  { symbol: "INFY.NS", name: "Infosys", exchange: "NSI" },
];

interface Item { id: string; symbol: string; name: string | null }

export default function DashboardPage() {
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: lists, error: e1 } = await supabase.from("watchlists").select("id").order("created_at").limit(1);
    if (e1) return setError(`Database error: ${e1.message}. Did you run the SQL migration?`);
    let id = lists?.[0]?.id as string | undefined;
    if (!id) {
      const { data, error } = await supabase.from("watchlists").insert({ name: "Default" }).select("id").single();
      if (error) return setError(error.message);
      id = data.id as string;
      await supabase.from("watchlist_items").insert(
        DEFAULTS.map((d) => ({ watchlist_id: id, symbol: d.symbol, name: d.name })),
      );
    }
    setListId(id);
    const { data: rows } = await supabase
      .from("watchlist_items")
      .select("id,symbol,name")
      .eq("watchlist_id", id)
      .order("created_at");
    setItems((rows ?? []) as Item[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

  const symbolsKey = items.map((i) => i.symbol).join(",");
  useEffect(() => {
    if (!symbolsKey) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbolsKey)}`);
        const json = await res.json();
        if (!stop && json.quotes) {
          setQuotes(Object.fromEntries((json.quotes as Quote[]).map((q) => [q.symbol, q])));
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, isMarketOpen() ? 10_000 : 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [symbolsKey]);

  async function add(hit: SymbolHit) {
    if (!listId || items.some((i) => i.symbol === hit.symbol)) return;
    const { error } = await createClient()
      .from("watchlist_items")
      .insert({ watchlist_id: listId, symbol: hit.symbol, name: hit.name });
    if (error) return setError(error.message);
    load();
  }

  async function remove(id: string) {
    await createClient().from("watchlist_items").delete().eq("id", id);
    setItems((x) => x.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Watchlist</h1>
          <p className="text-sm text-muted-foreground">Live prices for the symbols you follow</p>
        </div>
        <SymbolSearch onPick={add} placeholder="Add symbol…" />
      </div>
      {error && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">{error}</p>
      )}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Symbol</TableHead>
              <TableHead className="text-right">LTP</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Day range</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => {
              const q = quotes[i.symbol];
              const up = (q?.change ?? 0) >= 0;
              return (
                <TableRow key={i.id}>
                  <TableCell className="pl-4">
                    <Link href={`/trade?symbol=${encodeURIComponent(i.symbol)}`} className="font-medium hover:text-primary">
                      {i.symbol}
                    </Link>
                    <div className="text-xs text-muted-foreground">{i.name}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{q ? q.price.toFixed(2) : "—"}</TableCell>
                  <TableCell className={`text-right font-mono ${up ? "text-up" : "text-down"}`}>
                    {q ? `${up ? "+" : ""}${q.change.toFixed(2)} (${q.changePct.toFixed(2)}%)` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {q ? `${q.dayLow.toFixed(2)} – ${q.dayHigh.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="pr-2">
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(i.id)} aria-label={`Remove ${i.symbol}`}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground">
        Prices come from Yahoo Finance (unofficial, may be delayed by a few minutes).
      </p>
    </div>
  );
}
