"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { dayStatus, DEFAULT_LIMITS, type Limits } from "@/lib/intraday/limits";
import { cleanShare, MISTAKE_TAGS, mistakeCounts, pickDateOf, userNote, withUserNote } from "@/lib/intraday/journal";
import { loadBatches, saveBatch, type PickBatch } from "@/lib/intraday/log";
import { intradaySize, scoreIntraday, topPicks, type IntradayPick } from "@/lib/intraday/picks";
import { evaluatePick, summarize, type PickResult } from "@/lib/intraday/scorecard";
import { fmtInr, fmtPct } from "@/lib/format";
import { displaySymbol } from "@/lib/symbols";
import { cn } from "@/lib/utils";
import { downloadText, tradesToCsv } from "@/lib/export-csv";
import { WeeklyReviewCard } from "@/components/weekly-review-card";
import { AccountEquityChart } from "@/components/paper/account-equity-chart";
import { capitalOf } from "@/lib/paper/funds";
import { IntradayProvider, useIntraday } from "./intraday-provider";

const istToday = () => new Date(Date.now() + 19800_000).toISOString().slice(0, 10);
const OUTCOME = { target: "Target hit", stop: "Stopped out", eod: "Closed at 3:15", "no-entry": "Never triggered", "skipped-gap": "Skipped (gap)" } as const;

export function IntradayView() {
  return <IntradayProvider><Inner /></IntradayProvider>;
}

