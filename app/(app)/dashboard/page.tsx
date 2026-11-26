"use client";

import { useMemo } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Section } from "@/components/ui/page-header";
import { IndexStrip } from "@/components/dashboard/index-strip";
import { usePaper } from "@/components/paper/paper-provider";
import { StockRow } from "@/components/stock-row";
import { useQuotes } from "@/components/use-quotes";
import { useUniverse } from "@/components/use-universe";
import { useWatchlist } from "@/components/use-watchlist";
import { CAP_LABEL, CAP_ORDER } from "@/lib/universe-lists";
import { fmtInr } from "@/lib/format";
import { companyName, displaySymbol } from "@/lib/symbols";
import { POPULAR_STOCKS } from "@/lib/universe";
import { useMarketOpen } from "@/components/use-market-open";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { TodayCard } from "@/components/dashboard/today-card";
import { TopIdeas } from "@/components/dashboard/top-ideas";

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
    <div className="space-y-8">
      <PageHeader title="Explore" description={open === null ? "\u00a0" : open ? "The market is open. Prices refresh every few seconds." : "The market is closed. Prices are from the last session."}>
        <Button variant="outline" size="sm" onClick={() => { watch.refresh(); movers.refresh(); }}><RefreshCw />Refresh</Button>
      </PageHeader>

      <IndexStrip />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <TodayCard />
          <TopIdeas />
          <GettingStarted />
          <Section title="Browse the market" aside={<Link href="/stocks" className="text-primary hover:underline">All stocks</Link>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CAP_ORDER.map((c) => (
                <Link key={c} href={`/stocks?cap=${c}`} className="rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/40">
                  <div className="text-sm font-medium">{CAP_LABEL[c]}</div>
                  <div className="figure mt-0.5 text-xl">{stocks ? stocks.filter((s) => s.cap === c).length.toLocaleString("en-IN") : "-"}</div>
                </Link>
              ))}
            </div>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {(sectors ?? []).filter((s) => s.name !== "Unclassified").slice(0, 14).map((s) => (
                <Link key={s.name} href={`/stocks?sector=${encodeURIComponent(s.name)}`} className="shrink-0 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  {s.name} <span className="opacity-60">{s.count}</span>
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <div className="min-w-0 space-y-6">
          {state.positions.length > 0 && (
            <Link href="/portfolio" className="block rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">Your portfolio</div>
                  <div className="figure text-[1.65rem] leading-tight">{fmtInr(equity)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Today</div>
                  <div className={`figure text-lg ${dayPnl >= 0 ? "text-up" : "text-down"}`}>{fmtInr(dayPnl, { sign: true })}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{state.positions.length} open position{state.positions.length > 1 ? "s" : ""}</div>
            </Link>
          )}

          <Card className="rounded-2xl py-0">
            <CardHeader className="pt-4"><CardTitle>Your watchlist</CardTitle></CardHeader>
            {wl.error && <p className="mx-4 mb-3 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">{wl.error}</p>}
            {!wl.ready ? (
              <>{Array.from({ length: 4 }, (_, i) => <RowSkeleton key={i} />)}</>
            ) : wl.items.length === 0 ? (
              <p className="px-4 pb-6 text-sm text-muted-foreground">Your watchlist is empty. Search for a stock above, or tap the star next to any stock.</p>
            ) : (
              <div>
                {wl.items.map((i) => (
                  <StockRow key={i.id} symbol={i.symbol} name={i.name ?? companyName(i.symbol)} quote={watch.quotes[i.symbol]} onRemove={() => wl.remove(i.symbol)} />
                ))}
              </div>
            )}
            {watch.failed && <p className="px-4 pb-3 text-xs text-muted-foreground">Some prices could not be refreshed. Showing the last known values.</p>}
          </Card>

          <Card className="rounded-2xl py-0">
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
            <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">Among {MOVERS.length} popular stocks, for example {displaySymbol(MOVERS[0].symbol)} and {displaySymbol(MOVERS[1].symbol)}.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
