"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/backtest/number-field";
import { SimpleSelect } from "@/components/backtest/simple-select";
import { NewsPanel } from "@/components/news/news-panel";
import { useUniverse } from "@/components/use-universe";
import type { Candle } from "@/lib/data/types";
import { newsMood } from "@/lib/analysis/sentiment";
import { rankSectors, type SectorRow } from "@/lib/analysis/sectors";
import { assessStock, positionSize, withOverlay, type StockView } from "@/lib/analysis/stock-view";
import type { AnalystCall, Consensus, NewsItem } from "@/lib/data/news";
import { fmtInr } from "@/lib/format";
import { displaySymbol } from "@/lib/symbols";
import { CAP_LABEL, type Cap, type UniverseStock } from "@/lib/universe-lists";
import { cn } from "@/lib/utils";

interface Idea { stock: UniverseStock; view: StockView; news?: { items: NewsItem[]; calls: AnalystCall[]; summary: Consensus } }
const ARROW = { up: "▲", down: "▼", flat: "▬" } as const;
const TONE = { up: "text-up", down: "text-down", flat: "text-muted-foreground" } as const;
const BADGE = { buy: "bg-up/15 text-up", watch: "bg-warn/15 text-warn", avoid: "bg-down/15 text-down" } as const;
const VERDICT = { buy: "Buy setup", watch: "Watch", avoid: "Avoid" } as const;
const STANCE = { focus: "bg-up/15 text-up", neutral: "bg-muted text-muted-foreground", avoid: "bg-down/15 text-down" } as const;
const pct = (n: number) => (Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—");

async function candlesOf(symbol: string, days: number): Promise<Candle[]> {
  const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=1d&days=${days}`);
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "no data");
  return j.candles as Candle[];
}

export function IdeasView() {
  const { stocks, loading: uniLoading } = useUniverse();
  const [cap, setCap] = useState<Cap>("large");
  const [count, setCount] = useState("60");
  const [capital, setCapital] = useState(300000);
  const [riskPct, setRiskPct] = useState(1);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; note: string } | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [bench, setBench] = useState<number | null>(null);
  const [asOf, setAsOf] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const stopRef = useRef(false);

  const pool = useMemo(() => (stocks ?? []).filter((s) => s.cap === cap).sort((a, b) => a.name.localeCompare(b.name)), [stocks, cap]);

  async function scan() {
    const picks = pool.slice(0, Number(count));
    if (!picks.length) { toast.error("No stocks loaded yet"); return; }
    stopRef.current = false;
    setRunning(true);
    setIdeas([]); setSectors([]); setOpen(null);
    const found: Idea[] = [];
    let done = 0, failed = 0;
    try {
      let benchM1 = 0;
      try {
        const nifty = await candlesOf("^NSEI", 120);
        benchM1 = nifty.length > 21 ? (nifty[nifty.length - 1].close / nifty[nifty.length - 22].close - 1) * 100 : 0;
      } catch { /* the market comparison is optional */ }
      setBench(benchM1);

      const queue = [...picks];
      const worker = async () => {
        for (let s = queue.shift(); s && !stopRef.current; s = queue.shift()) {
          setProgress({ done, total: picks.length, note: `Reading ${displaySymbol(s.symbol)}` });
          try {
            const view = assessStock(s.symbol, await candlesOf(s.symbol, 800));
            if (view) found.push({ stock: s, view });
            else failed++;
          } catch { failed++; }
          done++;
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      if (!found.length) throw new Error("No stock could be analysed. Check your connection and try again.");
      found.sort((a, b) => b.view.technical - a.view.technical);
      setIdeas([...found]);
      setSectors(rankSectors(found.map((f) => ({ sector: f.stock.sector, view: f.view })), benchM1));
      setAsOf(Date.now());

      // News and broker calls for the best candidates only, so the scan stays fast.
      const top = found.filter((f) => f.view.verdict !== "avoid").slice(0, 10);
      let n = 0;
      for (const f of top) {
        if (stopRef.current) break;
        setProgress({ done: n, total: top.length, note: `News for ${displaySymbol(f.stock.symbol)}` });
        try {
          const res = await fetch(`/api/news?name=${encodeURIComponent(f.stock.name)}&price=${Math.round(f.view.price)}`);
          const j = await res.json();
          if (res.ok) {
            f.news = { items: j.news, calls: j.calls, summary: j.summary };
            f.view = withOverlay(f.view, newsMood(j.news), j.summary);
            setIdeas([...found].sort((a, b) => b.view.score - a.view.score));
          }
        } catch { /* news is optional */ }
        n++;
      }
      toast.success(`${found.length} stocks analysed${failed ? `, ${failed} skipped` : ""}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  const buys = ideas.filter((i) => i.view.verdict === "buy" && i.view.plan);
  const focusSectors = new Set(sectors.filter((s) => s.stance === "focus").map((s) => s.sector));
  const plan = useMemo(() => {
    const picks = buys.slice(0, 6).map((i) => ({ i, size: positionSize(capital, riskPct, 25, i.view.plan!) })).filter((p) => p.size.qty > 0);
    // Keep total invested within the capital.
    const kept: typeof picks = [];
    let used = 0;
    for (const p of picks) { if (used + p.size.value <= capital) { kept.push(p); used += p.size.value; } }
    const win = kept.reduce((s, p) => s + p.size.qty * (p.i.view.plan!.target1 - p.i.view.plan!.entry), 0);
    const loss = kept.reduce((s, p) => s + p.size.risk, 0);
    return { kept, used, win, loss };
  }, [buys, capital, riskPct]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scan the market</CardTitle>
          <CardDescription>Reads daily and weekly price trends for each stock, scores them, then checks news and broker calls on the best. Scores come from fixed rules you can see below; they are not predictions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-36 space-y-1"><Label className="text-xs text-muted-foreground">Stock size</Label>
            <SimpleSelect className="w-full" value={cap} onChange={setCap} options={(["large", "mid", "small"] as Cap[]).map((c) => ({ value: c, label: CAP_LABEL[c] }))} /></div>
          <div className="w-32 space-y-1"><Label className="text-xs text-muted-foreground">How many</Label>
            <SimpleSelect className="w-full" value={count} onChange={setCount} options={[30, 60, 100].map((n) => ({ value: String(n), label: `${n} stocks` }))} /></div>
          <div className="w-40 space-y-1"><Label className="text-xs text-muted-foreground">Capital (₹)</Label><NumberField min={10000} step={50000} value={capital} onChange={setCapital} /></div>
          <div className="w-32 space-y-1"><Label className="text-xs text-muted-foreground">Risk per trade (%)</Label><NumberField min={0.25} max={5} step={0.25} value={riskPct} onChange={setRiskPct} /></div>
          <Button size="lg" onClick={scan} disabled={running || uniLoading || !pool.length}>{running ? <Loader2 className="animate-spin" /> : <Play />}{running ? "Scanning…" : "Scan now"}</Button>
          {running && <Button size="lg" variant="outline" onClick={() => { stopRef.current = true; }}>Stop</Button>}
          {progress && (
            <div className="w-full text-xs" role="status">
              <div className="mb-1 flex justify-between"><span>{progress.note}</span><span className="font-mono">{progress.done}/{progress.total}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {sectors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sectors</CardTitle>
            <CardDescription>Ranked by how many members are in uptrends, recent returns against the Nifty 50 ({bench !== null ? `${pct(bench)} over a month` : "—"}), and how many buy setups they hold. Based on the {ideas.length} stocks scanned.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1.5">Sector</th><th>Stance</th><th className="text-right">Uptrend</th><th className="text-right">1 week</th><th className="text-right">1 month</th><th className="text-right">vs Nifty</th><th className="text-right">Buy setups</th></tr></thead>
              <tbody className="divide-y">
                {sectors.map((s) => (
                  <tr key={s.sector}>
                    <td className="py-2 font-medium">{s.sector} <span className="text-xs text-muted-foreground">({s.stocks})</span></td>
                    <td><span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", STANCE[s.stance])}>{s.stance === "focus" ? "Focus" : s.stance === "avoid" ? "Avoid" : "Neutral"}</span></td>
                    <td className="tabular text-right font-mono">{s.breadth.toFixed(0)}%</td>
                    <td className={cn("tabular text-right font-mono", s.w1 >= 0 ? "text-up" : "text-down")}>{pct(s.w1)}</td>
                    <td className={cn("tabular text-right font-mono", s.m1 >= 0 ? "text-up" : "text-down")}>{pct(s.m1)}</td>
                    <td className={cn("tabular text-right font-mono", s.relM1 >= 0 ? "text-up" : "text-down")}>{pct(s.relM1)}</td>
                    <td className="tabular text-right font-mono">{s.buys}/{s.stocks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {buys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Plan for {fmtInr(capital)}</CardTitle>
            <CardDescription>Top buy setups sized so each one risks {riskPct}% of capital if its stop is hit. This is the arithmetic of the plan, not a forecast.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {plan.kept.length === 0 ? <p className="text-muted-foreground">No setup fits the capital at this risk setting.</p> : (
              <>
                <p><b>{plan.kept.length} trades</b>, {fmtInr(plan.used)} invested ({((plan.used / capital) * 100).toFixed(0)}% of capital).
                  If every first target is hit: <b className="text-up">{fmtInr(plan.win, { sign: true })} ({((plan.win / capital) * 100).toFixed(1)}%)</b>.
                  If every stop is hit: <b className="text-down">{fmtInr(-plan.loss, { sign: true })} ({((plan.loss / capital) * 100).toFixed(1)}%)</b>.</p>
                <p className="text-xs text-muted-foreground">Swing trades of 1–3 weeks free up money to reuse, so about 2–3 rounds a month are possible. A steady 10% a month is not something any rule can promise: most months some trades hit their stop. Paper trade these first and check the backtest on the Backtest page.</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {ideas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Stocks</h2>
          {asOf && <p className="text-xs text-muted-foreground">Scanned at {new Date(asOf).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} on the latest daily candles. Click a stock for the reasons, news and broker calls.</p>}
          {ideas.slice(0, 40).map((i) => {
            const v = i.view, p = v.plan;
            const size = p ? positionSize(capital, riskPct, 25, p) : null;
            const isOpen = open === i.stock.symbol;
            return (
              <Card key={i.stock.symbol} size="sm">
                <CardContent className="space-y-2">
                  <button type="button" className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-left" onClick={() => setOpen(isOpen ? null : i.stock.symbol)} aria-expanded={isOpen}>
                    <span className="min-w-28">
                      <b className="font-mono">{displaySymbol(i.stock.symbol)}</b>
                      <span className="block text-xs text-muted-foreground">{i.stock.sector}{focusSectors.has(i.stock.sector) ? " · focus sector" : ""}</span>
                    </span>
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", BADGE[v.verdict])}>{VERDICT[v.verdict]}</span>
                    <span className="tabular font-mono text-sm">{v.score}<span className="text-xs text-muted-foreground">/100</span></span>
                    <span className="font-mono text-xs" title="Daily · weekly · monthly trend">
                      {(["daily", "weekly", "monthly"] as const).map((f) => <span key={f} className={cn("mr-1.5", TONE[v.frames[f]])}>{f[0].toUpperCase()}{ARROW[v.frames[f]]}</span>)}
                    </span>
                    <span className="tabular font-mono text-sm">₹{v.price.toFixed(2)}</span>
                    {p && v.verdict !== "avoid" && <span className="tabular font-mono text-xs text-muted-foreground">R:R {p.rr1.toFixed(1)}</span>}
                    <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {p && v.verdict !== "avoid" && (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-muted/50 p-2.5 text-xs sm:grid-cols-5">
                      <span><span className="text-muted-foreground">{p.entryKind === "now" ? "Entry (near price)" : "Entry (wait for dip)"}</span><b className="block font-mono text-sm">{p.entry.toFixed(2)}</b></span>
                      <span><span className="text-muted-foreground">Stop-loss</span><b className="block font-mono text-sm text-down">{p.stop.toFixed(2)} <span className="text-xs">(−{p.riskPct.toFixed(1)}%)</span></b></span>
                      <span><span className="text-muted-foreground">Target 1</span><b className="block font-mono text-sm text-up">{p.target1.toFixed(2)} <span className="text-xs">(+{p.rewardPct1.toFixed(1)}%)</span></b></span>
                      <span><span className="text-muted-foreground">Target 2 (+12%)</span><b className="block font-mono text-sm text-up">{p.target2.toFixed(2)}</b></span>
                      <span><span className="text-muted-foreground">Size at {riskPct}% risk</span><b className="block font-mono text-sm">{size?.qty ?? 0} sh · {fmtInr(size?.value ?? 0)}</b></span>
                    </div>
                  )}
                  {isOpen && (
                    <div className="space-y-3 pt-1">
                      <ul className="space-y-1 text-sm">
                        {v.reasons.map((r) => (
                          <li key={r.text} className="flex gap-2"><span className={cn("w-8 shrink-0 text-right font-mono", r.points >= 0 ? "text-up" : "text-down")}>{r.points > 0 ? "+" : ""}{r.points}</span><span>{r.text}</span></li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground">1 week {pct(v.ret.w1)} · 1 month {pct(v.ret.m1)} · 3 months {pct(v.ret.m3)} · 6 months {pct(v.ret.m6)} · RSI {v.rsi.toFixed(0)}</p>
                      <div className="flex gap-2"><Button size="sm" nativeButton={false} render={<Link href={`/trade?symbol=${encodeURIComponent(i.stock.symbol)}`} />}>Open chart &amp; trade</Button></div>
                      <NewsPanel name={i.stock.name} price={v.price} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">For learning and paper trading. These are rule-based screens from price trends, headlines and published broker calls, not investment advice. Past patterns do not guarantee future results.</p>
    </div>
  );
}
