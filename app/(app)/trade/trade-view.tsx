"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrderTicket } from "@/components/paper/order-ticket";
import { PositionsPanel } from "@/components/paper/positions-panel";
import { SymbolSearch } from "@/components/symbol-search";
import type { Quote } from "@/lib/data/types";
import { fmtPct } from "@/lib/format";
import { isMarketOpen } from "@/lib/market-hours";
import { loadRecent, pushRecent } from "@/lib/recent-symbols";

export function TradeView() {
  const router = useRouter();
  const params = useSearchParams();
  const symbol = params.get("symbol") ?? "RELIANCE.NS";
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<string[]>([]);

  // Remember the symbols you trade so switching between them is one click.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from localStorage after mount
    setRecent(pushRecent(symbol));
  }, [symbol]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial read after mount
    setRecent((r) => (r.length ? r : loadRecent()));
  }, []);

  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let stop = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset while a new symbol loads
    setLoading(true);
    const tick = async () => {
      try {
        const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbol)}`);
        const j = await r.json();
        if (stop) return;
        if (j.quotes?.[0]) {
          setQuote(j.quotes[0]);
          setError(null);
        } else {
          setError("No live price for this symbol right now. Check the symbol, or retry in a moment.");
        }
      } catch {
        if (!stop) setError("Could not reach the price service.");
      } finally {
        if (!stop) setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, isMarketOpen() ? 10_000 : 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [symbol, nonce]);

  const q = quote?.symbol === symbol ? quote : null;
  const up = (q?.change ?? 0) >= 0;
  const rangePos = q && q.dayHigh > q.dayLow ? ((q.price - q.dayLow) / (q.dayHigh - q.dayLow)) * 100 : 50;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Trade</h1>
          <p className="text-sm text-muted-foreground">Paper trade at live prices</p>
        </div>
        <SymbolSearch onPick={(h) => router.push(`/trade?symbol=${encodeURIComponent(h.symbol)}`)} />
      </div>

      {recent.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recent.map((s) => (
            <Button key={s} size="xs" variant={s === symbol ? "default" : "outline"} onClick={() => router.push(`/trade?symbol=${encodeURIComponent(s)}`)}>
              {s.replace(/\.NS$/, "")}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm text-muted-foreground">{symbol}</div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="font-mono text-5xl font-semibold tracking-tight">{q ? q.price.toFixed(2) : loading ? "…" : "—"}</span>
                  {q && (
                    <span className={`font-mono text-lg ${up ? "text-up" : "text-down"}`}>
                      {up ? "+" : ""}{q.change.toFixed(2)} ({fmtPct(q.changePct, 2, { sign: true })})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {q?.source && <Badge variant="outline">via {q.source === "google" ? "Google Finance" : "Yahoo"}</Badge>}
                <Button variant="ghost" size="icon-sm" aria-label="Refresh price" onClick={() => setNonce((n) => n + 1)}>
                  <RefreshCw />
                </Button>
              </div>
            </div>

            {q && (
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono text-xs text-muted-foreground">
                  <span>Low {q.dayLow.toFixed(2)}</span>
                  <span>Day range</span>
                  <span>High {q.dayHigh.toFixed(2)}</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-muted">
                  <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary" style={{ left: `${Math.min(100, Math.max(0, rangePos))}%` }} />
                </div>
                <div className="flex justify-between pt-1 text-xs text-muted-foreground">
                  <span>Previous close <span className="font-mono text-foreground">{q.prevClose.toFixed(2)}</span></span>
                  <span>{isMarketOpen() ? "Market open" : "Market closed — showing the last traded price"}</span>
                </div>
              </div>
            )}
            {error && !q && <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">{error}</p>}
          </CardContent>
        </Card>
        <OrderTicket symbol={symbol} ltp={q?.price} />
      </div>

      <PositionsPanel />
    </div>
  );
}
