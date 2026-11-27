"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Count } from "@/components/motion/primitives";
import { useUniverse } from "@/components/use-universe";
import { CAP_LABEL, THIN_CAPS } from "@/lib/universe-lists";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrderTicket } from "@/components/paper/order-ticket";
import { AlertForm } from "@/components/alerts/alert-form";
import { StockChart } from "@/components/chart/stock-chart";
import { planFromParams } from "@/lib/plan-link";
import { NewsPanel } from "@/components/news/news-panel";
import { TechSnapshot } from "@/components/trade/tech-snapshot";
import { ForecastCard } from "@/components/forecast/forecast-card";import { PositionsPanel } from "@/components/paper/positions-panel";
import { SymbolSearch } from "@/components/symbol-search";
import type { Quote } from "@/lib/data/types";
import { fmtInr, fmtPct } from "@/lib/format";
import { isMarketOpen } from "@/lib/market-hours";
import { loadRecent, pushRecent } from "@/lib/recent-symbols";
import { useMarketOpen } from "@/components/use-market-open";
import { usePaper } from "@/components/paper/paper-provider";
import { SymbolLabel } from "@/components/symbol-label";
import { useNow } from "@/components/use-now";
import { useWatchlist } from "@/components/use-watchlist";
import { positionStats } from "@/lib/paper/portfolio";
import { companyName, displaySymbol } from "@/lib/symbols";

const fmtAge = (sec: number) => (sec < 5 ? "just now" : sec < 90 ? `${Math.round(sec)}s ago` : sec < 5400 ? `${Math.round(sec / 60)} min ago` : sec < 129600 ? `${Math.round(sec / 3600)} h ago` : `${Math.round(sec / 86400)} d ago`);

export function TradeView() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = planFromParams((k) => params.get(k));
  const symbol = params.get("symbol") ?? "RELIANCE.NS";
  const initialSide = params.get("side") === "sell" ? "sell" : "buy";
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<string[]>([]);
  const open = useMarketOpen();
  const now = useNow(5_000);
  const { state } = usePaper();
  const wl = useWatchlist();
  const held = state.positions.filter((p) => p.symbol === symbol);
  const { stocks } = useUniverse();
  const info = stocks?.find((x) => x.symbol === symbol);

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
    const id = setInterval(tick, isMarketOpen() ? 5_000 : 60_000);
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
      <div className="flex flex-wrap items-center gap-3">
        {recent.length > 0 && (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto" aria-label="Recent stocks">
            {recent.map((s) => (
              <button key={s} type="button" onClick={() => router.push(`/trade?symbol=${encodeURIComponent(s)}`)}
                className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors", s === symbol ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>{displaySymbol(s)}</button>
            ))}
          </div>
        )}
        <div className="ml-auto w-full sm:w-72"><SymbolSearch onPick={(h) => router.push(`/trade?symbol=${encodeURIComponent(h.symbol)}`)} className="w-full" /></div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
        <Card>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <SymbolLabel symbol={symbol} className="[&_span:first-child]:text-lg" />
                {info && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded bg-muted px-1.5 py-0.5">{CAP_LABEL[info.cap]}</span>
                    {info.sector !== "Unclassified" && <span className="rounded bg-muted px-1.5 py-0.5">{info.sector}</span>}
                    {THIN_CAPS.includes(info.cap) && <span className="rounded bg-warn/15 px-1.5 py-0.5 text-warn">Thinly traded class: check volume before sizing up</span>}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {q ? <Count value={q.price} decimals={2} className="figure text-5xl leading-none" /> : <span className="figure text-5xl leading-none text-muted-foreground">{loading ? "…" : "—"}</span>}
                  {q && (
                    <span className={`figure whitespace-nowrap text-lg ${up ? "text-up" : "text-down"}`}>
                      {up ? "+" : ""}{q.change.toFixed(2)} ({fmtPct(q.changePct, 2, { sign: true })})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {q?.source && <Badge variant="outline" title={q.source === "nse" ? "NSE's own live feed, about a minute behind the market" : undefined}>{open ? "Live" : "Last session"} · {({ upstox: "Upstox", nse: "NSE (about 1 min delayed)", yahoo: "Yahoo", google: "Google Finance" } as const)[q.source]}{now && q.time ? ` · ${fmtAge(now - q.time)}` : ""}</Badge>}
                <Button variant="ghost" size="icon-sm" aria-label={wl.has(symbol) ? "Remove from watchlist" : "Add to watchlist"} onClick={() => wl.toggle(symbol, companyName(symbol))}>
                  <Star className={wl.has(symbol) ? "fill-warn text-warn" : ""} />
                </Button>
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
                  <span>{open === null ? "" : open ? "Market open" : "Market closed"}</span>
                </div>
              </div>
            )}
            {error && !q && <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">{error}</p>}
          </CardContent>
        </Card>
          <StockChart symbol={symbol} plan={plan} />
          <TechSnapshot symbol={symbol} />
          <ForecastCard symbol={symbol} />
          <NewsPanel name={companyName(symbol) ?? displaySymbol(symbol)} price={q?.price} />
        </div>
        <div className="space-y-4 lg:sticky lg:top-[5.5rem] lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:pb-2">
          {held.length > 0 && (
            <Card>
              <CardContent className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Your position</div>
                {held.map((p) => {
                  const st = positionStats(p, q?.price ?? p.entryPrice, q?.prevClose, now);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                      <div className="text-sm">{p.qty} {p.direction === "short" ? "short" : "shares"} · Avg {p.entryPrice.toFixed(2)}<span className="ml-1 text-xs text-muted-foreground">{p.product === "delivery" ? "CNC" : "MIS"}</span></div>
                      <div className={`tabular text-right font-mono text-sm font-semibold ${st.pnl >= 0 ? "text-up" : "text-down"}`}>{fmtInr(st.pnl, { sign: true })}<div className="text-xs">{fmtPct(st.pnlPct, 2, { sign: true })}</div></div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <OrderTicket key={`${symbol}-${initialSide}`} symbol={symbol} ltp={q?.price} initialSide={initialSide} plan={plan} />
          <AlertForm key={`alert-${symbol}`} symbol={symbol} ltp={q?.price} />
        </div>
      </div>

      <PositionsPanel />
    </div>
  );
}
