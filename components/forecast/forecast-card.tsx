"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Result { lastClose: number; median: number[]; p10: number[]; p90: number[]; upShare: number; endMedianPct: number; samples: number; model: string }

/** Experimental price-path forecast from a locally run open-source model. Never feeds scores, picks or orders. */
export function ForecastCard({ symbol }: { symbol: string }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ symbol: string; r?: Result; error?: string } | null>(null);
  const shown = res?.symbol === symbol ? res : null;

  async function run() {
    setBusy(true);
    try {
      const j = await (await fetch(`/api/forecast?symbol=${encodeURIComponent(symbol)}&days=5`)).json();
      setRes(j.error ? { symbol, error: j.error === "not configured" ? "not configured" : j.error } : { symbol, r: j });
    } catch (e) { setRes({ symbol, error: (e as Error).message }); } finally { setBusy(false); }
  }

  const r = shown?.r;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> AI price path (experimental)</CardTitle>
        <CardDescription>The next 5 sessions as sampled by Kronos, an open-source model for candlestick data, run on your own computer. A research toy: there is no evidence here that it beats a simple baseline, so it is never used in scores, picks or orders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" size="sm" onClick={run} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{busy ? "Sampling… (can take a minute)" : "Sample forecast"}</Button>
        {shown?.error === "not configured" && (
          <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">Not set up. To try it: follow the steps at the top of <code>scripts/kronos_service.py</code> (clone Kronos, install, run the service), then add <code>KRONOS_URL=http://localhost:8765</code> to <code>.env.local</code> and restart the app.</p>
        )}
        {shown?.error && shown.error !== "not configured" && <p className="text-sm text-down">{shown.error}</p>}
        {r && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-5 gap-2 text-center">
              {r.median.map((m, i) => (
                <div key={i} className="rounded-lg border p-2">
                  <div className="text-[11px] text-muted-foreground">Day {i + 1}</div>
                  <div className="tabular font-mono text-sm font-semibold">{m.toFixed(2)}</div>
                  <div className="tabular font-mono text-[11px] text-muted-foreground">{r.p10[i].toFixed(0)}–{r.p90[i].toFixed(0)}</div>
                </div>
              ))}
            </div>
            <p>Median after 5 sessions: <b className={cn("font-mono", r.endMedianPct >= 0 ? "text-up" : "text-down")}>{r.endMedianPct >= 0 ? "+" : ""}{r.endMedianPct.toFixed(1)}%</b>; {(r.upShare * 100).toFixed(0)}% of {r.samples} sampled paths end higher than today&apos;s close of {r.lastClose.toFixed(2)}. Small numbers under each day are the 10–90% range.</p>
            <p className="text-xs text-muted-foreground">Model: {r.model}. Samples differ every run. Treat this as a prompt for curiosity, not a signal.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
