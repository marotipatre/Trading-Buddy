"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/backtest/number-field";
import { useNow } from "@/components/use-now";
import { useUniverse } from "@/components/use-universe";
import { fetchCandles, pool as runPool } from "@/lib/analysis/candle-cache";
import { moodOf } from "@/lib/analysis/mood";
import { ExplainButton } from "@/components/coach/explain-button";
import { AiSentimentToggle } from "@/components/ai-sentiment";
import { pnlByDay } from "@/lib/intraday/account";
import { marketRegime, type MarketRegime } from "@/lib/analysis/regime";
import { INTRADAY } from "@/lib/playbook/content";
import { dayStatus, DEFAULT_LIMITS, type Limits } from "@/lib/intraday/limits";
import { cleanShare, MISTAKE_TAGS, mistakeCounts, pickDateOf, userNote, withUserNote } from "@/lib/intraday/journal";
import { loadBatches, saveBatch, type PickBatch } from "@/lib/intraday/log";
import { intradaySize, scoreIntraday, topPicks, type IntradayPick } from "@/lib/intraday/picks";
import { evaluatePick, summarize, type PickResult } from "@/lib/intraday/scorecard";
import { fmtInr, fmtPct } from "@/lib/format";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import { downloadText, tradesToCsv } from "@/lib/export-csv";
import { GraduationCard } from "@/components/graduation-card";
import { WeeklyReviewCard } from "@/components/weekly-review-card";
import { AccountEquityChart } from "@/components/paper/account-equity-chart";
import { capitalOf } from "@/lib/paper/funds";
import { IntradayProvider, useIntraday } from "./intraday-provider";
import { AnimatePresence, motion } from "motion/react";
import { Collapse, Money, PillTabs, SPRING, Stagger, StaggerItem, Swap } from "@/components/motion/primitives";
import { Info } from "@/components/ui/info";
import { backtestPicks, type PickBacktest } from "@/lib/intraday/pick-backtest";
import { useLivePicks } from "./use-live-picks";
import { CALL_LABEL, CALL_TONE } from "@/lib/intraday/live";

const istToday = () => new Date(Date.now() + 19800_000).toISOString().slice(0, 10);
const OUTCOME = { target: "Target hit", stop: "Stopped out", eod: "Closed at 3:15", "no-entry": "Never triggered", "skipped-gap": "Skipped (gap)" } as const;

export function IntradayView() {
  return <IntradayProvider><Inner /></IntradayProvider>;
}

