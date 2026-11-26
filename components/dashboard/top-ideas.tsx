"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { BaseIdea } from "@/lib/analysis/ideas-engine";
import { displaySymbol } from "@/lib/symbols";
import { useNow } from "@/components/use-now";
import { PlanMeter, ScoreRing } from "@/components/ideas/shared";

interface Saved { at: number; bases: BaseIdea[] }

/** The three strongest buy setups from your last Ideas scan, so Explore has something worth acting on. Hidden until you have scanned. */
export function TopIdeas() {
  const [top, setTop] = useState<{ at: number; items: BaseIdea[] } | null>(null);
  const now = useNow(60_000);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("tb.ideas.last.v2") ?? "null") as Saved | null;
      if (!s?.bases?.length) return;
      const items = s.bases.filter((b) => b.view.verdict === "buy" && b.view.plan).sort((a, b) => b.view.score - a.view.score).slice(0, 3);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved scan after mount
      if (items.length) setTop({ at: s.at, items });
    } catch { /* ignore */ }
  }, []);
  if (!top) return null;
  const mins = Math.max(0, Math.round((now * 1000 - top.at) / 60000));
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Strongest setups from your last scan</h2>
          <Link href="/ideas" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">All ideas <ArrowRight className="size-3.5" /></Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {top.items.map((b) => (
            <Link key={b.symbol} href="/ideas" className="space-y-2 rounded-xl border p-3 transition-colors hover:bg-accent/40">
              <div className="flex items-center gap-2.5"><ScoreRing score={b.view.score} verdict={b.view.verdict} size={36} /><div className="min-w-0"><div className="font-mono text-sm font-semibold">{displaySymbol(b.symbol)}</div><div className="truncate text-xs text-muted-foreground">{b.sector}</div></div><div className="ml-auto tabular font-mono text-sm">{b.view.price.toFixed(2)}</div></div>
              <PlanMeter stop={b.view.plan!.stop} entry={b.view.plan!.entry} target={b.view.plan!.target1} price={b.view.price} />
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">From a scan {mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`} ago. Open Ideas to refresh and see the odds for your plan.</p>
      </CardContent>
    </Card>
  );
}
