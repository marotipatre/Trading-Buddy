"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FlaskConical, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/backtest/simple-select";
import { useUniverse } from "@/components/use-universe";
import { fetchCandles, pool as runPool } from "@/lib/analysis/candle-cache";
import { compareStrategies, type LabData, type LabRow } from "@/lib/engine/lab";
import { PRESETS } from "@/lib/engine/presets";
import { sampleEvenly } from "@/lib/engine/scan";
import { fmtNum, fmtPct } from "@/lib/format";
import { CAP_LABEL, type Cap } from "@/lib/universe-lists";
import { cn } from "@/lib/utils";

const TONE = { promising: "bg-up/15 text-up", mixed: "bg-warn/15 text-warn", weak: "bg-down/15 text-down", "too few trades": "bg-muted text-muted-foreground" } as const;

/** Every preset strategy on the same stocks, ranked on the later part of history, so you can see what actually held up. */
export function StrategyLab() {
  const { stocks } = useUniverse();
  const [cap, setCap] = useState<Cap | "all">("large");
  const [count, setCount] = useState("20");
  const [years, setYears] = useState("8");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [rows, setRows] = useState<LabRow[] | null>(null);
  const [meta, setMeta] = useState<{ stocks: number; years: number } | null>(null);
  const stopRef = useRef(false);
  const pool = useMemo(() => (stocks ?? []).filter((s) => cap === "all" || s.cap === cap).sort((a, b) => a.name.localeCompare(b.name)), [stocks, cap]);

  async function run() {
    const picks = sampleEvenly(pool, Number(count));
    if (!picks.length) { toast.error("No stocks loaded yet"); return; }
    stopRef.current = false; setRunning(true); setRows(null);
    const data: LabData[] = [];
    let done = 0;
    try {
      await runPool(picks, 8, async (s) => {
        try { const c = await fetchCandles(s.symbol, Number(years) * 365); if (c.length >= 300) data.push({ symbol: s.symbol, name: s.name, sector: s.sector, cap: s.cap, candles: c }); } catch { /* skip */ }
        setProgress({ done: ++done, total: picks.length });
      }, () => stopRef.current);
      if (!data.length) throw new Error("No price history could be loaded.");
      setProgress(null);
      await new Promise((r) => setTimeout(r, 30)); // let the page paint before the heavy part
      setRows(compareStrategies(PRESETS.map((p) => ({ id: p.id, label: p.label, strategy: p.strategy })), data));
      setMeta({ stocks: data.length, years: Number(years) });
      toast.success(`${PRESETS.length} strategies compared on ${data.length} stocks`);
    } catch (e) { toast.error((e as Error).message); } finally { setRunning(false); setProgress(null); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FlaskConical className="size-5 text-primary" /> Strategy lab</CardTitle>
          <CardDescription>Runs every ready-made strategy on the same stocks and ranks them by how they did in the later 30% of history, the part they were not shaped on. A strategy that only worked early is a warning, not a find.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-40 space-y-1"><Label className="text-xs text-muted-foreground">Stocks</Label><SimpleSelect className="w-full" value={cap} onChange={setCap} options={[{ value: "all", label: "All sizes" }, ...(["large", "mid", "small"] as Cap[]).map((c) => ({ value: c, label: CAP_LABEL[c] }))]} /></div>
          <div className="w-36 space-y-1"><Label className="text-xs text-muted-foreground">How many</Label><SimpleSelect className="w-full" value={count} onChange={setCount} options={[10, 20, 30, 50].map((n) => ({ value: String(n), label: `${n} stocks` }))} /></div>
          <div className="w-36 space-y-1"><Label className="text-xs text-muted-foreground">History</Label><SimpleSelect className="w-full" value={years} onChange={setYears} options={[5, 8, 12].map((n) => ({ value: String(n), label: `${n} years` }))} /></div>
          <Button size="lg" onClick={run} disabled={running || !pool.length}>{running ? <Loader2 className="animate-spin" /> : <Play />}{running ? "Comparing…" : "Compare all strategies"}</Button>
          {running && <Button size="lg" variant="outline" onClick={() => { stopRef.current = true; }}>Stop</Button>}
          {progress && <span className="font-mono text-xs text-muted-foreground">Loading {progress.done}/{progress.total}</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>What we measured (27 Nov 2026)</CardTitle><CardDescription>One run of this lab: 19 large-cap stocks, 8 years, costs included. Your run will differ.</CardDescription></CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          <p>Almost every ready-made swing strategy <b className="text-foreground">lost its edge in the later 30% of history</b>. The best, &ldquo;Pullback in an uptrend&rdquo; (476 trades) and &ldquo;EMA 20/50 trend&rdquo; (209), earned about +0.4% and +0.7% a trade overall but roughly zero in the later period. The Minervini template looked best early (+1.36% a trade) and lost money later (−1.30%).</p>
          <p>Simply <b className="text-foreground">holding the stock beat the strategy on about 95% of stocks</b>, for almost every strategy: this was a strong market for buy-and-hold.</p>
          <p className="text-foreground"><b>What this teaches:</b> entry signals alone are a weak edge. What you control is risk per trade, cutting losers, selectivity and not overtrading, which is what the rule books and this app&apos;s checks push you toward.</p>
        </CardContent>
      </Card>

      {rows && meta && (
        <Card>
          <CardHeader><CardTitle>Results on {meta.stocks} stocks, {meta.years} years</CardTitle><CardDescription>Costs and slippage included. One run is one sample of the market: treat a ranking as a reason to look closer, not a verdict.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1.5">Strategy</th><th>Reading</th><th className="text-right">Trades</th><th className="text-right">Win rate</th><th className="text-right">Avg trade</th><th className="text-right">Later period</th><th className="text-right">Profit factor</th><th className="text-right">Stocks in profit</th><th className="text-right">Beat holding</th></tr></thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2 pr-3"><Link className="font-medium underline-offset-2 hover:underline" href={`/strategies?preset=${r.id}&mode=group`}>{r.label}</Link><div className="max-w-xs text-xs text-muted-foreground">{r.why}</div></td>
                    <td><span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", TONE[r.verdict])}>{r.verdict}</span></td>
                    <td className="tabular text-right font-mono">{r.summary.pooled.trades}</td>
                    <td className="tabular text-right font-mono">{fmtPct(r.summary.pooled.winRate * 100, 0)}</td>
                    <td className={cn("tabular text-right font-mono", r.summary.pooled.expectancyPct >= 0 ? "text-up" : "text-down")}>{fmtPct(r.summary.pooled.expectancyPct, 2, { sign: true })}</td>
                    <td className={cn("tabular text-right font-mono", r.summary.outSample.expectancyPct >= 0 ? "text-up" : "text-down")}>{r.summary.outSample.trades >= 20 ? fmtPct(r.summary.outSample.expectancyPct, 2, { sign: true }) : "—"}</td>
                    <td className="tabular text-right font-mono">{fmtNum(r.summary.pooled.profitFactor)}</td>
                    <td className="tabular text-right font-mono">{fmtPct(r.summary.profitableShare * 100, 0)}</td>
                    <td className="tabular text-right font-mono">{fmtPct(r.summary.beatBuyHoldShare * 100, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">For learning. Past results do not predict future ones, survivorship bias favours today&apos;s index members, and in strong markets almost nothing beats simply holding.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
