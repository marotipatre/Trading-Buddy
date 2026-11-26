"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AiSentimentToggle } from "@/components/ai-sentiment";
import { fetchCandles, peekCandles, pool as runPool } from "@/lib/analysis/candle-cache";
import { deriveIdeas, type Idea } from "@/lib/analysis/ideas-engine";
import { METHODS, type Method } from "@/lib/analysis/methods";
import { buildMixedPortfolio } from "@/lib/analysis/portfolio-mix";
import { rankSectors } from "@/lib/analysis/sectors";
import type { Frame } from "@/lib/analysis/stock-view";
import { cn } from "@/lib/utils";
import { IdeaCard } from "./idea-card";
import { IdeaDrawer } from "./idea-drawer";
import { IdeaTable } from "./idea-table";
import { MarketStrip } from "./market-strip";
import { DEFAULT_PLAN, PlanBar, type PlanState } from "./plan-bar";
import { PortfolioPlan, type Expectation } from "./portfolio-plan";
import { RealityCheck } from "./reality-check";
import { SectorMap } from "./sector-map";
import { SectorOutlook } from "./sector-outlook";
import { useSectors } from "./use-sectors";
import { SECTOR_INDICES } from "@/lib/sectors/outlook";
import { daysFor, useIdeasScan } from "./use-ideas-scan";

const PLAN_KEY = "tb.ideas.plan.v2";
const PRESET_OF: Partial<Record<Method, string>> = { minervini: "minervini-template", momentum: "momentum-filter", pullback: "pullback-uptrend" };
type Tab = "stocks" | "sectors" | "portfolio" | "method";
const TABS: { id: Tab; label: string }[] = [{ id: "stocks", label: "All stocks" }, { id: "sectors", label: "Sector outlook" }, { id: "portfolio", label: "Portfolio plan" }, { id: "method", label: "How it works" }];

function ago(t: number) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
}

