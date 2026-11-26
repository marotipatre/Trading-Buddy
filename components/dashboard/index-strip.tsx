"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChangePill } from "@/components/change-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui/sparkline";
import { useQuotes } from "@/components/use-quotes";
import { fetchCandles } from "@/lib/analysis/candle-cache";
import { INDICES } from "@/lib/universe";

const SHOWN = INDICES.slice(0, 3);

/** The three headline indices: level, change, and the last 30 sessions as a trend line. */
export function IndexStrip() {
  const idx = useQuotes(SHOWN.map((i) => i.symbol));
  const [lines, setLines] = useState<Record<string, number[]>>({});
  useEffect(() => {
    let live = true;
    SHOWN.forEach((i) => fetchCandles(i.symbol, 60).then((c) => { if (live) setLines((l) => ({ ...l, [i.symbol]: c.slice(-30).map((x) => x.close) })); }).catch(() => undefined));
    return () => { live = false; };
  }, []);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {SHOWN.map((i) => {
        const q = idx.quotes[i.symbol];
        return (
          <Link key={i.symbol} href={`/trade?symbol=${encodeURIComponent(i.symbol)}`} className="group flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40">
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground">{i.name}</div>
              {q ? (
                <>
                  <div className="figure mt-0.5 text-[1.65rem] leading-none">{q.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="mt-1.5"><ChangePill pct={q.changePct} amount={q.change} /></div>
                </>
              ) : idx.loading ? <div className="mt-1 space-y-2"><Skeleton className="h-7 w-28" /><Skeleton className="h-4 w-24" /></div> : <div className="mt-1 text-sm text-muted-foreground">Unavailable</div>}
            </div>
            <Sparkline values={lines[i.symbol] ?? []} up={q ? q.changePct >= 0 : undefined} />
          </Link>
        );
      })}
    </div>
  );
}
