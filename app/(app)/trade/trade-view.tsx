"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PriceChart } from "@/components/price-chart";
import { SymbolSearch } from "@/components/symbol-search";
import type { Candle, Interval } from "@/lib/data/types";

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
  const symbol = params.get("symbol") ?? "^NSEI";
  const [rangeIdx, setRangeIdx] = useState(0);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const range = RANGES[rangeIdx];

  useEffect(() => {
    const ctl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset UI before fetching
    setLoading(true);
    setError(null);
    fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${range.interval}&days=${range.days}`, {
      signal: ctl.signal,
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load");
        setCandles(j.candles);
      })
      .catch((e) => e.name !== "AbortError" && setError(e.message))
      .finally(() => !ctl.signal.aborted && setLoading(false));
    return () => ctl.abort();
  }, [symbol, range.interval, range.days]);

  const last = candles.at(-1);
  const prev = candles.at(-2);
  const chg = last && prev ? ((last.close - prev.close) / prev.close) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{symbol}</h1>
          {last && (
            <div className="font-mono text-sm">
              {last.close.toFixed(2)}{" "}
              <span className={chg >= 0 ? "text-up" : "text-down"}>
                {chg >= 0 ? "+" : ""}
                {chg.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <SymbolSearch onPick={(h) => router.push(`/trade?symbol=${encodeURIComponent(h.symbol)}`)} />
      </div>
      <div className="flex gap-2">
        {RANGES.map((r, i) => (
          <button
            key={r.label}
            onClick={() => setRangeIdx(i)}
            className={`rounded-md px-3 py-1 text-xs ${
              i === rangeIdx ? "bg-accent text-white" : "border border-line text-muted hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {error && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">{error}</p>}
      <div className={loading ? "opacity-50" : ""}>
        <PriceChart candles={candles} intraday={range.interval !== "1d"} />
      </div>
      <p className="text-xs text-muted">
        {candles.length} candles · intraday history is limited to ~59 days by the free data source. Order ticket arrives in Phase 3.
      </p>
    </div>
  );
}