function Inner() {
  const [deskTab, setDeskTab] = useState<Tab>("today");
  const { acc, ready, view, create, topUp, reset, localOnly } = useIntraday();
  const [potInput, setPotInput] = useState(100000);
  const [add, setAdd] = useState(25000);
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  const [pledgeDate, setPledgeDate] = useState<string | null>(null);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("tb.intraday.pledge"); } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved pledge date after mount
    setPledgeDate(saved);
  }, []);
  const now = useNow();
  if (!ready) return null;
  if (!acc || !view) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">Set up your intraday pot<Info title="Set up your intraday pot"><p>A separate paper account for day trading. Put in the money you would risk, and you can trade five times that with margin. Its profit and loss are tracked on their own, never mixed with your main paper account. Everything closes by 3:15 pm.</p></Info></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-48 space-y-1"><Label className="text-xs text-muted-foreground">Your money in the pot (₹)</Label><NumberField min={1000} step={10000} value={potInput} onChange={setPotInput} /></div>
          <p className="text-sm text-muted-foreground">Buying power: <b className="text-foreground">{fmtInr(potInput * 5)}</b></p>
          <Button onClick={() => create(potInput)} disabled={potInput < 1000}>Create pot</Button>
        </CardContent>
      </Card>
    );
  }
  const days = pnlByDay(acc.state);
  const status = dayStatus(acc.state, acc.pot, now, limits);
  const dateKey = new Date((now + 19800) * 1000).toISOString().slice(0, 10);
  const pledged = pledgeDate === dateKey;
  const lockReason = status.reason ?? (pledged ? null : "Read and tick today's pledge below to switch on orders.");
  const today = days.find((d) => d.date === new Date((now + 19800) * 1000).toISOString().slice(0, 10));
  const todayPnl = today?.pnl ?? 0;
  const lossBudget = (acc.pot * limits.maxLossPct) / 100;
  const lossUsed = Math.max(0, -status.pnlToday);
  return (
    <div className="tone space-y-6" style={{ "--h": 264 } as React.CSSProperties}>
      <DeskHero todayPnl={todayPnl} trades={today?.trades ?? 0} potValue={view.value} totalPnl={view.pnl} buyingPower={view.buyingPower} leverage={acc.leverage}
        lossUsed={lossUsed} lossBudget={lossBudget} tradesUsed={status.tradesToday} maxTrades={limits.maxTrades} streak={status.lossStreak} maxStreak={limits.maxLossStreak}
        locked={status.locked} reason={status.reason} pledged={pledged} onPledge={() => setDeskTab("today")} />
      {localOnly && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">Your intraday account is saved only in this browser. Run <code>supabase/migrations/0004_intraday_account.sql</code> in the Supabase SQL editor to back it up and keep it across devices.</p>
      )}
      <PillTabs value={deskTab} onChange={setDeskTab} ariaLabel="Intraday desk sections" options={[
        { value: "today", label: "Today" }, { value: "journal", label: "Journal" }, { value: "proof", label: "Do the picks work?" }, { value: "setup", label: "Pot and limits" },
      ]} />
      <Swap id={deskTab} className="space-y-6">
        {deskTab === "today" && (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6"><Picks lock={lockReason} /></div>
            <div className="min-w-0 space-y-6">
          {!status.locked && !pledged && (
            <Card className="border-primary/40">
              <CardHeader><CardTitle className="flex items-center gap-1.5">Today&apos;s pledge<Info title="Today&apos;s pledge"><p>Orders stay off until you tick this, once each day.</p></Info></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <details className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">Read the {INTRADAY.constitution.length} rules</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">{INTRADAY.constitution.map((c) => <li key={c}>{c}</li>)}</ol>
                </details>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm font-medium">
                  <input type="checkbox" className="mt-1" onChange={(e) => { if (e.target.checked) { try { localStorage.setItem("tb.intraday.pledge", dateKey); } catch { /* ignore */ } setPledgeDate(dateKey); } }} />
                  <span>I have read today&apos;s limits and the pledge, and I will trade only the plan.</span>
                </label>
              </CardContent>
            </Card>
          )}
              <Open />
            </div>
          </div>
        )}
        {deskTab === "journal" && (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6"><Results /></div>
            <div className="min-w-0 space-y-6">
              <EquityCard />
              <WeeklyReviewCard trades={acc.state.trades} title="Intraday" />
            </div>
          </div>
        )}
        {deskTab === "proof" && (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <div className="min-w-0 space-y-6"><Scorecard /><GraduationCard trades={acc.state.trades} book="intraday" /></div>
            <div className="min-w-0 space-y-6"><PickBacktestCard /></div>
          </div>
        )}
        {deskTab === "setup" && (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <div className="min-w-0 space-y-6">
      <Card className={status.locked ? "border-down/50" : undefined}>
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="font-medium">Today&apos;s limits</span>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Max loss %<NumberField className="h-8 w-16" min={0.5} max={5} step={0.5} value={limits.maxLossPct} onChange={(v) => setLimits({ ...limits, maxLossPct: v })} /></label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Max trades<NumberField className="h-8 w-16" min={1} max={10} value={limits.maxTrades} onChange={(v) => setLimits({ ...limits, maxTrades: Math.round(v) })} /></label>
          <span className="font-mono text-xs text-muted-foreground">{status.tradesToday} trades · {fmtInr(status.pnlToday, { sign: true })} · {status.lossStreak} losses in a row</span>
          {status.locked ? <span className="w-full font-medium text-down">{status.reason} New orders are switched off. <Link className="underline" href="/playbook?book=intraday">Read the rule book</Link>.</span> : <span className="text-xs text-up">Within limits</span>}
        </CardContent>
      </Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-1.5">Your pot<Info title="Your pot"><p>Add money or start again. Changes here never touch your main paper account.</p></Info></CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <div className="w-36"><NumberField min={1000} step={5000} value={add} onChange={setAdd} /></div>
                <Button variant="outline" size="sm" onClick={() => { const r = topUp(add); if (r.error) toast.error(r.error); else toast.success(`Added ${fmtInr(add)} to the pot`); }}>Add to pot</Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { if (confirm("Erase the intraday account, its trades and P&L, and start again?")) reset(); }}>Reset…</Button>
                {view.broke && <span className="text-sm text-down">Your pot is used up.</span>}
              </CardContent>
            </Card>
          </div>
        )}
      </Swap>
    </div>
  );
}

type Tab = "today" | "journal" | "proof" | "setup";

function Meter({ label, used, max, text, danger }: { label: string; used: number; max: number; text: string; danger?: boolean }) {
  const p = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-white/70"><span>{label}</span><span className="figure text-white">{text}</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15"><motion.div className={cn("h-full rounded-full", danger || p >= 100 ? "bg-rose-400" : p >= 70 ? "bg-amber-300" : "bg-sky-300")} initial={false} animate={{ width: `${p}%` }} transition={SPRING} /></div>
    </div>
  );
}