function Inner() {
  const { acc, ready, view, create, topUp, reset, localOnly } = useIntraday();
  const [potInput, setPotInput] = useState(100000);
  const [add, setAdd] = useState(25000);
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  const now = useNow();
  if (!ready) return null;
  if (!acc || !view) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set up your intraday pot</CardTitle>
          <CardDescription>A separate paper account for day trading. Put in the money you would risk, and you can trade five times that with margin. Its profit and loss are tracked on their own, never mixed with your main paper account. Everything closes by 3:15 pm.</CardDescription>
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
  const today = days.find((d) => d.date === new Date((now + 19800) * 1000).toISOString().slice(0, 10));
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-5">
          <Stat label="Pot value" value={fmtInr(view.value)} sub={`Started with ${fmtInr(acc.pot)}`} />
          <Stat label="Total P&L" value={fmtInr(view.pnl, { sign: true })} sub={fmtPct(view.pnlPct, 1, { sign: true }) + " of pot"} tone={view.pnl >= 0 ? "up" : "down"} />
          <Stat label="Today" value={fmtInr(today?.pnl ?? 0, { sign: true })} sub={`${today?.trades ?? 0} trades closed`} tone={(today?.pnl ?? 0) >= 0 ? "up" : "down"} />
          <Stat label="Buying power" value={fmtInr(view.buyingPower)} sub={`${acc.leverage}x margin`} />
          <Stat label="Margin in use" value={fmtInr(view.marginUsed)} sub="of your own money" />
        </CardContent>
        <CardContent className="flex flex-wrap items-center gap-2 pt-0">
          <div className="w-36"><NumberField min={1000} step={5000} value={add} onChange={setAdd} /></div>
          <Button variant="outline" size="sm" onClick={() => { const r = topUp(add); if (r.error) toast.error(r.error); else toast.success(`Added ${fmtInr(add)} to the pot`); }}>Add to pot</Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { if (confirm("Erase the intraday account, its trades and P&L, and start again?")) reset(); }}>Reset…</Button>
          {view.broke && <span className="text-sm text-down">Your pot is used up.</span>}
        </CardContent>
      </Card>
      <Card className={status.locked ? "border-down/50" : undefined}>
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="font-medium">Today&apos;s limits</span>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Max loss %<NumberField className="h-8 w-16" min={0.5} max={5} step={0.5} value={limits.maxLossPct} onChange={(v) => setLimits({ ...limits, maxLossPct: v })} /></label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Max trades<NumberField className="h-8 w-16" min={1} max={10} value={limits.maxTrades} onChange={(v) => setLimits({ ...limits, maxTrades: Math.round(v) })} /></label>
          <span className="font-mono text-xs text-muted-foreground">{status.tradesToday} trades · {fmtInr(status.pnlToday, { sign: true })} · {status.lossStreak} losses in a row</span>
          {status.locked ? <span className="w-full font-medium text-down">{status.reason} New orders are switched off. <Link className="underline" href="/playbook?book=intraday">Read the rule book</Link>.</span> : <span className="text-xs text-up">Within limits</span>}
        </CardContent>
      </Card>
      {localOnly && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">Your intraday account is saved only in this browser. Run <code>supabase/migrations/0004_intraday_account.sql</code> in the Supabase SQL editor to back it up and keep it across devices.</p>
      )}
      <Picks lock={status.reason ?? null} />
      <Open />
      <EquityCard />
      <WeeklyReviewCard trades={acc.state.trades} title="Intraday" />
      <Results />
      <Scorecard />
      <p className="text-xs text-muted-foreground">Day trading on margin loses money for most people (SEBI&apos;s own studies of Indian traders say so). Read the <Link className="underline" href="/playbook?book=intraday">intraday rule book</Link> before you trade. Paper money only, for learning; picks are rule-based screens, not advice.</p>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("tabular truncate font-mono text-xl font-semibold", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Picks({ lock }: { lock: string | null }) {
  const { acc, place } = useIntraday();
  const { stocks } = useUniverse();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [batch, setBatch] = useState<PickBatch | null>(() => (typeof window === "undefined" ? null : loadBatches().at(-1) ?? null));
  const [riskPct, setRiskPct] = useState(1);
  const [regime, setRegime] = useState<MarketRegime | null>(null);
  const stopRef = useRef(false);

  const generate = useCallback(async () => {
    const universe = (stocks ?? []).filter((s) => s.cap === "large" || s.cap === "mid");
    if (!universe.length) { toast.error("Stock list is still loading"); return; }
    stopRef.current = false;
    setRunning(true);
    const found: IntradayPick[] = [];
    let done = 0;
    let reg: MarketRegime | null = null;
    try {
      try { reg = marketRegime(await fetchCandles("^NSEI", 500)); setRegime(reg); } catch { /* the market check is optional */ }
      await runPool(universe, 8, async (s) => {
        try { const p = scoreIntraday(s.symbol, s.name, s.sector, await fetchCandles(s.symbol, 400)); if (p) found.push(p); } catch { /* skip */ }
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
        const again = scoreIntraday(p.symbol, p.name, p.sector, c, mood);
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

  const pot = acc?.pot ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Picks for the next session</CardTitle>
        <CardDescription>Five liquid stocks in uptrends that closed strong on rising volume, with headline tone checked. Each has a buy-stop entry, a stop-loss and targets. Scan after the close, trade the next morning.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32 space-y-1"><Label className="text-xs text-muted-foreground">Risk per trade (% of pot)</Label><NumberField min={0.25} max={3} step={0.25} value={riskPct} onChange={setRiskPct} /></div>
          <AiSentimentToggle className="w-full" />
          <Button onClick={generate} disabled={running}>{running ? <Loader2 className="animate-spin" /> : <Play />}{running ? "Scanning…" : "Find picks"}</Button>
          {running && <Button variant="outline" onClick={() => { stopRef.current = true; }}>Stop</Button>}
          {progress && <span className="font-mono text-xs text-muted-foreground">{progress.done}/{progress.total}</span>}
        </div>
        {regime && (
          <p className={cn("rounded-lg border p-2.5 text-xs", regime.regime === "bull" ? "border-up/40 bg-up/5" : regime.regime === "bear" ? "border-down/40 bg-down/5" : "border-warn/40 bg-warn/5")}>
            <b>Market: {regime.label.toLowerCase()}.</b> {regime.advice}{regime.sizeFactor < 1 && <> Sizes below use {Math.round(regime.sizeFactor * 100)}% of your normal risk.</>}
          </p>
        )}
        {batch && (
          <>
            <p className="text-sm">For the session on <b>{batch.forDate}</b> (found {new Date(batch.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}).</p>
            <div className="grid gap-3 lg:grid-cols-2">
              {batch.picks.map((p) => {
                const size = intradaySize(pot, acc?.leverage ?? 5, riskPct * (regime?.sizeFactor ?? 1), 5, p.plan);
                return (
                  <div key={p.symbol} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span><b className="font-mono text-base">{displaySymbol(p.symbol)}</b> <span className="text-xs text-muted-foreground">{p.sector}</span></span>
                      <span className="tabular font-mono text-sm">{p.score}<span className="text-xs text-muted-foreground">/100</span></span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 rounded-md bg-muted/50 p-2 text-xs">
                      <span><span className="text-muted-foreground">Buy above</span><b className="block font-mono text-sm">{p.plan.entry.toFixed(2)}</b></span>
                      <span><span className="text-muted-foreground">Stop</span><b className="block font-mono text-sm text-down">{p.plan.stop.toFixed(2)}</b></span>
                      <span><span className="text-muted-foreground">Target 1</span><b className="block font-mono text-sm text-up">{p.plan.target1.toFixed(2)}</b></span>
                      <span><span className="text-muted-foreground">Target 2</span><b className="block font-mono text-sm text-up">{p.plan.target2.toFixed(2)}</b></span>
                    </div>
                    <p className="text-xs text-muted-foreground">Risk {p.plan.riskPct.toFixed(2)}% · reward 1.5R · {size.qty} shares = {fmtInr(size.notional)} using {fmtInr(size.margin)} of your money. Risking {fmtInr(size.riskAmt)} to make {fmtInr(size.rewardAmt)}.</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{p.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul>
                    <p className="text-xs text-muted-foreground"><b>Skip it if</b> it opens above {(p.plan.entry * 1.01).toFixed(2)} or below {p.plan.stop.toFixed(2)}. Exit by 3:15 pm if neither level is hit.</p>
                    <Button size="sm" disabled={size.qty < 1 || !!lock} title={lock ?? undefined} onClick={async () => {
                      const r = await place({ symbol: p.symbol, side: "buy", qty: size.qty, type: "stop", triggerPrice: p.plan.entry, validity: "day", stop: p.plan.stop, target: p.plan.target1, note: `pick:${p.forDate}` });
                      if (r.error) toast.error(r.error); else toast.success(`Order placed: buys ${size.qty} ${displaySymbol(p.symbol)} if it trades up to ${p.plan.entry.toFixed(2)}`);
                    }}>Place order (buy-stop, SL and TP attached)</Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
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
      <CardHeader><CardTitle>Profit and loss over time</CardTitle><CardDescription>Your intraday pot&apos;s result, in rupees, on its own.</CardDescription></CardHeader>
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
        <CardTitle>Your results</CardTitle>
        <CardDescription>{total} trades, {total ? ((wins / total) * 100).toFixed(0) : 0}% winners. Charges and slippage are included. Tag mistakes honestly: the count shows which rule you break most.</CardDescription>
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
        <CardTitle>Are the suggestions working?</CardTitle>
        <CardDescription>Replays every saved pick on that day&apos;s 5-minute candles as if you had followed it exactly (entry, stop, first target, out by 3:15; stop assumed first when a candle touches both). Independent of what you actually traded. Needs a few weeks of picks to mean anything; free intraday history reaches back about 40 days.</CardDescription>
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
