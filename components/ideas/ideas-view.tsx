"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { newsMood } from "@/lib/analysis/sentiment";
import { rankSectors, type SectorRow } from "@/lib/analysis/sectors";
import { assessMethod, METHODS, type Method } from "@/lib/analysis/methods";
import { fetchCandles, pool as runPool } from "@/lib/analysis/candle-cache";
import { RealityCheck } from "./reality-check";
import { interleaveMixed } from "@/lib/analysis/mixed";
import { horizonStats, type HorizonStats } from "@/lib/analysis/horizon";
import { buildMixedPortfolio } from "@/lib/analysis/portfolio-mix";
import { FRAME_LABEL, HISTORY_DAYS, applyTarget, positionSize, withOverlay, withRelativeStrength, type Frame, type StockView } from "@/lib/analysis/stock-view";
import type { AnalystCall, Consensus, NewsItem } from "@/lib/data/news";
import { fmtInr } from "@/lib/format";
import { displaySymbol } from "@/lib/symbols";
import { CAP_LABEL, type Cap, type UniverseStock } from "@/lib/universe-lists";
import { cn } from "@/lib/utils";

interface Idea { stock: UniverseStock; view: StockView; hz?: HorizonStats; news?: { items: NewsItem[]; calls: AnalystCall[]; summary: Consensus } }
const ARROW = { up: "▲", down: "▼", flat: "▬" } as const;
const TONE = { up: "text-up", down: "text-down", flat: "text-muted-foreground" } as const;
const BADGE = { buy: "bg-up/15 text-up", watch: "bg-warn/15 text-warn", avoid: "bg-down/15 text-down" } as const;
const VERDICT = { buy: "Buy setup", watch: "Watch", avoid: "Avoid" } as const;
const STANCE = { focus: "bg-up/15 text-up", neutral: "bg-muted text-muted-foreground", avoid: "bg-down/15 text-down" } as const;
const pct = (n: number) => (Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—");

const candlesOf = (symbol: string, days: number) => fetchCandles(symbol, days);

const LAST_KEY = "tb.ideas.last.v1";
interface LastScan { at: number; ideas: Idea[]; sectors: SectorRow[]; bench: number | null; days: number; target: number; method: Method; frame: Frame }
function loadLast(): LastScan | null {
  try { const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as LastScan | null; return v && Array.isArray(v.ideas) && v.ideas.length ? v : null; } catch { return null; }
}

/** Best first: buy setups before watch before avoid, then by historical expectancy over the chosen period, then by score. */
const RANK = { buy: 0, watch: 1, avoid: 2 } as const;
const byEdge = (a: Idea, b: Idea) => RANK[a.view.verdict] - RANK[b.view.verdict] || (b.hz?.expectancyPct ?? -99) - (a.hz?.expectancyPct ?? -99) || b.view.score - a.view.score;

export function IdeasView() {
  const { stocks, loading: uniLoading } = useUniverse();
  const [method, setMethod] = useState<Method>("trend");
  const [ranMethod, setRanMethod] = useState<Method>("trend");
  const [frame, setFrame] = useState<Frame>("daily");
  const [ranFrame, setRanFrame] = useState<Frame>("daily");
  const [cap, setCap] = useState<Cap | "mixed">("large");
  const [count, setCount] = useState("60");
  const [showAll, setShowAll] = useState(false);
  const [capital, setCapital] = useState(100000);
  const [days, setDays] = useState(15);
  const [target, setTarget] = useState(6);
  const [ranCfg, setRanCfg] = useState({ days: 15, target: 6 });
  const [riskPct, setRiskPct] = useState(1);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; note: string } | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [bench, setBench] = useState<number | null>(null);
  const [asOf, setAsOf] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const stopRef = useRef(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);

  // Show your last scan at once, so the page is never empty while you decide whether to scan again.
  useEffect(() => {
    const last = loadLast();
    if (!last) return;
    /* eslint-disable react-hooks/set-state-in-effect -- restore the saved scan after mount */
    setIdeas(last.ideas); setSectors(last.sectors); setBench(last.bench); setAsOf(last.at); setRestoredAt(last.at);
    setRanCfg({ days: last.days, target: last.target }); setRanMethod(last.method); setRanFrame(last.frame);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const pool = useMemo(() => {
    const all = stocks ?? [];
    if (cap !== "mixed") return all.filter((s) => s.cap === cap).sort((a, b) => a.name.localeCompare(b.name));
    // Mixed: interleave large, mid and small caps 40/35/25 so any count taken from the front holds all three sizes.
    const by = (c: Cap) => all.filter((s) => s.cap === c).sort((a, b) => a.name.localeCompare(b.name));
    return interleaveMixed(by("large"), by("mid"), by("small"));
  }, [stocks, cap]);

  async function scan() {
    const picks = Number(count) === 0 ? pool : pool.slice(0, Number(count));
    if (!picks.length) { toast.error("No stocks loaded yet"); return; }
    stopRef.current = false;
    setRunning(true);
    setIdeas([]); setSectors([]); setOpen(null);
    setRanFrame(frame);
    setRanCfg({ days, target });
    setRanMethod(method);
    const found: Idea[] = [];
    let done = 0, failed = 0;
    try {
      let benchM1 = 0;
      try {
        const nifty = await candlesOf("^NSEI", 120);
        benchM1 = nifty.length > 21 ? (nifty[nifty.length - 1].close / nifty[nifty.length - 22].close - 1) * 100 : 0;
      } catch { /* the market comparison is optional */ }
      setBench(benchM1);

      // Eight downloads at a time, and results appear while the scan is still going.
      await runPool(picks, 8, async (s) => {
        setProgress({ done, total: picks.length, note: `Reading ${displaySymbol(s.symbol)}` });
        try {
          const candles = await candlesOf(s.symbol, method === "trend" ? HISTORY_DAYS[frame] : 800);
          const base = assessMethod(s.symbol, candles, method, frame);
          if (base) {
            const view = applyTarget(base, target);
            const hz = view.plan ? horizonStats(candles, days, target, view.plan.riskPct) ?? undefined : undefined;
            found.push({ stock: s, view, hz });
          } else failed++;
        } catch { failed++; }
        done++;
        if (done % 8 === 0 || done === picks.length) {
          const snap = [...found].sort(byEdge);
          setIdeas(snap);
          setSectors(rankSectors(snap.map((f) => ({ sector: f.stock.sector, view: f.view })), benchM1));
        }
      }, () => stopRef.current);
      if (!found.length) throw new Error("No stock could be analysed. Check your connection and try again.");
      const ranked = method === "trend" ? withRelativeStrength(found.map((f) => f.view)) : found.map((f) => f.view);
      found.forEach((f, i) => { f.view = applyTarget(ranked[i], target); });
      found.sort(byEdge);
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
            f.view = applyTarget(withOverlay(f.view, newsMood(j.news), j.summary), target);
            setIdeas([...found].sort(byEdge));
          }
        } catch { /* news is optional */ }
        n++;
      }
      setRestoredAt(null);
      try {
        const keep = [...found].sort(byEdge).slice(0, 150).map((f) => ({ ...f, news: undefined }));
        localStorage.setItem(LAST_KEY, JSON.stringify({ at: Date.now(), ideas: keep, sectors: rankSectors(found.map((f) => ({ sector: f.stock.sector, view: f.view })), benchM1), bench: benchM1, days, target, method, frame } satisfies LastScan));
      } catch { /* storage full or unavailable */ }
      toast.success(`${found.length} stocks analysed${failed ? `, ${failed} skipped` : ""}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  const focusSectors = new Set(sectors.filter((s) => s.stance === "focus").map((s) => s.sector));
  // Only setups that have paid off on average over this holding period in their own history go into the portfolio.
  const mix = useMemo(() => buildMixedPortfolio(
    ideas.filter((i) => (i.hz?.expectancyPct ?? 0) > 0).map((i) => ({ symbol: i.stock.symbol, name: i.stock.name, sector: i.stock.sector, view: i.view, edge: i.hz?.expectancyPct })),
    capital, riskPct), [ideas, capital, riskPct]);
  const expectation = useMemo(() => {
    const rows = mix.picks.flatMap((p) => { const hz = ideas.find((i) => i.stock.symbol === p.symbol)?.hz; return hz ? [{ p, hz }] : []; });
    const invested = rows.reduce((s, r) => s + r.p.value, 0);
    if (!rows.length || invested <= 0) return null;
    const expected = rows.reduce((s, r) => s + (r.p.value * r.hz.expectancyPct) / 100, 0);
    const hitRate = rows.reduce((s, r) => s + r.hz.hitRate * r.p.value, 0) / invested;
    const stopRate = rows.reduce((s, r) => s + r.hz.stopRate * r.p.value, 0) / invested;
    return { invested, expected, expectedPct: (expected / capital) * 100, hitRate, stopRate, trades: rows.length };
  }, [mix, ideas, capital]);
  const focus = useMemo(() => sectors.filter((s) => s.stance === "focus").map((s) => ({
    sector: s.sector, row: s,
    picks: ideas.filter((i) => i.stock.sector === s.sector && i.view.verdict !== "avoid" && (i.hz?.expectancyPct ?? 0) > 0).slice(0, 4),
  })).filter((f) => f.picks.length > 0), [sectors, ideas]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scan the market</CardTitle>
          <CardDescription>Choose how much to invest, for how many days, and the return you want. It scans stocks, scores them, then shows how often each stock actually made that move within that time in its own past. Choose &ldquo;All&rdquo; to scan every listed large, mid and small cap (a few minutes).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-60 space-y-1"><Label className="text-xs text-muted-foreground">Method</Label>
            <SimpleSelect className="w-full" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m.id, label: m.label }))} /></div>
          <div className="w-44 space-y-1"><Label className="text-xs text-muted-foreground">Look at</Label>
            <SimpleSelect className="w-full" value={method === "trend" ? frame : "daily"} onChange={setFrame} options={[{ value: "daily", label: "Daily (1–3 weeks)" }, { value: "weekly", label: "Weekly (3–8 weeks)" }, { value: "monthly", label: "Monthly (2–6 months)" }]} /></div>
          <div className="w-52 space-y-1"><Label className="text-xs text-muted-foreground">Stock size</Label>
            <SimpleSelect className="w-full" value={cap} onChange={setCap} options={[{ value: "mixed" as const, label: "Mixed (large + mid + small)" }, ...(["large", "mid", "small"] as Cap[]).map((c) => ({ value: c, label: CAP_LABEL[c] }))]} /></div>
          <div className="w-40 space-y-1"><Label className="text-xs text-muted-foreground">How many</Label>
            <SimpleSelect className="w-full" value={count} onChange={setCount} options={[...[30, 60, 100, 250].map((n) => ({ value: String(n), label: `${n} stocks` })), { value: "0", label: `All ${pool.length || ""} stocks` }]} /></div>
          <div className="w-40 space-y-1"><Label className="text-xs text-muted-foreground">Amount to invest (₹)</Label><NumberField min={1000} step={25000} value={capital} onChange={setCapital} /></div>
          <div className="w-44 space-y-1"><Label className="text-xs text-muted-foreground">For how many days</Label>
            <div className="flex items-center gap-1.5">
              <NumberField min={2} max={365} value={days} onChange={(d) => setDays(Math.max(2, Math.round(d)))} />
              {[7, 15, 30].map((d) => <button key={d} type="button" onClick={() => { setDays(d); setTarget(d <= 7 ? 3 : d <= 15 ? 6 : 10); }} aria-pressed={days === d} className={cn("rounded-md border px-2 py-1 text-xs", days === d ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground")}>{d}d</button>)}
            </div></div>
          <div className="w-36 space-y-1"><Label className="text-xs text-muted-foreground">Return you want (%)</Label><NumberField min={0.5} max={200} step={0.5} value={target} onChange={setTarget} /></div>
          <div className="w-32 space-y-1"><Label className="text-xs text-muted-foreground">Risk per trade (%)</Label><NumberField min={0.25} max={5} step={0.25} value={riskPct} onChange={setRiskPct} /></div>
          <Button size="lg" onClick={scan} disabled={running || uniLoading || !pool.length}>{running ? <Loader2 className="animate-spin" /> : <Play />}{running ? "Scanning…" : "Scan now"}</Button>
          {running && <Button size="lg" variant="outline" onClick={() => { stopRef.current = true; }}>Stop</Button>}
          {progress && (
            <div className="w-full text-xs" role="status">
              <div className="mb-1 flex justify-between"><span>{progress.note}</span><span className="font-mono">{progress.done}/{progress.total}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            </div>
          )}
          <p className="w-full text-xs text-muted-foreground"><b>{METHODS.find((m) => m.id === method)!.label}:</b> {METHODS.find((m) => m.id === method)!.blurb} <i>({METHODS.find((m) => m.id === method)!.source})</i>{method !== "trend" && " Uses daily candles."}</p>
        </CardContent>
      </Card>

      {restoredAt && !running && (
        <p className="rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground">Showing your last scan from {new Date(restoredAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. Press Scan now to refresh prices and signals.</p>
      )}
      <RealityCheck />

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

      {mix.picks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mixed portfolio · {ranMethod === "trend" ? `${FRAME_LABEL[ranFrame].toLowerCase()} view` : METHODS.find((m) => m.id === ranMethod)!.label}</CardTitle>
            <CardDescription>The best buy setups spread over sectors: at most 2 per sector, each sized to risk {riskPct}% of {fmtInr(capital)}, 10% kept as cash.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Stock</th><th>Sector</th><th className="text-right">Buy at</th><th className="text-right">Stop</th><th className="text-right">Target 1</th><th className="text-right">Shares</th><th className="text-right">Weight</th></tr></thead>
                <tbody className="divide-y">
                  {mix.picks.map((p) => (
                    <tr key={p.symbol}>
                      <td className="py-1.5 font-mono font-semibold">{displaySymbol(p.symbol)}</td><td className="text-xs text-muted-foreground">{p.sector}</td>
                      <td className="tabular text-right font-mono">{p.view.plan!.entry.toFixed(2)}</td>
                      <td className="tabular text-right font-mono text-down">{p.view.plan!.stop.toFixed(2)}</td>
                      <td className="tabular text-right font-mono text-up">{p.view.plan!.target1.toFixed(2)}</td>
                      <td className="tabular text-right font-mono">{p.qty}</td>
                      <td className="tabular text-right font-mono">{p.weightPct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <b>{mix.picks.length} stocks in {mix.sectors.length} sectors</b>, {fmtInr(mix.invested)} invested, {fmtInr(mix.cash)} cash.
              All first targets: <b className="text-up">{fmtInr(mix.rewardIfTarget1, { sign: true })} ({((mix.rewardIfTarget1 / capital) * 100).toFixed(1)}%)</b>.
              All stops: <b className="text-down">{fmtInr(-mix.riskIfAllStopped, { sign: true })} ({((mix.riskIfAllStopped / capital) * 100).toFixed(1)}%)</b>.
            </p>
            <p className="text-xs text-muted-foreground">Sector mix: {mix.sectors.map((s) => `${s.sector} ${s.weightPct.toFixed(0)}%`).join(" · ")}. Spreading across sectors lowers the chance that one bad sector sinks the month. It does not remove risk.</p>
          </CardContent>
        </Card>
      )}

      {expectation && (
        <Card>
          <CardHeader>
            <CardTitle>What to expect: {fmtInr(capital)} for {ranCfg.days} days, aiming for {ranCfg.target}%</CardTitle>
            <CardDescription>Worked out from how the picked stocks behaved over {ranCfg.days}-day windows in their own past 3 years: reached the target, hit the stop, or ended in between. History, not a forecast.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Typical result</div><div className={cn("tabular font-mono text-lg font-semibold", expectation.expected >= 0 ? "text-up" : "text-down")}>{fmtInr(expectation.expected, { sign: true })}</div><div className="text-xs text-muted-foreground">{expectation.expectedPct >= 0 ? "+" : ""}{expectation.expectedPct.toFixed(1)}% of your amount</div></div>
              <div><div className="text-xs text-muted-foreground">Reached +{ranCfg.target}%</div><div className="tabular font-mono text-lg font-semibold">{(expectation.hitRate * 100).toFixed(0)}%</div><div className="text-xs text-muted-foreground">of past windows</div></div>
              <div><div className="text-xs text-muted-foreground">Hit the stop first</div><div className="tabular font-mono text-lg font-semibold text-down">{(expectation.stopRate * 100).toFixed(0)}%</div><div className="text-xs text-muted-foreground">of past windows</div></div>
              <div><div className="text-xs text-muted-foreground">Best / worst case</div><div className="tabular font-mono text-sm"><span className="text-up">{fmtInr(mix.rewardIfTarget1, { sign: true })}</span> / <span className="text-down">{fmtInr(-mix.riskIfAllStopped, { sign: true })}</span></div><div className="text-xs text-muted-foreground">all targets / all stops</div></div>
            </div>
            <p className="text-xs text-muted-foreground">
              {expectation.hitRate < 0.4 ? `A ${ranCfg.target}% move in ${ranCfg.days} days is a stretch: the picks reached it in under ${Math.ceil(expectation.hitRate * 10) * 10}% of past windows. A lower target or longer period gives better odds. ` : ""}
              Past windows are overlapping and one market phase (mostly a rising market) so they flatter results; real outcomes vary a lot. Each stock below shows its own numbers.
            </p>
          </CardContent>
        </Card>
      )}

      {focus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Focus: stocks in the bullish sectors</CardTitle>
            <CardDescription>For each sector marked Focus, the best setups whose past {ranCfg.days}-day windows paid off on average.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {focus.map((f) => (
              <div key={f.sector} className="space-y-1.5 rounded-lg border p-3">
                <div className="flex items-baseline justify-between"><b>{f.sector}</b><span className="text-xs text-muted-foreground">{f.row.breadth.toFixed(0)}% in uptrend · {pct(f.row.m1)} in a month</span></div>
                {f.picks.map((i) => (
                  <button key={i.stock.symbol} type="button" onClick={() => { setOpen(i.stock.symbol); setShowAll(true); document.getElementById(`idea-${i.stock.symbol}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent">
                    <span className="font-mono font-semibold">{displaySymbol(i.stock.symbol)}</span>
                    <span className="text-xs text-muted-foreground">{i.stock.cap} cap · {VERDICT[i.view.verdict]}</span>
                    <span className="tabular font-mono text-xs">{((i.hz?.hitRate ?? 0) * 100).toFixed(0)}% reached target</span>
                  </button>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {ideas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Stocks</h2>
          {asOf && <p className="text-xs text-muted-foreground">Scanned at {new Date(asOf).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} on the latest daily candles. Click a stock for the reasons, news and broker calls.</p>}
          {ideas.slice(0, showAll ? 300 : 40).map((i) => {
            const v = i.view, p = v.plan;
            const size = p ? positionSize(capital, riskPct, 25, p) : null;
            const isOpen = open === i.stock.symbol;
            return (
              <Card key={i.stock.symbol} size="sm" id={`idea-${i.stock.symbol}`}>
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
                  {i.hz && (
                    <p className="text-xs text-muted-foreground">
                      In its last 3 years, {ranCfg.days}-day windows reached <b className="text-foreground">+{ranCfg.target}%</b> {(i.hz.hitRate * 100).toFixed(0)}% of the time and hit the stop first {(i.hz.stopRate * 100).toFixed(0)}%. Average result per trade <b className={i.hz.expectancyPct >= 0 ? "text-up" : "text-down"}>{pct(i.hz.expectancyPct)}</b>
                      {Number.isFinite(i.hz.hitRateUptrend) && <> · {(i.hz.hitRateUptrend * 100).toFixed(0)}% when it started in an uptrend</>} · {i.hz.samples} windows.
                    </p>
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
          {ideas.length > 40 && !showAll && <Button variant="outline" onClick={() => setShowAll(true)}>Show all {ideas.length} stocks</Button>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">For learning and paper trading. These are rule-based screens from price trends, headlines and published broker calls, not investment advice. Past patterns do not guarantee future results.</p>
    </div>
  );
}