/** The desk's top band: today's result in large type, and how much of each daily limit has been used. */
function DeskHero(p: { todayPnl: number; trades: number; potValue: number; totalPnl: number; buyingPower: number; leverage: number; lossUsed: number; lossBudget: number; tradesUsed: number; maxTrades: number; streak: number; maxStreak: number; locked: boolean; reason?: string; pledged: boolean; onPledge: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[oklch(0.2_0.05_264)] p-6 text-white sm:p-8" aria-label="Today at the desk">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[oklch(0.55_0.2_264)] opacity-30 blur-3xl" aria-hidden />
      <div className="relative grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="text-sm text-white/70">Today&apos;s result</div>
          <Money value={p.todayPnl} sign className={cn("figure block text-5xl leading-none sm:text-6xl", p.todayPnl > 0 ? "text-emerald-300" : p.todayPnl < 0 ? "text-rose-300" : "text-white")} />
          <div className="mt-2 text-sm text-white/70">{p.trades} trade{p.trades === 1 ? "" : "s"} closed today</div>
          <dl className="mt-6 grid grid-cols-3 gap-4 text-sm">
            <div><dt className="text-white/60">Pot value</dt><dd className="figure text-lg"><Money value={p.potValue} /></dd></div>
            <div><dt className="text-white/60">All-time</dt><dd className={cn("figure text-lg", p.totalPnl >= 0 ? "text-emerald-300" : "text-rose-300")}><Money value={p.totalPnl} sign /></dd></div>
            <div><dt className="text-white/60">Buying power ({p.leverage}x)</dt><dd className="figure text-lg"><Money value={p.buyingPower} /></dd></div>
          </dl>
        </div>
        <div className="space-y-4 self-end">
          <Meter label="Daily loss used" used={p.lossUsed} max={p.lossBudget} text={`${fmtInr(p.lossUsed)} of ${fmtInr(p.lossBudget)}`} />
          <Meter label="Trades taken" used={p.tradesUsed} max={p.maxTrades} text={`${p.tradesUsed} of ${p.maxTrades}`} />
          <Meter label="Losses in a row" used={p.streak} max={p.maxStreak} text={`${p.streak} of ${p.maxStreak}`} />
          <AnimatePresence initial={false} mode="wait">
            {p.locked ? (
              <motion.p key="locked" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-rose-500/20 px-3 py-2 text-sm text-rose-100">{p.reason} New orders are off for today.</motion.p>
            ) : !p.pledged ? (
              <motion.button key="pledge" type="button" onClick={p.onPledge} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full rounded-xl bg-white/12 px-3 py-2 text-left text-sm hover:bg-white/20">Orders are off until you take today&apos;s pledge. Open it.</motion.button>
            ) : (
              <motion.p key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-emerald-400/15 px-3 py-2 text-sm text-emerald-100">Pledge taken. Trade the plan.</motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}


function Picks({ lock }: { lock: string | null }) {
  const { acc, place } = useIntraday();
  const { stocks } = useUniverse();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [batch, setBatch] = useState<PickBatch | null>(() => (typeof window === "undefined" ? null : loadBatches().at(-1) ?? null));
  const [riskPct, setRiskPct] = useState(1);
  const [settings, setSettings] = useState(false);
  const [regime, setRegime] = useState<MarketRegime | null>(null);
  const stopRef = useRef(false);
  const live = useLivePicks(batch?.picks, batch?.forDate);

  const generate = useCallback(async () => {
    const universe = [...(stocks ?? [])].sort((a, b) => (a.cap === "large" ? 0 : a.cap === "mid" ? 1 : 2) - (b.cap === "large" ? 0 : b.cap === "mid" ? 1 : 2)); // the whole market, most liquid first
    if (!universe.length) { toast.error("Stock list is still loading"); return; }
    stopRef.current = false;
    setRunning(true);
    const found: IntradayPick[] = [];
    let done = 0;
    let reg: MarketRegime | null = null;
    try {
      try { reg = marketRegime(await fetchCandles("^NSEI", 500)); setRegime(reg); } catch { /* the market check is optional */ }
      await runPool(universe, 8, async (s) => {
        try { const p = scoreIntraday(s.symbol, s.name, s.sector, await fetchCandles(s.symbol, 400), 0, Math.floor(Date.now() / 1000)); if (p) found.push(p); } catch { /* skip */ }
        done++;
        if (done % 10 === 0) setProgress({ done, total: universe.length });
      }, () => stopRef.current);
      // Headlines for the strongest candidates, then re-score with the tone.
      const shortlist = topPicks(found, 12, 4);
      const rescored: IntradayPick[] = [];
      for (const p of shortlist) {
        let mood = 0;
        try {
          const j = await (await fetch(`/api/news?name=${encodeURIComponent(p.name)}`)).json();
          if (j.news) mood = (await moodOf(j.news)).score;
        } catch { /* headlines are optional */ }
        const c = await fetchCandles(p.symbol, 400);
        const again = scoreIntraday(p.symbol, p.name, p.sector, c, mood, Math.floor(Date.now() / 1000));
        if (again) rescored.push(again);
      }
      const picks = topPicks(rescored, reg?.regime === "bear" ? 3 : 5, 2);
      if (!picks.length) { toast.info("No stock qualified today. Sitting out is a valid trade."); setBatch(null); return; }
      const b: PickBatch = { forDate: picks[0].forDate, createdAt: Date.now(), picks };
      saveBatch(b);
      setBatch(b);
      toast.success(`${picks.length} picks for ${b.forDate}`);
    } finally { setRunning(false); setProgress(null); }
  }, [stocks]);

  // Open the page and the picks are there: use the saved ones, and refresh in the background if they are old or missing.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !stocks?.length) return;
    autoRan.current = true;
    const age = batch ? Date.now() - batch.createdAt : Infinity;
    if (age > 6 * 3600_000) setTimeout(() => void generate(), 0);
  }, [stocks, batch, generate]);

  const pot = acc?.pot ?? 0;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">Next session picks
          <Info title="How the picks are chosen">
            <p>Liquid stocks in uptrends that closed strong on rising volume, with headline tone checked. Each has a buy-stop entry, a stop-loss and targets.</p>
            <p>Scan after the close, trade the next morning. If nothing qualifies, sitting out is a valid trade.</p>
          </Info>
        </h2>
        {batch && <span className="text-sm text-muted-foreground">for {batch.forDate}</span>}
        <div className="ml-auto flex items-center gap-2">
          {progress && <span className="figure text-xs text-muted-foreground">{progress.done} of {progress.total}</span>}
          {running && <Button variant="outline" size="sm" onClick={() => { stopRef.current = true; }}>Stop</Button>}
          <Button size="sm" onClick={generate} disabled={running}>{running ? <Loader2 className="animate-spin" /> : <RefreshCw />}{running ? "Scanning" : batch ? "Refresh" : "Find picks"}</Button>
          <button type="button" aria-label="Pick settings" aria-expanded={settings} onClick={() => setSettings((x) => !x)} className="grid size-8 place-items-center rounded-lg border bg-card text-muted-foreground hover:text-foreground"><SlidersHorizontal className="size-4" /></button>
        </div>
      </div>
      <Collapse open={settings}>
        <div className="flex flex-wrap items-end gap-4 rounded-2xl border bg-card p-3.5">
          <div className="w-40 space-y-1"><Label className="text-xs text-muted-foreground">Risk per trade (% of pot)</Label><NumberField min={0.25} max={3} step={0.25} value={riskPct} onChange={setRiskPct} /></div>
          <AiSentimentToggle />
        </div>
      </Collapse>
      {regime && (
        <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm", "bg-muted text-foreground")}>
          <span className="font-medium">Market: {regime.label.toLowerCase()}</span>
          {regime.sizeFactor < 1 && <span className="text-xs opacity-80">sizes use {Math.round(regime.sizeFactor * 100)}% of normal risk</span>}
          <Info title="Market condition" className="ml-auto" align="end"><p>{regime.advice}</p></Info>
        </div>
      )}
      {batch && (
        <Stagger className="grid gap-4 md:grid-cols-2">
          {batch.picks.map((p) => {
            const ls = live.status[p.symbol];
            const size = intradaySize(pot, acc?.leverage ?? 5, riskPct * (regime?.sizeFactor ?? 1), 5, p.plan);
            const tone = ls ? CALL_TONE[ls.call] : null;
            return (
              <StaggerItem key={p.symbol} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--tone-soft)] font-heading text-sm font-semibold text-[var(--tone)]">{p.score}</span>
                  <div className="min-w-0">
                    <div className="font-heading text-lg font-semibold leading-tight">{displaySymbol(p.symbol)}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.sector}</div>
                  </div>
                  {ls && <span title={ls.say} className={cn("ml-auto rounded-full px-2.5 py-1 text-xs font-semibold", tone === "up" ? "bg-up/15 text-up" : tone === "down" ? "bg-down/15 text-down" : "bg-muted text-muted-foreground")}>{CALL_LABEL[ls.call]}</span>}
                </div>
                <div className="grid grid-cols-4 gap-px overflow-hidden rounded-xl border bg-border text-center text-xs">
                  {([["Stop", p.plan.stop, "text-down"], ["Buy above", p.plan.entry, ""], ["Target 1", p.plan.target1, "text-up"], ["Target 2", p.plan.target2, "text-up"]] as const).map(([l, v, c]) => (
                    <div key={l} className="bg-muted/40 px-1 py-2"><div className="text-muted-foreground">{l}</div><div className={cn("figure text-[15px]", c)}>{v.toFixed(2)}</div></div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{size.qty} shares · <span className="text-foreground">{fmtInr(size.notional)}</span></span>
                  <span className="text-muted-foreground">risk <span className="text-down">{fmtInr(size.riskAmt)}</span> → <span className="text-up">{fmtInr(size.rewardAmt)}</span></span>
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <Button className="flex-1" disabled={size.qty < 1 || !!lock} title={lock ?? undefined} onClick={async () => {
                    const r = await place({ symbol: p.symbol, side: "buy", qty: size.qty, type: "stop", triggerPrice: p.plan.entry, validity: "day", stop: p.plan.stop, target: p.plan.target1, note: `pick:${p.forDate}` });
                    if (r.error) toast.error(r.error); else toast.success(`Order placed: buys ${size.qty} ${displaySymbol(p.symbol)} if it trades up to ${p.plan.entry.toFixed(2)}`);
                  }}>Place order</Button>
                  <Info label="Why this pick" title={`${displaySymbol(p.symbol)}: why and when to skip`} align="end">
                    <ul className="list-disc space-y-1 pl-4">{p.reasons.slice(0, 5).map((r) => <li key={r}>{r}</li>)}</ul>
                    <p><b>Skip it if</b> it opens above {(p.plan.entry * 1.01).toFixed(2)} or below {p.plan.stop.toFixed(2)}. Exit by 3:15 pm if neither level is hit.</p>
                    <p>Risk {p.plan.riskPct.toFixed(2)}% to the stop, reward 1.5R to target 1. The order is a buy-stop with the stop-loss and target 1 attached. It uses {fmtInr(size.margin)} of your own money.</p>
                    {ls && <p><b>Live:</b> {ls.say} Price {ls.price.toFixed(2)}{ls.vwap ? `, VWAP ${ls.vwap.toFixed(2)}` : ""}{ls.orHigh ? `, first 15 minutes ${ls.orLow!.toFixed(2)} to ${ls.orHigh.toFixed(2)}` : ""}.</p>}
                  </Info>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </section>
  );
}

function Open() {
  const { acc, quotes, closeNow, cancel } = useIntraday();
  if (!acc || (!acc.state.positions.length && !acc.state.orders.length)) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Open positions and orders</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {acc.state.positions.map((p) => {
          const ltp = quotes[p.symbol]?.price ?? p.entryPrice;
          const pnl = (ltp - p.entryPrice) * p.qty * (p.direction === "long" ? 1 : -1);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <b className="min-w-24 font-mono">{displaySymbol(p.symbol)}</b>
              <span className="font-mono">{p.qty} @ {p.entryPrice.toFixed(2)} → {ltp.toFixed(2)}</span>
              <span className={cn("tabular font-mono", pnl >= 0 ? "text-up" : "text-down")}>{fmtInr(pnl, { sign: true })}</span>
              <span className="text-xs text-muted-foreground">SL {p.stop?.toFixed(2) ?? "—"} · TP {p.target?.toFixed(2) ?? "—"}</span>
              <Button size="xs" variant="outline" className="ml-auto" onClick={async () => { const r = await closeNow(p.id); if (r.error) toast.error(r.error); }}>Exit now</Button>
            </div>
          );
        })}
        {acc.state.orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
            <b className="min-w-24 font-mono text-foreground">{displaySymbol(o.symbol)}</b>
            <span>{o.side} {o.qty} when price reaches {o.limitPrice.toFixed(2)}</span>
            <Button size="xs" variant="ghost" className="ml-auto" onClick={() => cancel(o.id)}>Cancel</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EquityCard() {
  const { acc } = useIntraday();
  const h = acc?.state.equityHistory ?? [];
  if (!acc || h.length < 2) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-1.5">Profit and loss over time<Info title="Profit and loss over time"><p>Your intraday pot&apos;s result, in rupees, on its own.</p></Info></CardTitle></CardHeader>
      <CardContent><AccountEquityChart history={h} initial={capitalOf(acc.state)} /></CardContent>
    </Card>
  );
}

function Results() {
  const { acc, annotate } = useIntraday();
  const now = useNow(60_000);
  const [vs, setVs] = useState<Record<number, PickResult | null>>({});
  const [busy, setBusy] = useState(false);
  const days = useMemo(() => (acc ? pnlByDay(acc.state) : []), [acc]);
  if (!acc || !days.length) return null;
  const all = acc.state.trades;
  const trades = [...all].sort((a, b) => b.exitTime - a.exitTime).slice(0, 30);
  const total = all.length, wins = all.filter((t) => t.netPnl > 0).length;
  const monthAgo = now - 30 * 86400;
  const breaks = mistakeCounts(all, monthAgo);
  const clean = cleanShare(all.filter((t) => t.exitTime >= monthAgo));
  const fromPicks = all.filter((t) => pickDateOf(t));

  async function compare() {
    setBusy(true);
    try {
      const next: Record<number, PickResult | null> = {};
      for (const t of fromPicks) {
        const d = pickDateOf(t)!;
        const pick = loadBatches().find((b) => b.forDate === d)?.picks.find((p) => p.symbol === t.symbol);
        if (!pick) { next[t.id] = null; continue; }
        try { next[t.id] = evaluatePick(pick, await fetchCandles(t.symbol, 40, "5m")); } catch { next[t.id] = null; }
      }
      setVs(next);
    } finally { setBusy(false); }
  }
  const yourR = fromPicks.reduce((s, t) => s + (t.rMultiple ?? 0), 0);
  const pickR = fromPicks.reduce((s, t) => s + (vs[t.id]?.r ?? 0), 0);
  const compared = fromPicks.filter((t) => vs[t.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">Your results<Info title="Your results"><p>{total} trades, {total ? ((wins / total) * 100).toFixed(0) : 0}% winners. Charges and slippage are included. Tag mistakes honestly: the count shows which rule you break most.</p></Info></CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-6 lg:grid-cols-2">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Day</th><th className="text-right">Trades</th><th className="text-right">Wins</th><th className="text-right">P&amp;L</th></tr></thead>
            <tbody className="divide-y">{days.slice(0, 15).map((d) => <tr key={d.date}><td className="py-1">{d.date}</td><td className="tabular text-right font-mono">{d.trades}</td><td className="tabular text-right font-mono">{d.wins}</td><td className={cn("tabular text-right font-mono", d.pnl >= 0 ? "text-up" : "text-down")}>{fmtInr(d.pnl, { sign: true })}</td></tr>)}</tbody>
          </table>
          <div className="space-y-2 text-sm">
            <div className="font-medium">Rule breaks in the last 30 days</div>
            {breaks.length === 0 ? <p className="text-muted-foreground">None tagged. Tag a trade below if you broke a rule.</p> : (
              <ul className="space-y-1">{breaks.map((b) => <li key={b.tag} className="flex justify-between"><span>{b.tag}</span><span className="font-mono">{b.count}</span></li>)}</ul>
            )}
            <p className="text-xs text-muted-foreground">Clean trades: <b className="text-foreground">{(clean * 100).toFixed(0)}%</b> (goal 95% or more).{" "}
              <Link className="underline" href="/playbook?book=intraday">Rule book</Link></p>
          </div>
        </div>

        <Button size="sm" variant="outline" className="mr-2" onClick={() => downloadText("intraday-trades.csv", tradesToCsv(acc.state.trades))}>Download trades (CSV)</Button>
        <ExplainButton kind="intraday" label="Explain my results in plain words" data={{ trades: total, winnersPct: total ? Math.round((wins / total) * 100) : 0, days: days.slice(0, 10).map((d) => ({ date: d.date, trades: d.trades, wins: d.wins, pnlInr: Math.round(d.pnl) })), ruleBreaksLast30Days: breaks, cleanTradesPct: Math.round(clean * 100) }} />
        {fromPicks.length > 0 && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-3">
              <b className="text-sm">Picks you took vs what the pick would have done</b>
              <Button size="sm" variant="outline" onClick={compare} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Compare</Button>
            </div>
            {compared.length > 0 ? (
              <p className="text-sm">On {compared.length} traded pick{compared.length > 1 ? "s" : ""}, you made <b className={yourR >= 0 ? "text-up" : "text-down"}>{yourR >= 0 ? "+" : ""}{yourR.toFixed(2)}R</b> and following the pick exactly would have made <b className={pickR >= 0 ? "text-up" : "text-down"}>{pickR >= 0 ? "+" : ""}{pickR.toFixed(2)}R</b>. {pickR - yourR > 0.5 ? "The gap is your execution: check your tags." : yourR - pickR > 0.5 ? "You beat the pick, perhaps with better exits." : "Close to the pick."}</p>
            ) : <p className="text-xs text-muted-foreground">{fromPicks.length} trade{fromPicks.length > 1 ? "s" : ""} came from picks. Press Compare once those sessions have finished.</p>}
          </div>
        )}

        <div className="divide-y">
          {trades.map((t) => {
            const d = pickDateOf(t);
            const r = vs[t.id];
            return (
              <div key={t.id} className="space-y-1.5 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <b className="min-w-20 font-mono">{displaySymbol(t.symbol)}</b>
                  {d && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">pick {d}</span>}
                  <span className="text-xs text-muted-foreground">{t.reason === "target" ? "Target" : t.reason === "stop" ? "Stop" : t.reason === "squareoff" ? "3:15 close" : "Exited"}</span>
                  <span className={cn("tabular font-mono", t.netPnl >= 0 ? "text-up" : "text-down")}>{fmtInr(t.netPnl, { sign: true })}</span>
                  {t.rMultiple !== undefined && Number.isFinite(t.rMultiple) && <span className="tabular font-mono text-xs text-muted-foreground">{t.rMultiple >= 0 ? "+" : ""}{t.rMultiple.toFixed(2)}R</span>}
                  {r && <span className="text-xs text-muted-foreground">pick: {OUTCOME[r.outcome]}{r.r ? ` ${r.r > 0 ? "+" : ""}${r.r.toFixed(2)}R` : ""}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {MISTAKE_TAGS.map((tag) => {
                    const on = (t.tags ?? []).includes(tag);
                    return <button key={tag} type="button" aria-pressed={on} onClick={() => annotate(t.id, { tags: on ? (t.tags ?? []).filter((x) => x !== tag) : [...(t.tags ?? []), tag] })}
                      className={cn("rounded-md border px-1.5 py-0.5 text-[11px]", on ? "border-down/50 bg-down/10 text-down" : "text-muted-foreground hover:text-foreground")}>{tag}</button>;
                  })}
                </div>
                <input defaultValue={userNote(t)} placeholder="Note: why you took it, what you would change" onBlur={(e) => { if (e.target.value !== userNote(t)) annotate(t.id, { note: withUserNote(t, e.target.value) }); }}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs" aria-label="Trade note" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Scorecard() {
  const [rows, setRows] = useState<{ date: string; symbol: string; res: PickResult }[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      const today = istToday();
      const out: { date: string; symbol: string; res: PickResult }[] = [];
      for (const b of loadBatches().filter((x) => x.forDate < today || x.forDate === today)) {
        for (const p of b.picks) {
          try {
            const bars = await fetchCandles(p.symbol, 40, "5m");
            const res = evaluatePick(p, bars);
            if (res) out.push({ date: b.forDate, symbol: p.symbol, res });
          } catch { /* no intraday data for this one */ }
        }
      }
      setRows(out.sort((a, b) => b.date.localeCompare(a.date)));
    } finally { setBusy(false); }
  }
  const s = rows ? summarize(rows.map((r) => r.res)) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">Are the suggestions working?<Info title="Are the suggestions working?"><p>Replays every saved pick on that day&apos;s 5-minute candles as if you had followed it exactly (entry, stop, first target, out by 3:15; stop assumed first when a candle touches both). Independent of what you actually traded. Needs a few weeks of picks to mean anything; free intraday history reaches back about 40 days.</p></Info></CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" onClick={check} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Check past picks</Button>
        {s && rows && (rows.length === 0 ? <p className="text-sm text-muted-foreground">No saved picks have a finished session yet. Come back after a trading day.</p> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Picks followed" value={`${s.taken} of ${s.evaluated}`} sub={`${s.skipped} never triggered or skipped`} />
              <Stat label="Winners" value={`${(s.winRate * 100).toFixed(0)}%`} sub={`${s.wins} won, ${s.losses} lost`} />
              <Stat label="Total result" value={`${s.totalR >= 0 ? "+" : ""}${s.totalR.toFixed(1)}R`} sub={`${s.avgR >= 0 ? "+" : ""}${s.avgR.toFixed(2)}R per trade`} tone={s.totalR >= 0 ? "up" : "down"} />
              <Stat label="Average move" value={fmtPct(s.avgPnlPct, 2, { sign: true })} sub="before charges" tone={s.avgPnlPct >= 0 ? "up" : "down"} />
            </div>
            <p className="text-xs text-muted-foreground">{s.taken < 30 ? `Only ${s.taken} trades so far: too few to tell skill from luck. Judge after 30 or more. ` : ""}1R is the amount risked on a trade. Intraday charges can eat most of a small edge.</p>
            <table className="w-full text-sm">
              <tbody className="divide-y">{rows.slice(0, 40).map((r) => <tr key={r.date + r.symbol}><td className="py-1 text-xs text-muted-foreground">{r.date}</td><td className="font-mono">{displaySymbol(r.symbol)}</td><td className="text-xs">{OUTCOME[r.res.outcome]}</td><td className={cn("tabular text-right font-mono", r.res.r > 0 ? "text-up" : r.res.r < 0 ? "text-down" : "")}>{r.res.r === 0 ? "—" : `${r.res.r > 0 ? "+" : ""}${r.res.r.toFixed(2)}R`}</td></tr>)}</tbody>
            </table>
          </>
        ))}
      </CardContent>
    </Card>
  );
}

/** Replays the pick rules over the past ~40 sessions on 30 liquid stocks, so you can see whether the picks would have worked before you trust them. */
function PickBacktestCard() {
  const { stocks } = useUniverse();
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [r, setR] = useState<PickBacktest | null>(null);
  const [rc, setRc] = useState<PickBacktest | null>(null);
  async function run() {
    const list = (stocks ?? []).filter((x) => x.cap === "large").slice(0, 30);
    if (!list.length) { toast.error("Stock list is still loading"); return; }
    setBusy(true); setProg(0);
    try {
      const inputs: { symbol: string; name: string; sector: string; daily: Awaited<ReturnType<typeof fetchCandles>>; bars5: Awaited<ReturnType<typeof fetchCandles>> }[] = [];
      let n = 0;
      await runPool(list, 6, async (s) => {
        try {
          const [daily, bars5] = await Promise.all([fetchCandles(s.symbol, 400), fetchCandles(s.symbol, 40, "5m")]);
          if (daily.length > 80 && bars5.length > 100) inputs.push({ symbol: s.symbol, name: s.name, sector: s.sector, daily, bars5 });
        } catch { /* skip stocks with no intraday history */ }
        setProg(++n / list.length);
      });
      setR(backtestPicks(inputs)); setRc(backtestPicks(inputs, { confirm: true }));
    } finally { setBusy(false); }
  }
  const c = r?.card;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">Backtest the pick rules<Info title="Backtest the pick rules"><p>Runs the exact pick rules on each of the last ~40 sessions using only what was known the day before, then replays the top 5 on that day&apos;s 5-minute candles (30 liquid large caps, before charges). It is a sanity check on a short window, not proof.</p></Info></CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" onClick={run} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{busy ? `Replaying… ${Math.round(prog * 100)}%` : r ? "Run again" : "Run backtest"}</Button>
        {c && (c.evaluated === 0 ? <p className="text-sm text-muted-foreground">No intraday history was available to replay.</p> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Sessions" value={String(r!.sessions)} sub={`${c.taken} trades taken of ${c.evaluated} picks`} />
              <Stat label="Winners" value={`${(c.winRate * 100).toFixed(0)}%`} sub={`${c.wins} won, ${c.losses} lost`} />
              <Stat label="Per trade" value={`${c.avgR >= 0 ? "+" : ""}${c.avgR.toFixed(2)}R`} sub={`${c.totalR >= 0 ? "+" : ""}${c.totalR.toFixed(1)}R in total`} tone={c.avgR >= 0 ? "up" : "down"} />
              <Stat label="Average move" value={fmtPct(c.avgPnlPct, 2, { sign: true })} sub="before charges" tone={c.avgPnlPct >= 0 ? "up" : "down"} />
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 font-medium">Pick score</th><th className="font-medium">Trades</th><th className="font-medium">Winners</th><th className="font-medium">Per trade</th></tr></thead>
              <tbody className="divide-y">{r!.byScore.map((b) => <tr key={b.band}><td className="py-1">{b.band}</td><td>{b.card.taken}</td><td>{b.card.taken ? `${(b.card.winRate * 100).toFixed(0)}%` : "-"}</td><td className={b.card.avgR >= 0 ? "text-up" : "text-down"}>{b.card.taken ? `${b.card.avgR >= 0 ? "+" : ""}${b.card.avgR.toFixed(2)}R` : "-"}</td></tr>)}</tbody>
            </table>
            {rc && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <b>With the live VWAP check.</b> Taking a trigger only when that 5-minute candle closes at or above the day&apos;s VWAP: {rc.card.taken} trades, {(rc.card.winRate * 100).toFixed(0)}% winners, <b className={rc.card.avgR >= 0 ? "text-up" : "text-down"}>{rc.card.avgR >= 0 ? "+" : ""}{rc.card.avgR.toFixed(2)}R per trade</b>{rc.card.avgR > c.avgR ? " (better than taking every trigger)." : " (no better than taking every trigger)."} This is what the live Go / Weak call on each pick is based on.
              </div>
            )}
            <p className="text-xs text-muted-foreground">{c.avgR <= 0 ? "On this window the picks did not beat the costs of trading them. Treat them as ideas to study, not a system to follow blindly. " : "Positive on this short window, but intraday charges (about 0.1% to 0.2% a round trip) and slippage are not included. "}{c.taken < 30 ? `Only ${c.taken} trades: too few to judge.` : "Forty sessions is still a small sample."}</p>
          </>
        ))}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("figure truncate text-[1.4rem] leading-tight", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
