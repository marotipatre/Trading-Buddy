"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Lightbulb, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCandles } from "@/lib/analysis/candle-cache";
import { marketRegime, type MarketRegime } from "@/lib/analysis/regime";
import { cn } from "@/lib/utils";

/** One glance at the market's condition, and where to go next. */
export function TodayCard() {
  const [r, setR] = useState<MarketRegime | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetchCandles("^NSEI", 500).then((c) => { if (live) setR(marketRegime(c)); }).catch(() => { if (live) setR(null); });
    return () => { live = false; };
  }, []);
  return (
    <Card className="rounded-2xl">
      <CardContent className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-1.5">
          <div className="text-sm text-muted-foreground">How the market looks</div>
          {r === undefined ? <><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full" /></> : r === null ? <p className="text-sm text-muted-foreground">Could not read the Nifty right now.</p> : (
            <>
              <div className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", r.regime === "bull" ? "bg-up" : r.regime === "bear" ? "bg-down" : "bg-warn")} />
                <span className="font-heading text-2xl font-semibold tracking-tight">{r.label}</span>
                <span className="font-mono text-xs text-muted-foreground">Nifty {r.vs200 >= 0 ? "+" : ""}{r.vs200.toFixed(1)}% vs 200-day average</span>
              </div>
              <p className="text-sm text-muted-foreground">{r.advice}</p>
            </>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
          {[
            { href: "/ideas", icon: Lightbulb, label: "Today's swing ideas" },
            { href: "/intraday", icon: Zap, label: "Intraday picks" },
            { href: "/playbook", icon: BookOpen, label: "Rule books" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/60">
              <Icon className="size-4 text-primary" />{label}<ArrowRight className="ml-auto size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
