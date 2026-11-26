"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/backtest/metric-card";
import { NumberField } from "@/components/backtest/number-field";
import { SymbolSearch } from "@/components/symbol-search";
import { useUniverse } from "@/components/use-universe";
import { usePaper } from "@/components/paper/paper-provider";
import type { Candle } from "@/lib/data/types";
import { assessStock, type StockView } from "@/lib/analysis/stock-view";
import { reviewPortfolio, type Holding, type PortfolioReview } from "@/lib/analysis/holding-review";
import { fmtInr, fmtPct } from "@/lib/format";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";

const KEY = "tb.review.holdings";
const TONE = { hold: "bg-muted text-muted-foreground", add: "bg-up/15 text-up", trim: "bg-warn/15 text-warn", exit: "bg-down/15 text-down" } as const;

function load(): Holding[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((h) => typeof h?.symbol === "string" && h.qty > 0 && h.avg > 0).slice(0, 60) : [];
  } catch { return []; }
}
async function candlesOf(symbol: string): Promise<Candle[]> {
  const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=1d&days=800`);
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "no data");
  return j.candles as Candle[];
}

/** Your own holdings checked against the same trend rules as the Ideas page, with last week's performance. */
export function ReviewPanel() {
  const { state } = usePaper();
  const { stocks } = useUniverse();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [draft, setDraft] = useState<{ symbol: string; qty: number; avg: number }>({ symbol: "", qty: 10, avg: 0 });
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<PortfolioReview | null>(null);
  const [failed, setFailed] = useState<string[]>([]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- holdings are remembered in this browser
  useEffect(() => { setHoldings(load()); }, []);
  const save = (h: Holding[]) => { setHoldings(h); setReview(null); try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* storage unavailable */ } };

  const add = () => {
    if (!draft.symbol || draft.qty <= 0 || draft.avg <= 0) { toast.error("Pick a stock, then enter quantity and your average buy price"); return; }
    save([...holdings.filter((h) => h.symbol !== draft.symbol), { symbol: draft.symbol, qty: Math.round(draft.qty), avg: draft.avg }]);
    setDraft({ symbol: "", qty: 10, avg: 0 });
  };
  const importPaper = () => {
    const mine = state.positions.filter((p) => p.direction === "long" && p.product === "delivery");
    if (!mine.length) { toast.info("You have no paper delivery holdings to import"); return; }
    const merged = new Map(holdings.map((h) => [h.symbol, h]));
    for (const p of mine) merged.set(p.symbol, { symbol: p.symbol, qty: p.qty, avg: p.entryPrice });
    save([...merged.values()]);
    toast.success(`Imported ${mine.length} holding${mine.length > 1 ? "s" : ""}`);
  };

  async function analyse() {
    if (!holdings.length) return;
    setBusy(true);
    const views = new Map<string, StockView | null>();
    const bad: string[] = [];
    try {
      const jobs = holdings.map(async (h) => {
        try { views.set(h.symbol, assessStock(h.symbol, await candlesOf(h.symbol))); } catch { views.set(h.symbol, null); bad.push(displaySymbol(h.symbol)); }
      });
      const bench = candlesOf("^NSEI").then((c) => (c.length > 5 ? (c[c.length - 1].close / c[c.length - 6].close - 1) * 100 : null)).catch(() => null);
      const [, b] = await Promise.all([Promise.all(jobs), bench]);
      const sector = (s: string) => stocks?.find((x) => x.symbol === s)?.sector ?? "Other";
      setReview(reviewPortfolio(holdings, views, sector, b));
      setFailed(bad);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your portfolio</CardTitle>
          <CardDescription>Add what you hold (stock, quantity, your average buy price). It stays in this browser. Then press Review for a check against the same rules as the Ideas page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Stock</Label>
              <div className="flex items-center gap-2"><span className="w-24 font-mono text-sm font-semibold">{draft.symbol ? displaySymbol(draft.symbol) : "—"}</span><SymbolSearch className="w-56" placeholder="Search a stock…" onPick={(h) => setDraft((d) => ({ ...d, symbol: h.symbol }))} /></div></div>
            <div className="w-24 space-y-1"><Label className="text-xs text-muted-foreground">Quantity</Label><NumberField min={1} value={draft.qty} onChange={(qty) => setDraft({ ...draft, qty })} /></div>
            <div className="w-32 space-y-1"><Label className="text-xs text-muted-foreground">Avg buy price (₹)</Label><NumberField min={0} step={0.5} value={draft.avg} onChange={(avg) => setDraft({ ...draft, avg })} /></div>
            <Button variant="outline" onClick={add}>Add</Button>
            <Button variant="ghost" onClick={importPaper}>Import paper holdings</Button>
          </div>
          {holdings.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {holdings.map((h) => (
                <li key={h.symbol} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                  <b className="font-mono">{displaySymbol(h.symbol)}</b> {h.qty} @ ₹{h.avg}
                  <button type="button" aria-label={`Remove ${displaySymbol(h.symbol)}`} onClick={() => save(holdings.filter((x) => x.symbol !== h.symbol))} className="text-muted-foreground hover:text-foreground"><Trash2 className="size-3" /></button>
                </li>
              ))}
            </ul>
          )}
          <Button onClick={analyse} disabled={busy || !holdings.length}>{busy && <Loader2 className="animate-spin" />}{busy ? "Reading prices…" : "Review my portfolio"}</Button>
          {failed.length > 0 && <p className="text-xs text-warn">No price history for: {failed.join(", ")}. They are left out of the signals.</p>}
        </CardContent>
      </Card>

      {review && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Value" value={fmtInr(review.value)} sub={`Invested ${fmtInr(review.cost)}`} />
            <MetricCard label="Total P&L" value={fmtInr(review.pnl, { sign: true })} sub={fmtPct(review.pnlPct, 1, { sign: true })} tone={review.pnl >= 0 ? "up" : "down"} />
            <MetricCard label="Last 5 trading days" value={fmtPct(review.weekPct, 2, { sign: true })} sub={`${fmtInr(review.weekPnl, { sign: true })}${review.benchWeekPct !== null ? ` · Nifty ${fmtPct(review.benchWeekPct, 2, { sign: true })}` : ""}`} tone={review.weekPnl >= 0 ? "up" : "down"} />
            <MetricCard label="Sectors" value={String(review.sectors.length)} sub={review.sectors.slice(0, 2).map((s) => `${s.sector} ${s.weightPct.toFixed(0)}%`).join(" · ")} />
          </div>
          {review.notes.length > 0 && (
            <Card><CardHeader><CardTitle>What stands out</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-1 pl-5 text-sm">{review.notes.map((n) => <li key={n}>{n}</li>)}</ul></CardContent></Card>
          )}
          <Card>
            <CardHeader><CardTitle>Holding by holding</CardTitle><CardDescription>Suggestions come from trend, momentum and position size. They are prompts to think, not instructions.</CardDescription></CardHeader>
            <CardContent className="divide-y">
              {review.rows.map((r) => (
                <div key={r.symbol} className="space-y-1.5 py-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <b className="min-w-24 font-mono">{displaySymbol(r.symbol)}</b>
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", TONE[r.action])}>{r.headline}</span>
                    <span className="tabular font-mono text-sm">{r.qty} × ₹{r.price.toFixed(2)}</span>
                    <span className={cn("tabular font-mono text-sm", r.pnl >= 0 ? "text-up" : "text-down")}>{fmtInr(r.pnl, { sign: true })} ({fmtPct(r.pnlPct, 1, { sign: true })})</span>
                    <span className={cn("tabular font-mono text-xs", r.weekPct >= 0 ? "text-up" : "text-down")}>week {fmtPct(r.weekPct, 1, { sign: true })}</span>
                    <span className="text-xs text-muted-foreground">{r.weightPct.toFixed(0)}% of portfolio · {r.sector}</span>
                    {r.view && <span className="tabular font-mono text-xs text-muted-foreground">score {r.view.score}</span>}
                  </div>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
                  {r.stop && <p className="text-xs text-muted-foreground">Stop worth having: <b className="font-mono text-foreground">₹{r.stop.toFixed(2)}</b> ({fmtPct((r.stop / r.price - 1) * 100, 1)} from here)</p>}
                </div>
              ))}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">For learning. Rule-based reading of price trends, not investment advice, and it does not know your tax, goals or other assets.</p>
        </>
      )}
    </div>
  );
}
