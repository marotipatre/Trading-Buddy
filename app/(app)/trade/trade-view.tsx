"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OrderTicket } from "@/components/paper/order-ticket";
import { PositionsPanel } from "@/components/paper/positions-panel";
import { PriceChart } from "@/components/price-chart";
import { SymbolSearch } from "@/components/symbol-search";
import type { Candle, Interval, Quote } from "@/lib/data/types";
import { isMarketOpen } from "@/lib/market-hours";

const RANGES: { label: string; interval: Interval; days: number }[] = [
  { label: "1Y daily", interval: "1d", days: 365 },
  { label: "3Y daily", interval: "1d", days: 365 * 3 },
  { label: "10Y daily", interval: "1d", days: 365 * 10 },
  { label: "15m (59d)", interval: "15m", days: 59 },
  { label: "5m (59d)", interval: "5m", days: 59 },
];

export function TradeView() {
  const router = useRouter();
  const params = useSearchParams();
  const symbol = params.get("symbol") ?? "RELIANCE.NS";
  const [rangeIdx, setRangeIdx] = useState(0);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const range = RANGES[rangeIdx];

  useEffect(() => {
    const ctl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset UI before fetching
    setLoading(true);
    setError(null);
    fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${range.interval}&days=${range.days}`, { signal: ctl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load");
        setCandles(j.candles);
      })
      .catch((e) => e.name !== "AbortError" && setError(e.message))
      .finally(() => !ctl.signal.aborted && setLoading(false));
    return () => ctl.abort();
  }, [symbol, range.interval, range.days]);

  // Live price for the header and the order ticket.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbol)}`);
        const j = await r.json();
        if (!stop && j.quotes?.[0]) setQuote(j.quotes[0]);
      } catch {}
    };
    tick();
    const id = setInterval(tick, isMarketOpen() ? 10_000 : 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [symbol]);

  const last = candles.at(-1);
  const ltp = quote?.symbol === symbol ? quote.price : last?.close;
  const changePct = quote?.symbol === symbol ? quote.changePct : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{symbol}</h1>
          {ltp !== undefined && (
            <div className="font-mono text-sm">
              {ltp.toFixed(2)}{" "}
              <span className={changePct >= 0 ? "text-up" : "text-down"}>
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <SymbolSearch onPick={(h) => router.push(`/trade?symbol=${encodeURIComponent(h.symbol)}`)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r, i) => (
              <Button key={r.label} size="sm" variant={i === rangeIdx ? "default" : "outline"} onClick={() => setRangeIdx(i)}>
                {r.label}
              </Button>
            ))}
          </div>
          {error && <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">{error}</p>}
          <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
            <PriceChart candles={candles} intraday={range.interval !== "1d"} />
          </div>
          <p className="text-xs text-muted-foreground">
            {candles.length} candles · intraday history is limited to ~59 days by the free data source.
          </p>
        </div>
        <div className="space-y-4">
          <OrderTicket symbol={symbol} ltp={ltp} />
        </div>
      </div>
      <PositionsPanel />
    </div>
  );
}