export function IdeasView() {
  const [plan, setPlan] = useState<PlanState>(DEFAULT_PLAN);
  const [planReady, setPlanReady] = useState(false);
  const [method, setMethod] = useState<Method>("trend");
  const [frame, setFrame] = useState<Frame>("daily");
  const [tab, setTab] = useState<Tab>("stocks");
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const scan = useIdeasScan(method, frame);
  const nse = useSectors();

  useEffect(() => {
    let saved: PlanState | null = null;
    try { saved = JSON.parse(localStorage.getItem(PLAN_KEY) ?? "null") as PlanState | null; } catch { /* ignore */ }
    /* eslint-disable react-hooks/set-state-in-effect -- load the saved plan after mount */
    if (saved && saved.amount > 0 && saved.days > 0 && saved.target > 0) setPlan({ ...DEFAULT_PLAN, ...saved });
    setPlanReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => { if (planReady) try { localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); } catch { /* ignore */ } }, [plan, planReady]);

  // The odds for the strongest stocks need their candles. After a restore they come from the browser's saved copy.
  const win = daysFor(scan.ranWith.method, scan.ranWith.frame);
  const topSymbols = useMemo(() => [...scan.bases].sort((a, b) => b.view.score - a.view.score).slice(0, 90).map((b) => b.symbol), [scan.bases]);
  useEffect(() => {
    let live = true;
    const need = topSymbols.filter((s) => !peekCandles(s, win));
    if (!need.length) return;
    void runPool(need, 6, async (s) => { try { await fetchCandles(s, win); } catch { /* skip */ } }).then(() => { if (live) setVersion((v) => v + 1); });
    return () => { live = false; };
  }, [topSymbols, win]);
  // While a scan is running, refresh the odds as candles arrive.
  useEffect(() => { if (scan.running) { const id = setInterval(() => setVersion((v) => v + 1), 2500); return () => clearInterval(id); } }, [scan.running]);

  // Each stock's sector, judged from NSE's own sector index for it: leading and improving sectors help, lagging ones hurt.
  const sectorView = useMemo(() => {
    const m: Record<string, { quadrant: "leading" | "improving" | "weakening" | "lagging"; label: string; score: number }> = {};
    for (const s of nse.data?.sectors ?? []) {
      const u = SECTOR_INDICES.find((x) => x.index === s.index)?.sector;
      if (u && (!m[u] || s.score > m[u].score)) m[u] = { quadrant: s.quadrant, label: s.label, score: s.score };
    }
    return m;
  }, [nse.data]);
  const ideas = useMemo<Idea[]>(
    () => deriveIdeas(scan.bases, { days: plan.days, target: plan.target }, (s) => peekCandles(s, win), scan.regime?.regime, scan.asOf ?? undefined, sectorView),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` stands for newly loaded candles
    [scan.bases, plan.days, plan.target, scan.regime, scan.asOf, win, version, sectorView],
  );
  const sectors = useMemo(() => rankSectors(ideas.map((i) => ({ sector: i.sector, view: i.v })), scan.bench ?? 0), [ideas, scan.bench]);
  const sectorNames = useMemo(() => [...new Set(ideas.map((i) => i.sector))].sort(), [ideas]);

  const best = useMemo(() => {
    const pool = ideas.filter((i) => i.v.verdict === "buy" && i.v.plan);
    const strong = pool.filter((i) => (i.hz?.expectancyPct ?? 0) > 0);
    const list = strong.length >= 3 ? strong : pool;
    // Volatile small caps hit targets most often in the past, but they are thinner and riskier: at most 2 of the 6, and 3 mid caps.
    const used = new Map<string, number>(), caps = { large: 0, mid: 0, small: 0, micro: 0 }, capMax = { large: 6, mid: 3, small: 2, micro: 0 } /* micro caps are shown in the table but never auto-picked: too thinly traded */, out: Idea[] = [];
    for (const i of list) {
      if ((used.get(i.sector) ?? 0) >= 2 || caps[i.cap] >= capMax[i.cap]) continue;
      used.set(i.sector, (used.get(i.sector) ?? 0) + 1); caps[i.cap]++; out.push(i);
      if (out.length >= 6) break;
    }
    return out;
  }, [ideas]);

  const riskEff = plan.risk * (scan.regime?.sizeFactor ?? 1);
  const mix = useMemo(() => {
    const avoid = new Set(sectors.filter((x) => x.stance === "avoid").map((x) => x.sector));
    const focus = new Set(sectors.filter((x) => x.stance === "focus").map((x) => x.sector));
    return buildMixedPortfolio(
      ideas.filter((i) => (i.hz?.expectancyPct ?? 0) > 0 && !avoid.has(i.sector)).map((i) => ({ symbol: i.symbol, name: i.name, sector: i.sector, cap: i.cap, view: i.v, edge: (i.hz?.expectancyPct ?? 0) + (focus.has(i.sector) ? 0.5 : 0) })),
      plan.amount, riskEff);
  }, [ideas, sectors, plan.amount, riskEff]);
  const expectation = useMemo<Expectation | null>(() => {
    const rows = mix.picks.flatMap((p) => { const hz = ideas.find((i) => i.symbol === p.symbol)?.hz; return hz ? [{ p, hz }] : []; });
    const invested = rows.reduce((s, r) => s + r.p.value, 0);
    if (!rows.length || invested <= 0) return null;
    const expected = rows.reduce((s, r) => s + (r.p.value * r.hz.expectancyPct) / 100, 0);
    return { invested, expected, expectedPct: (expected / plan.amount) * 100, hitRate: rows.reduce((s, r) => s + r.hz.hitRate * r.p.value, 0) / invested, stopRate: rows.reduce((s, r) => s + r.hz.stopRate * r.p.value, 0) / invested, trades: rows.length };
  }, [mix, ideas, plan.amount]);

  const opened = openSymbol ? ideas.find((i) => i.symbol === openSymbol) : undefined;
  const p = scan.progress;
  const firstLoad = scan.bases.length === 0 && (scan.running || !scan.universeReady);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 text-sm text-muted-foreground" role="status">
          {scan.running ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin text-primary" />{p?.phase === "news" ? "Reading headlines and broker calls…" : p ? `Scanning the market: ${p.done} of ${p.total} stocks · ${p.note}` : "Starting the scan…"}</span>
          ) : scan.asOf ? <>{scan.restored ? `Showing the strongest ${scan.bases.length} stocks from your last scan` : `Scanned ${scan.bases.length} stocks`} · updated {ago(scan.asOf)}</> : "Loading the list of listed stocks…"}
        </div>
        {scan.running ? <Button variant="outline" size="sm" onClick={scan.stop}>Stop</Button> : <Button variant="outline" size="sm" onClick={() => void scan.scan()} disabled={!scan.universeReady}><RefreshCw /> Rescan market</Button>}
      </div>
      {scan.running && p && <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full bg-primary transition-all" style={{ width: `${(p.done / Math.max(1, p.total)) * 100}%` }} /></div>}

      <PlanBar plan={plan} onPlan={setPlan} method={method} onMethod={setMethod} frame={frame} onFrame={setFrame} />
      <MarketStrip regime={scan.regime} bench={scan.bench} ideas={ideas} sectors={sectors} scanned={scan.total} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Best ideas for your plan</h2>
          <span className="text-xs text-muted-foreground">Buy setups with a positive record over {plan.days}-day windows. At most two per sector and two small caps (they move more but are thinner and riskier)</span>
        </div>
        {firstLoad ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
        ) : best.length === 0 ? (
          <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">{ideas.length ? "No stock qualifies as a buy setup for this plan right now. That is a real answer: sitting out is a position. Try a lower target or longer period, or look at the Watch list below." : "Results will appear here as the scan finds them."}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{best.map((i, k) => <IdeaCard key={i.symbol} idea={i} plan={{ days: plan.days, target: plan.target }} rank={k + 1} onOpen={() => setOpenSymbol(i.symbol)} />)}</div>
        )}
      </section>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-1 border-b" role="tablist">
          {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors", tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}{t.id === "stocks" && ideas.length ? <span className="ml-1.5 text-xs text-muted-foreground">{ideas.length}</span> : null}</button>)}
        </div>
        {tab === "stocks" && <IdeaTable ideas={ideas} sectorFilter={sectorFilter} onSector={setSectorFilter} sectors={sectorNames} onOpen={(i) => setOpenSymbol(i.symbol)} days={plan.days} target={plan.target} />}
        {tab === "sectors" && (
          <div className="space-y-8">
            <SectorOutlook data={nse.data} loading={nse.loading} error={nse.error} onShowStocks={(u) => { setSectorFilter(u); setTab("stocks"); }} />
            <div className="space-y-2"><h3 className="text-base font-semibold">Inside the sectors: what our scan of individual stocks shows</h3><SectorMap sectors={sectors} selected={sectorFilter} onSelect={(s) => { setSectorFilter(s); if (s) setTab("stocks"); }} /></div>
          </div>
        )}
        {tab === "portfolio" && <PortfolioPlan mix={mix} expectation={expectation} ideas={ideas} plan={{ days: plan.days, target: plan.target }} amount={plan.amount} riskNote={scan.regime && scan.regime.sizeFactor < 1 ? `Position sizes use ${Math.round(scan.regime.sizeFactor * 100)}% of your normal risk because the market is ${scan.regime.label.toLowerCase()}.` : undefined} onOpen={(i) => setOpenSymbol(i.symbol)} />}
        {tab === "method" && (
          <div className="space-y-4">
            <AiSentimentToggle />
            <div className="rounded-xl border bg-card p-4 text-sm"><b>How a stock is judged:</b> {METHODS.find((m) => m.id === method)!.blurb} <i className="text-muted-foreground">({METHODS.find((m) => m.id === method)!.source})</i>
              {METHODS.find((m) => m.id === method)?.evidence && <p className="mt-2 rounded bg-muted/60 p-2 text-xs"><b>Backtest evidence:</b> {METHODS.find((m) => m.id === method)!.evidence}</p>}
              {PRESET_OF[method] && <p className="mt-2 text-xs"><Link className="underline" href={`/strategies?preset=${PRESET_OF[method]}&mode=group`}>Backtest this method on a group of stocks</Link></p>}
            </div>
            <RealityCheck />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">For learning and paper trading. Rule-based screens from price trends, headlines and published broker calls, not investment advice. Past patterns do not guarantee future results.</p>
      {opened && <IdeaDrawer idea={opened} plan={{ days: plan.days, target: plan.target }} amount={plan.amount} risk={riskEff} onClose={() => setOpenSymbol(null)} />}
    </div>
  );
}
