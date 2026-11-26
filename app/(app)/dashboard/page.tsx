"use client";

import { useMemo } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChangePill } from "@/components/change-pill";
import { usePaper } from "@/components/paper/paper-provider";
import { StockRow } from "@/components/stock-row";
import { useQuotes } from "@/components/use-quotes";
import { useUniverse } from "@/components/use-universe";
import { useWatchlist } from "@/components/use-watchlist";
import { CAP_LABEL, CAP_ORDER } from "@/lib/universe-lists";
import { fmtInr } from "@/lib/format";
import { companyName, displaySymbol } from "@/lib/symbols";
import { INDICES, POPULAR_STOCKS } from "@/lib/universe";
import { useMarketOpen } from "@/components/use-market-open";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { TodayCard } from "@/components/dashboard/today-card";
import { TopIdeas } from "@/components/dashboard/top-ideas";

const INDEX_SYMBOLS = INDICES.slice(0, 3);
const MOVERS = POPULAR_STOCKS.slice(0, 14);

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-36" /></div>
      <div className="space-y-1.5"><Skeleton className="ml-auto h-4 w-16" /><Skeleton className="ml-auto h-3 w-12" /></div>
    </div>
  );
}

export default function ExplorePage() {
  const open = useMarketOpen();
  const wl = useWatchlist();
  const { stocks, sectors } = useUniverse();
  const { state, equity, quotes: heldQuotes } = usePaper();
  const watchSymbols = useMemo(() => wl.items.map((i) => i.symbol), [wl.items]);
  const idx = useQuotes(INDEX_SYMBOLS.map((i) => i.symbol));
  const watch = useQuotes(watchSymbols);
  // Movers are secondary: load them after the watchlist so the lists you care about appear first.
  const movers = useQuotes(MOVERS.map((m) => m.symbol), { openMs: 30_000, closedMs: 300_000, enabled: wl.ready && !watch.loading });

  const ranked = useMemo(
    () => MOVERS.flatMap((m) => (movers.quotes[m.symbol] ? [{ ...m, q: movers.quotes[m.symbol] }] : [])).sort((a, b) => b.q.changePct - a.q.changePct),
    [movers.quotes],
  );
  const gainers = ranked.slice(0, 5);
  const losers = [...ranked].reverse().slice(0, 5);

  const dayPnl = state.positions.reduce((a, p) => {
    const q = heldQuotes[p.symbol];
    return q ? a + (p.direction === "long" ? 1 : -1) * (q.price - q.prevClose) * p.qty : a;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Explore</h1>
          <p className="text-sm text-muted-foreground">{open === null ? "\u00a0" : open ? "Markets are open" : "Markets are closed. Prices are from the last session."}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Refresh prices" onClick={() => { idx.refresh(); watch.refresh(); movers.refresh(); }}><RefreshCw /></Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {INDEX_SYMBOLS.map((i) => {
          const q = idx.quotes[i.symbol];
          return (
            <Link key={i.symbol} href={`/trade?symbol=${encodeURIComponent(i.symbol)}`}>
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{i.name}</div>
                  {q ? (
                    <>
                      <div className="tabular font-mono text-xl font-semibold">{q.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <ChangePill pct={q.changePct} amount={q.change} />
                    </>
                  ) : idx.loading ? <><Skeleton className="h-6 w-28" /><Skeleton className="h-4 w-20" /></> : <div className="text-sm text-muted-foreground">Unavailable</div>}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <TodayCard />
      <TopIdeas />
      <GettingStarted />

      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Browse by size and sector</h2>
          <Link href="/stocks" className="text-sm text-primary hover:underline">All stocks</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CAP_ORDER.map((c) => (
            <Link key={c} href={`/stocks?cap=${c}`}>
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="space-y-0.5">
                  <div className="text-sm font-semibold">{CAP_LABEL[c]}</div>
                  <div className="text-xs text-muted-foreground">{stocks ? `${stocks.filter((s) => s.cap === c).length} stocks` : "\u00a0"}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {(sectors ?? []).filter((s) => s.name !== "Unclassified").slice(0, 12).map((s) => (
            <Link key={s.name} href={`/stocks?sector=${encodeURIComponent(s.name)}`} className="shrink-0 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              {s.name} <span className="opacity-60">{s.count}</span>
            </Link>
          ))}
        </div>
      </div>

      {state.positions.length > 0 && (
        <Link href="/portfolio">
          <Card className="transition-colors hover:bg-accent/40">
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Your portfolio</div>
                <div className="tabular font-mono text-xl font-semibold">{fmtInr(equity)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Today</div>
                <div className={`tabular font-mono text-lg font-medium ${dayPnl >= 0 ? "text-up" : "text-down"}`}>{fmtInr(dayPnl, { sign: true })}</div>
              </div>
              <Badge variant="outline">{state.positions.length} open position{state.positions.length > 1 ? "s" : ""}</Badge>
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="py-0">
          <CardHeader className="pt-4"><CardTitle>Your watchlist</CardTitle></CardHeader>
          {wl.error && <p className="mx-4 mb-3 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">{wl.error}</p>}
          {!wl.ready ? (
            <>{Array.from({ length: 5 }, (_, i) => <RowSkeleton key={i} />)}</>
          ) : wl.items.length === 0 ? (
            <p className="px-4 pb-6 text-sm text-muted-foreground">Your watchlist is empty. Search for a stock above, or tap the star next to any stock on this page.</p>
          ) : (
            <div>
              {wl.items.map((i) => (
                <StockRow key={i.id} symbol={i.symbol} name={i.name ?? companyName(i.symbol)} quote={watch.quotes[i.symbol]} onRemove={() => wl.remove(i.symbol)} />
              ))}
            </div>
          )}
          {watch.failed && <p className="px-4 pb-3 text-xs text-muted-foreground">Some prices could not be refreshed. Showing the last known values.</p>}
        </Card>

        <Card className="py-0">
          <Tabs defaultValue="gainers">
            <CardHeader className="pt-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Top movers</CardTitle>
                <TabsList>
                  <TabsTrigger value="gainers">Gainers</TabsTrigger>
                  <TabsTrigger value="losers">Losers</TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>
            {(["gainers", "losers"] as const).map((tab) => (
              <TabsContent key={tab} value={tab}>
                {movers.loading && ranked.length === 0
                  ? Array.from({ length: 5 }, (_, i) => <RowSkeleton key={i} />)
                  : (tab === "gainers" ? gainers : losers).map((m) => (
                      <StockRow key={m.symbol} symbol={m.symbol} name={m.name} quote={m.q} watched={wl.has(m.symbol)} onToggleWatch={() => wl.toggle(m.symbol, m.name)} />
                    ))}
                {!movers.loading && ranked.length === 0 && <p className="px-4 pb-4 text-sm text-muted-foreground">Prices are unavailable right now. Try again in a moment.</p>}
              </TabsContent>
            ))}
          </Tabs>
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">Among {MOVERS.length} popular stocks, e.g. {displaySymbol(MOVERS[0].symbol)}, {displaySymbol(MOVERS[1].symbol)}.</p>
        </Card>
      </div>
    </div>
  );
}
