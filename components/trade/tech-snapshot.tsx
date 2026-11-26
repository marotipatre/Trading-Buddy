"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchCandles } from "@/lib/analysis/candle-cache";
import { latestPatterns } from "@/lib/analysis/patterns";
import { assessStock, type StockView } from "@/lib/analysis/stock-view";
import { atr } from "@/lib/engine/indicators";
import { swingLevels } from "@/lib/engine/indicators/pivots";
import { planToQuery } from "@/lib/plan-link";
import { cn } from "@/lib/utils";

interface Snap { view: StockView | null; hi: number; lo: number; price: number; atrPct: number; volRatio: number; support?: number; resistance?: number; patterns: { name: string; bias: string }[] }
const ARROW = { up: "▲", down: "▼", flat: "▬" } as const;
const TONE = { up: "text-up", down: "text-down", flat: "text-muted-foreground" } as const;
const BADGE = { buy: "bg-up/15 text-up", watch: "bg-warn/15 text-warn", avoid: "bg-down/15 text-down" } as const;
const LABEL = { buy: "Buy setup", watch: "Watch", avoid: "Avoid" } as const;

/** A quick read of the stock from its daily candles: trend on three time frames, levels, range, volatility and a plan. */
export function TechSnapshot({ symbol }: { symbol: string }) {
  const router = useRouter();
  const [snap, setSnap] = useState<{ symbol: string; s: Snap | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetchCandles(symbol, 800).then((c) => {
      if (!live) return;
      if (c.length < 60) return setSnap({ symbol, s: null });
      const n = c.length - 1;
      const year = c.slice(-252);
      const a = atr(c, 14)[n];
      const vol20 = c.slice(n - 20, n).reduce((s, x) => s + x.volume, 0) / 20;
      const lv = swingLevels(c, 5);
      setSnap({ symbol, s: {
        view: assessStock(symbol, c), hi: Math.max(...year.map((x) => x.high)), lo: Math.min(...year.map((x) => x.low)), price: c[n].close,
        atrPct: Number.isFinite(a) ? (a / c[n].close) * 100 : NaN, volRatio: vol20 > 0 ? c[n].volume / vol20 : NaN,
        support: Number.isFinite(lv.support[n]) ? lv.support[n] : undefined, resistance: Number.isFinite(lv.resistance[n]) ? lv.resistance[n] : undefined,
        patterns: latestPatterns(c).map((p) => ({ name: p.name, bias: p.bias })),
      } });
    }).catch(() => live && setSnap({ symbol, s: null }));
    return () => { live = false; };
  }, [symbol]);

  const s = snap?.symbol === symbol ? snap.s : undefined;
  if (s === undefined) return <Card><CardContent className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-16 w-full" /></CardContent></Card>;
  if (!s) return null;
  const v = s.view;
  const pos = s.hi > s.lo ? ((s.price - s.lo) / (s.hi - s.lo)) * 100 : 50;
  const d = (x?: number) => (x ? `${((x / s.price - 1) * 100).toFixed(1)}%` : "");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">Technical snapshot {v && <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", BADGE[v.verdict])}>{LABEL[v.verdict]} · {v.score}</span>}</CardTitle>
        <CardDescription>Read from daily candles by fixed rules. Not a prediction.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {v && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="font-mono text-xs" title="Daily, weekly, monthly trend">{(["daily", "weekly", "monthly"] as const).map((f) => <span key={f} className={cn("mr-2", TONE[v.frames[f]])}>{f[0].toUpperCase()}{ARROW[v.frames[f]]}</span>)}</span>
            <span className="text-xs text-muted-foreground">RSI <b className="font-mono text-foreground">{v.rsi.toFixed(0)}</b></span>
            <span className="text-xs text-muted-foreground">Daily range <b className="font-mono text-foreground">{Number.isFinite(s.atrPct) ? `${s.atrPct.toFixed(1)}%` : "—"}</b></span>
            <span className="text-xs text-muted-foreground">Volume vs average <b className="font-mono text-foreground">{Number.isFinite(s.volRatio) ? `${s.volRatio.toFixed(1)}x` : "—"}</b></span>
            <span className="text-xs text-muted-foreground">1m <b className={cn("font-mono", v.ret.m1 >= 0 ? "text-up" : "text-down")}>{v.ret.m1 >= 0 ? "+" : ""}{v.ret.m1.toFixed(1)}%</b> · 3m <b className={cn("font-mono", v.ret.m3 >= 0 ? "text-up" : "text-down")}>{v.ret.m3 >= 0 ? "+" : ""}{v.ret.m3.toFixed(1)}%</b></span>
          </div>
        )}
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>52-week low <b className="font-mono text-foreground">{s.lo.toFixed(2)}</b></span><span>52-week high <b className="font-mono text-foreground">{s.hi.toFixed(2)}</b></span></div>
          <div className="relative h-1.5 rounded-full bg-muted"><span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary" style={{ left: `${Math.min(100, Math.max(0, pos))}%` }} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/50 p-2"><div className="text-muted-foreground">Nearest support</div><b className="font-mono text-sm">{s.support ? s.support.toFixed(2) : "none found"}</b> <span className="text-muted-foreground">{d(s.support)}</span></div>
          <div className="rounded-lg bg-muted/50 p-2"><div className="text-muted-foreground">Nearest resistance</div><b className="font-mono text-sm">{s.resistance ? s.resistance.toFixed(2) : "none found"}</b> <span className="text-muted-foreground">{d(s.resistance)}</span></div>
        </div>
        {s.patterns.length > 0 && <p className="text-xs text-muted-foreground">Latest candle: {s.patterns.map((p) => `${p.name} (${p.bias})`).join(", ")}.</p>}
        {v?.plan && v.verdict !== "avoid" && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-2.5 text-xs">
            <span>Plan: buy {v.plan.entryKind === "now" ? "near" : "on a dip to"} <b className="font-mono">{v.plan.entry.toFixed(2)}</b></span>
            <span>stop <b className="font-mono text-down">{v.plan.stop.toFixed(2)}</b></span>
            <span>target <b className="font-mono text-up">{v.plan.target1.toFixed(2)}</b></span>
            <span className="text-muted-foreground">R:R {v.plan.rr1.toFixed(1)}</span>
            <Button size="xs" variant="outline" className="ml-auto" onClick={() => router.replace(`/trade?symbol=${encodeURIComponent(symbol)}&${planToQuery({ entry: v.plan!.entry, stop: v.plan!.stop, target: v.plan!.target1 })}`, { scroll: false })}>Use this plan</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
